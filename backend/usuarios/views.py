from secrets import token_urlsafe

from django.contrib.auth.hashers import check_password, make_password

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status

from django.db import transaction
from rest_framework.permissions import AllowAny

from inventario.models import Negocio, Configuracion

from .models import Usuario
from .serializers import (
    UsuarioSerializer,
    UsuarioRegistroSerializer,
    UsuarioActualizarPerfilSerializer,
    CambiarContrasenaSerializer,
    UsuarioEditarSerializer
)
from .permissions import EsUsuarioAutenticado, EsPropietario


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

    # Mantener sesión: 30 días si lo marcó.
    # Si no, la sesión se cierra al cerrar la aplicación.
    if request.data.get('mantener_sesion'):
        request.session.set_expiry(60 * 60 * 24 * 30)
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
    El propietario puede crear encargados.
    Nunca se permite crear otro propietario desde este endpoint.
    """

    serializer = UsuarioRegistroSerializer(
        data=request.data
    )

    if serializer.is_valid():
        usuario = serializer.save()

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

    El propietario nunca puede ser dado de baja.
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
                    'El propietario no puede ser dado de baja '
                    'ni reactivado desde aquí'
            },
            status=status.HTTP_400_BAD_REQUEST
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

    usuario.activo = activo

    usuario.save(
        update_fields=['activo']
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
    El propietario puede restablecer la contraseña de un encargado.

    Se genera una contraseña temporal.
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
                    'Solo se puede restablecer la contraseña '
                    'de un encargado'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    contrasena_temporal = token_urlsafe(8)

    usuario.contrasena_hash = make_password(
        contrasena_temporal
    )

    usuario.save(
        update_fields=['contrasena_hash']
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
    su nombre y WhatsApp.
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

    usuario.contrasena_hash = make_password(
        nueva_contrasena
    )

    usuario.save(
        update_fields=['contrasena_hash']
    )

    return Response({
        'mensaje':
            'Contraseña actualizada correctamente'
    })

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

    # Todo o nada: si algo falla, no queda un dueño sin negocio
    with transaction.atomic():
        usuario = Usuario.objects.create(
            nombre_completo=nombre_completo,
            correo=correo,
            telefono_whatsapp=telefono_whatsapp,
            rol='propietario',
            activo=True,
            contrasena_hash=make_password(contrasena)
        )

        if nombre_negocio:
            negocio_creado = Negocio.objects.create(
                nombre=nombre_negocio,
                propietario=nombre_completo,
                direccion=(negocio.get('direccion') or '').strip(),
                telefono=(negocio.get('telefono') or '').strip(),
                usuario_admin=usuario
            )

            Configuracion.objects.create(
                negocio=negocio_creado,
                maneja_caducidad=bool(preferencias.get('maneja_caducidad', True)),
                vende_mayoreo=bool(preferencias.get('vende_mayoreo', True)),
                maneja_promociones=bool(preferencias.get('maneja_promociones', True)),
                usa_codigo_barras=bool(preferencias.get('usa_codigo_barras', False)),
                alertas_activas=bool(preferencias.get('alertas_activas', True)),
                telefono_alertas=telefono_whatsapp
            )

    return Response(
        {
            'mensaje': 'Configuración inicial creada correctamente',
            'usuario': UsuarioSerializer(usuario).data
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