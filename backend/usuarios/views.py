from secrets import token_urlsafe

from django.contrib.auth.hashers import check_password, make_password

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status

from django.db import transaction
from rest_framework.permissions import AllowAny

from inventario.models import Negocio, Configuracion

from .models import Usuario, EventoSeguridad, propietario_principal
from . import recuperacion
from .serializers import (
    UsuarioSerializer,
    UsuarioRegistroSerializer,
    UsuarioActualizarPerfilSerializer,
    CambiarContrasenaSerializer,
    UsuarioEditarSerializer
)
from .permissions import EsUsuarioAutenticado, EsPropietario

from datetime import time, timedelta
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.utils import timezone


MAX_PROPIETARIOS = 2


def proximo_lunes():
    """Fecha y hora del próximo lunes a las 6:00 a.m. (hora local)."""
    ahora = timezone.localtime()
    lunes = ahora.replace(hour=6, minute=0, second=0, microsecond=0)
    lunes += timedelta(days=(0 - ahora.weekday()) % 7)
    if lunes <= ahora:
        lunes += timedelta(days=7)
    return lunes


def obtener_usuario_sesion(request):
    """
    Obtiene el usuario que inició sesión.
    """
    id_usuario = request.session.get('id_usuario')

    if not id_usuario:
        return None

    try:
        return Usuario.objects.get(id=id_usuario, activo=True)
    except Usuario.DoesNotExist:
        return None


@api_view(['POST'])
def login_view(request):
    correo = request.data.get('correo')
    contrasena = request.data.get('contrasena')

    try:
        usuario = Usuario.objects.get(
            correo=correo,
            activo=True
        )
    except Usuario.DoesNotExist:
        return Response(
            {'error': 'Correo o contraseña incorrectos'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    if not check_password(
        contrasena,
        usuario.contrasena_hash
    ):
        return Response(
            {'error': 'Correo o contraseña incorrectos'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    request.session['id_usuario'] = usuario.id
    request.session['rol'] = usuario.rol

    # Mantener sesión: hasta el próximo lunes a las 6:00 a.m. si lo marcó.
    # Si no, la sesión se cierra al cerrar la aplicación.
    if request.data.get('mantener_sesion'):
        request.session.set_expiry(proximo_lunes())
    else:
        request.session.set_expiry(0)


    return Response({
        'usuario': UsuarioSerializer(usuario).data,
        'mensaje': 'Login exitoso'
    })


@api_view(['POST'])
def logout_view(request):
    request.session.flush()

    return Response({
        'mensaje': 'Sesión cerrada'
    })


@api_view(['GET'])
@permission_classes([EsUsuarioAutenticado])
def me_view(request):
    usuario = obtener_usuario_sesion(request)

    if not usuario:
        return Response(
            {'error': 'Usuario no encontrado'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    return Response(
        UsuarioSerializer(usuario).data
    )


@api_view(['POST'])
@permission_classes([EsPropietario])
def registrar_usuario_view(request):
    """
    El propietario puede crear encargados y, si lo necesita, un segundo propietario
    (ej. su pareja o socio). Máximo 2 propietarios activos.
    """

    rol = request.data.get('rol') or Usuario.ROL_ENCARGADO

    if rol not in (Usuario.ROL_ENCARGADO, Usuario.ROL_PROPIETARIO):
        return Response(
            {'error': 'Rol no válido'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if rol == Usuario.ROL_PROPIETARIO and Usuario.objects.filter(
        rol=Usuario.ROL_PROPIETARIO, activo=True
    ).count() >= MAX_PROPIETARIOS:
        return Response(
            {'error': f'Solo puede haber {MAX_PROPIETARIOS} propietarios'},
            status=status.HTTP_400_BAD_REQUEST
        )

    serializer = UsuarioRegistroSerializer(
        data=request.data
    )

    if serializer.is_valid():
        usuario = serializer.save(rol=rol)

        if rol == Usuario.ROL_PROPIETARIO:
            EventoSeguridad.objects.create(
                usuario=usuario,
                realizado_por=obtener_usuario_sesion(request),
                tipo=EventoSeguridad.TIPO_PROPIETARIO_AGREGADO,
            )

        return Response(
            UsuarioSerializer(usuario).data,
            status=status.HTTP_201_CREATED
        )

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )


@api_view(['GET'])
@permission_classes([EsPropietario])
def listar_usuarios_view(request):
    """
    Solo el propietario puede consultar la administración de usuarios.

    Por defecto solamente muestra usuarios activos.

    Si se recibe:
        ?incluir_inactivos=true

    también muestra los usuarios dados de baja.
    """

    incluir_inactivos = (
        request.query_params.get('incluir_inactivos') == 'true'
    )

    if incluir_inactivos:
        usuarios = Usuario.objects.all().order_by(
            'nombre_completo'
        )
    else:
        usuarios = Usuario.objects.filter(
            activo=True
        ).order_by(
            'nombre_completo'
        )

    return Response(
        UsuarioSerializer(
            usuarios,
            many=True
        ).data
    )


@api_view(['PATCH'])
@permission_classes([EsPropietario])
def editar_usuario_view(request, usuario_id):
    """
    El propietario puede editar los datos de un encargado.

    No se permite editar al propietario.

    El rol no puede modificarse desde aquí.
    """

    try:
        usuario = Usuario.objects.get(
            id=usuario_id
        )
    except Usuario.DoesNotExist:
        return Response(
            {'error': 'Usuario no encontrado'},
            status=status.HTTP_404_NOT_FOUND
        )

    if usuario.rol != 'encargado':
        return Response(
            {
                'error':
                    'El propietario no puede ser editado '
                    'desde este apartado'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    serializer = UsuarioEditarSerializer(
        usuario,
        data=request.data,
        partial=True
    )

    if serializer.is_valid():
        usuario = serializer.save()

        return Response({
            'mensaje': 'Usuario actualizado correctamente',
            'usuario': UsuarioSerializer(usuario).data
        })

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )


@api_view(['PATCH'])
@permission_classes([EsPropietario])
def cambiar_estado_usuario_view(request, usuario_id):
    """
    Activa o da de baja un encargado.

    Al segundo propietario solo lo puede dar de baja (o reactivar) el propietario
    principal, el que registró el negocio. Al principal nadie lo puede dar de baja.
    """

    try:
        usuario = Usuario.objects.get(
            id=usuario_id
        )
    except Usuario.DoesNotExist:
        return Response(
            {'error': 'Usuario no encontrado'},
            status=status.HTTP_404_NOT_FOUND
        )

    activo = request.data.get('activo')

    if not isinstance(activo, bool):
        return Response(
            {
                'error':
                    'El campo activo debe ser true o false'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    es_propietario = usuario.rol == Usuario.ROL_PROPIETARIO

    if es_propietario:
        quien = obtener_usuario_sesion(request)
        principal = propietario_principal()

        if principal and usuario.id == principal.id:
            return Response(
                {'error': 'El propietario principal no puede ser dado de baja'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not quien or not principal or quien.id != principal.id:
            return Response(
                {'error': 'Solo el propietario principal puede dar de baja o reactivar al otro propietario'},
                status=status.HTTP_403_FORBIDDEN
            )

        if activo and not usuario.activo and Usuario.objects.filter(
            rol=Usuario.ROL_PROPIETARIO, activo=True
        ).count() >= MAX_PROPIETARIOS:
            return Response(
                {'error': f'Solo puede haber {MAX_PROPIETARIOS} propietarios activos'},
                status=status.HTTP_400_BAD_REQUEST
            )

    cambio = usuario.activo != activo
    usuario.activo = activo

    usuario.save(
        update_fields=['activo']
    )

    if es_propietario and cambio:
        EventoSeguridad.objects.create(
            usuario=usuario,
            realizado_por=quien,
            tipo=(
                EventoSeguridad.TIPO_PROPIETARIO_REACTIVADO if activo
                else EventoSeguridad.TIPO_PROPIETARIO_DESACTIVADO
            ),
        )

    if activo:
        mensaje = 'Usuario reactivado correctamente'
    else:
        mensaje = 'Usuario dado de baja correctamente'

    return Response({
        'mensaje': mensaje,
        'usuario': UsuarioSerializer(usuario).data
    })


@api_view(['POST'])
@permission_classes([EsPropietario])
def restablecer_contrasena_view(request, usuario_id):
    """
    El propietario puede restablecer la contraseña de un encargado
    o la del otro propietario (nunca la suya: para eso está Mi perfil).

    Se genera una contraseña temporal: al entrar con ella,
    la app le pide crear la suya.
    """

    try:
        usuario = Usuario.objects.get(
            id=usuario_id
        )
    except Usuario.DoesNotExist:
        return Response(
            {'error': 'Usuario no encontrado'},
            status=status.HTTP_404_NOT_FOUND
        )

    quien = obtener_usuario_sesion(request)

    if quien and usuario.id == quien.id:
        return Response(
            {
                'error':
                    'Tu propia contraseña se cambia desde Mi perfil'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    contrasena_temporal = token_urlsafe(8)

    usuario.contrasena_hash = make_password(
        contrasena_temporal
    )

    # NUEVO: es temporal; al entrar, la app le pedirá crear la suya
    usuario.debe_cambiar_contrasena = True

    usuario.save(
        update_fields=['contrasena_hash', 'debe_cambiar_contrasena']
    )

    if usuario.rol == Usuario.ROL_PROPIETARIO:
        EventoSeguridad.objects.create(
            usuario=usuario,
            realizado_por=quien,
            tipo=EventoSeguridad.TIPO_RESTABLECIDA_POR_PROPIETARIO,
        )

    return Response({
        'mensaje': 'Contraseña restablecida correctamente',
        'contrasena_temporal': contrasena_temporal
    })


@api_view(['PATCH'])
@permission_classes([EsUsuarioAutenticado])
def actualizar_mi_perfil_view(request):
    """
    El usuario puede modificar únicamente
    su nombre y teléfono de contacto.
    """

    usuario = obtener_usuario_sesion(request)

    if not usuario:
        return Response(
            {'error': 'Usuario no encontrado'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    serializer = UsuarioActualizarPerfilSerializer(
        usuario,
        data=request.data,
        partial=True
    )

    if serializer.is_valid():
        serializer.save()

        return Response({
            'mensaje':
                'Perfil actualizado correctamente',
            'usuario':
                UsuarioSerializer(usuario).data
        })

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )


@api_view(['POST'])
@permission_classes([EsUsuarioAutenticado])
def cambiar_mi_contrasena_view(request):
    """
    El usuario puede cambiar su propia contraseña.
    También es la que usa la ventanita de "Crea tu contraseña"
    cuando entró con una temporal.
    """

    usuario = obtener_usuario_sesion(request)

    if not usuario:
        return Response(
            {'error': 'Usuario no encontrado'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    serializer = CambiarContrasenaSerializer(
        data=request.data
    )

    if not serializer.is_valid():
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    contrasena_actual = (
        serializer.validated_data[
            'contrasena_actual'
        ]
    )

    nueva_contrasena = (
        serializer.validated_data[
            'nueva_contrasena'
        ]
    )

    if not check_password(
        contrasena_actual,
        usuario.contrasena_hash
    ):
        return Response(
            {
                'error':
                    'La contraseña actual es incorrecta'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    # NUEVO: la nueva no puede ser igual a la actual (sobre todo, a la temporal)
    if nueva_contrasena == contrasena_actual:
        return Response(
            {
                'error':
                    'La nueva contraseña debe ser diferente a la actual'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    usuario.contrasena_hash = make_password(
        nueva_contrasena
    )

    # NUEVO: ya creó la suya, deja de ser temporal
    usuario.debe_cambiar_contrasena = False

    usuario.save(
        update_fields=['contrasena_hash', 'debe_cambiar_contrasena']
    )

    return Response({
        'mensaje':
            'Contraseña actualizada correctamente'
    })


def leer_hora(texto, por_defecto=time(20, 0)):
    """'20:00' -> time(20, 0). Si viene vacía o mal escrita, se usa la de por defecto."""
    try:
        horas, minutos = str(texto).split(':')[:2]
        return time(int(horas), int(minutos))
    except (TypeError, ValueError):
        return por_defecto


def leer_dias(valor, por_defecto=30):
    """Días de anticipación para avisar de caducidad (entre 1 y 365)."""
    try:
        dias = int(valor)
    except (TypeError, ValueError):
        return por_defecto
    return dias if 1 <= dias <= 365 else por_defecto


@api_view(['POST'])
@permission_classes([AllowAny])
def crear_primer_propietario_view(request):
    """
    Configuración inicial: crea al propietario, el negocio y sus preferencias,
    todo en una sola transacción. Solo funciona cuando todavía no hay ningún usuario.

    Acepta los datos agrupados (propietario, negocio, preferencias) o, por
    compatibilidad con la versión anterior, los del propietario sueltos.
    """

    if Usuario.objects.exists():
        return Response(
            {'error': 'El propietario inicial ya fue creado'},
            status=status.HTTP_403_FORBIDDEN
        )

    datos = request.data
    cuenta = datos.get('propietario') or datos
    negocio = datos.get('negocio') or {}
    preferencias = datos.get('preferencias') or {}

    nombre_completo = (cuenta.get('nombre_completo') or '').strip()
    correo = (cuenta.get('correo') or '').strip().lower()
    contrasena = cuenta.get('contrasena') or ''
    telefono_whatsapp = (cuenta.get('telefono_whatsapp') or '').strip()
    nombre_negocio = (negocio.get('nombre') or '').strip()

    if not nombre_completo or not correo or not contrasena:
        return Response(
            {'error': 'nombre_completo, correo y contrasena son obligatorios'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if len(contrasena) < 8:
        return Response(
            {'error': 'La contraseña debe tener al menos 8 caracteres'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if Usuario.objects.filter(correo=correo).exists():
        return Response(
            {'error': 'El correo ya está registrado'},
            status=status.HTTP_400_BAD_REQUEST
        )

    digitos = lambda t: ''.join(c for c in str(t or '') if c.isdigit())

    # Teléfono de la dulcería: opcional (no todas tienen); si lo escriben, 10 dígitos
    telefono_negocio = digitos(negocio.get('telefono'))
    if telefono_negocio and len(telefono_negocio) != 10:
        return Response(
            {'error': 'El teléfono de la dulcería debe tener 10 dígitos'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # El teléfono del dueño ya es opcional (antes era para WhatsApp); si lo escriben, 10 dígitos
    if telefono_whatsapp and len(digitos(telefono_whatsapp)) != 10:
        return Response(
            {'error': 'El teléfono de contacto debe tener 10 dígitos'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Avisos por correo: a qué correo, a qué hora se revisa y con cuántos días avisar de caducidad
    correo_alertas = (preferencias.get('correo_alertas') or '').strip().lower() or correo
    try:
        validate_email(correo_alertas)
    except ValidationError:
        return Response(
            {'error': 'Revisa el correo para los avisos'},
            status=status.HTTP_400_BAD_REQUEST
        )

    hora_resumen = leer_hora(preferencias.get('hora_resumen'))
    dias_aviso_caducidad = leer_dias(preferencias.get('dias_aviso_caducidad'))

    # Todo o nada: si algo falla, no queda un dueño sin negocio
    with transaction.atomic():
        usuario = Usuario(
            nombre_completo=nombre_completo,
            correo=correo,
            telefono_whatsapp=telefono_whatsapp,
            rol='propietario',
            activo=True,
            contrasena_hash=make_password(contrasena)
        )
        codigo_recuperacion = recuperacion.asignar_codigo_nuevo(usuario)
        usuario.save()

        if nombre_negocio:
            negocio_creado = Negocio.objects.create(
                nombre=nombre_negocio,
                propietario=nombre_completo,
                direccion=(negocio.get('direccion') or '').strip(),
                telefono=telefono_negocio,
                usuario_admin=usuario
            )

            Configuracion.objects.create(
                negocio=negocio_creado,
                maneja_caducidad=bool(preferencias.get('maneja_caducidad', True)),
                vende_mayoreo=bool(preferencias.get('vende_mayoreo', True)),
                maneja_promociones=bool(preferencias.get('maneja_promociones', True)),
                usa_codigo_barras=bool(preferencias.get('usa_codigo_barras', False)),
                alertas_activas=bool(preferencias.get('alertas_activas', True)),
                correo_alertas=correo_alertas,
                hora_resumen=hora_resumen,
                dias_aviso_caducidad=dias_aviso_caducidad
            )

    return Response(
        {
            'mensaje': 'Configuración inicial creada correctamente',
            'usuario': UsuarioSerializer(usuario).data,
            # Se muestra una sola vez en el asistente; no se puede volver a consultar
            'codigo_recuperacion': codigo_recuperacion,
        },
        status=status.HTTP_201_CREATED
    )


@api_view(['DELETE'])
@permission_classes([EsPropietario])
def eliminar_usuario_view(request, usuario_id):
    """
    El propietario puede eliminar definitivamente
    un encargado solamente si no tiene registros
    relacionados.

    Si tiene movimientos relacionados, se rechaza
    la eliminación y se recomienda darlo de baja.
    """

    try:
        usuario = Usuario.objects.get(
            id=usuario_id
        )
    except Usuario.DoesNotExist:
        return Response(
            {
                'error':
                    'Usuario no encontrado'
            },
            status=status.HTTP_404_NOT_FOUND
        )

    # El propietario nunca puede eliminarse.
    if usuario.rol != 'encargado':
        return Response(
            {
                'error':
                    'El propietario no puede ser eliminado'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    # Revisar relaciones que apunten hacia Usuario.
    relaciones = []

    for relacion in Usuario._meta.related_objects:
        modelo = relacion.related_model

        try:
            cantidad = modelo.objects.filter(
                **{
                    relacion.field.name: usuario
                }
            ).count()

            if cantidad > 0:
                relaciones.append({
                    'modelo': modelo.__name__,
                    'cantidad': cantidad
                })

        except Exception:
            continue

    # Si tiene registros relacionados,
    # no se permite eliminar definitivamente.
    if relaciones:
        return Response(
            {
                'error': (
                    'Este usuario tiene movimientos registrados. '
                    'No se puede eliminar definitivamente. '
                    'Es mejor darle de baja para conservar el historial.'
                ),
                'puede_dar_de_baja': True,
                'relaciones': relaciones
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    # Si no tiene registros relacionados,
    # se elimina definitivamente.
    usuario.delete()

    return Response(
        {
            'mensaje': (
                'Usuario eliminado definitivamente porque '
                'no tiene movimientos registrados'
            )
        },
        status=status.HTTP_200_OK
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def estado_inicial_view(request):
    """¿La app ya tiene dueño? Se consulta antes del login, sin sesión."""
    negocio = Negocio.objects.first()
    return Response({
        'necesita_configuracion': not Usuario.objects.exists(),
        'nombre_negocio': negocio.nombre if negocio else None,
    })


# ============================================================
#  RECUPERACIÓN DE CONTRASEÑA DEL PROPIETARIO
# ============================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def recuperar_contrasena_view(request):
    """
    Desde el login, sin sesión: el propietario escribe su correo, su código
    de recuperación y una contraseña nueva. Si todo cuadra, se cambia la
    contraseña y se le da un código NUEVO (el anterior deja de servir).
    """
    correo = (request.data.get('correo') or '').strip().lower()
    codigo = request.data.get('codigo') or ''
    nueva = request.data.get('nueva_contrasena') or ''

    if recuperacion.bloqueado(correo):
        return Response(
            {'error': f'Demasiados intentos. Espera {recuperacion.MINUTOS_BLOQUEO} minutos e intenta de nuevo.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS
        )

    if len(nueva) < 8:
        return Response(
            {'error': 'La contraseña nueva debe tener al menos 8 caracteres'},
            status=status.HTTP_400_BAD_REQUEST
        )

    usuario = Usuario.objects.filter(
        correo=correo, rol=Usuario.ROL_PROPIETARIO, activo=True
    ).first()

    if not usuario or not recuperacion.coincide(codigo, usuario.codigo_recuperacion_hash):
        recuperacion.registrar_fallo(correo)
        return Response(
            {'error': 'El correo o el código de recuperación no coinciden'},
            status=status.HTTP_400_BAD_REQUEST
        )

    recuperacion.limpiar_fallos(correo)
    usuario.contrasena_hash = make_password(nueva)
    usuario.debe_cambiar_contrasena = False
    codigo_nuevo = recuperacion.asignar_codigo_nuevo(usuario)
    usuario.save(update_fields=['contrasena_hash', 'debe_cambiar_contrasena', 'codigo_recuperacion_hash'])

    EventoSeguridad.objects.create(
        usuario=usuario, realizado_por=usuario, tipo=EventoSeguridad.TIPO_RECUPERO_CON_CODIGO
    )

    return Response({
        'mensaje': 'Contraseña cambiada. Ya puedes iniciar sesión.',
        'codigo_recuperacion': codigo_nuevo,
    })


@api_view(['POST'])
@permission_classes([EsPropietario])
def generar_codigo_recuperacion_view(request):
    """
    Desde Mi perfil: el propietario confirma su contraseña y obtiene un código
    nuevo (sirve también para las cuentas creadas antes de que existiera).
    """
    usuario = obtener_usuario_sesion(request)

    if not usuario:
        return Response({'error': 'Usuario no encontrado'}, status=status.HTTP_401_UNAUTHORIZED)

    if not check_password(request.data.get('contrasena') or '', usuario.contrasena_hash):
        return Response({'error': 'La contraseña no es correcta'}, status=status.HTTP_400_BAD_REQUEST)

    codigo = recuperacion.asignar_codigo_nuevo(usuario)
    usuario.save(update_fields=['codigo_recuperacion_hash'])

    EventoSeguridad.objects.create(
        usuario=usuario, realizado_por=usuario, tipo=EventoSeguridad.TIPO_CODIGO_GENERADO
    )

    return Response({'codigo_recuperacion': codigo})


@api_view(['GET'])
@permission_classes([EsPropietario])
def eventos_seguridad_view(request):
    """Los últimos cambios sensibles en las cuentas (para que el dueño vea todo lo que pasó)."""
    eventos = EventoSeguridad.objects.select_related('usuario', 'realizado_por')[:20]
    return Response([
        {
            'id': e.id,
            'tipo': e.tipo,
            'texto': e.get_tipo_display(),
            'usuario': e.usuario.nombre_completo,
            'realizado_por': e.realizado_por.nombre_completo if e.realizado_por else 'Soporte de Inventia',
            'detalle': e.detalle,
            'fecha': e.fecha,
        }
        for e in eventos
    ])
