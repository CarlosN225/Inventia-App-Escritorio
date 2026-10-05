from secrets import token_urlsafe

from django.contrib.auth.hashers import check_password, make_password

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status

from .models import Usuario
from .serializers import (
    UsuarioSerializer,
    UsuarioRegistroSerializer,
    UsuarioActualizarPerfilSerializer,
    CambiarContrasenaSerializer
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
        usuario = Usuario.objects.get(correo=correo, activo=True)
    except Usuario.DoesNotExist:
        return Response(
            {'error': 'Correo o contraseña incorrectos'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    if not check_password(contrasena, usuario.contrasena_hash):
        return Response(
            {'error': 'Correo o contraseña incorrectos'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    request.session['id_usuario'] = usuario.id
    request.session['rol'] = usuario.rol

    # Mantener sesión: 30 días si lo marcó,
    # si no se cierra al cerrar la aplicación.
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

    return Response(UsuarioSerializer(usuario).data)


@api_view(['POST'])
@permission_classes([EsPropietario])
def registrar_usuario_view(request):
    """
    El propietario puede crear encargados.
    Nunca se permite crear otro propietario desde este endpoint.
    """

    serializer = UsuarioRegistroSerializer(data=request.data)

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
    """

    usuarios = Usuario.objects.all().order_by('nombre_completo')

    return Response(
        UsuarioSerializer(usuarios, many=True).data
    )


@api_view(['PATCH'])
@permission_classes([EsPropietario])
def cambiar_estado_usuario_view(request, usuario_id):
    """
    Activa o desactiva un encargado.
    El propietario nunca puede ser desactivado desde aquí.
    """

    try:
        usuario = Usuario.objects.get(id=usuario_id)
    except Usuario.DoesNotExist:
        return Response(
            {'error': 'Usuario no encontrado'},
            status=status.HTTP_404_NOT_FOUND
        )

    if usuario.rol != 'encargado':
        return Response(
            {'error': 'Solo se puede cambiar el estado de los encargados'},
            status=status.HTTP_400_BAD_REQUEST
        )

    activo = request.data.get('activo')

    if not isinstance(activo, bool):
        return Response(
            {'error': 'El campo activo debe ser true o false'},
            status=status.HTTP_400_BAD_REQUEST
        )

    usuario.activo = activo
    usuario.save(update_fields=['activo'])

    return Response({
        'mensaje': 'Estado actualizado correctamente',
        'usuario': UsuarioSerializer(usuario).data
    })


@api_view(['POST'])
@permission_classes([EsPropietario])
def restablecer_contrasena_view(request, usuario_id):
    """
    El propietario puede restablecer la contraseña de un encargado.

    Se genera una contraseña temporal que el encargado
    deberá cambiar posteriormente desde su perfil.
    """

    try:
        usuario = Usuario.objects.get(id=usuario_id)
    except Usuario.DoesNotExist:
        return Response(
            {'error': 'Usuario no encontrado'},
            status=status.HTTP_404_NOT_FOUND
        )

    if usuario.rol != 'encargado':
        return Response(
            {'error': 'Solo se puede restablecer la contraseña de un encargado'},
            status=status.HTTP_400_BAD_REQUEST
        )

    contrasena_temporal = token_urlsafe(8)

    usuario.contrasena_hash = make_password(contrasena_temporal)
    usuario.save(update_fields=['contrasena_hash'])

    return Response({
        'mensaje': 'Contraseña restablecida correctamente',
        'contrasena_temporal': contrasena_temporal
    })


@api_view(['PATCH'])
@permission_classes([EsUsuarioAutenticado])
def actualizar_mi_perfil_view(request):
    """
    El usuario puede modificar únicamente su nombre y WhatsApp.
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
            'mensaje': 'Perfil actualizado correctamente',
            'usuario': UsuarioSerializer(usuario).data
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

    serializer = CambiarContrasenaSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    contrasena_actual = serializer.validated_data['contrasena_actual']
    nueva_contrasena = serializer.validated_data['nueva_contrasena']

    if not check_password(
        contrasena_actual,
        usuario.contrasena_hash
    ):
        return Response(
            {'error': 'La contraseña actual es incorrecta'},
            status=status.HTTP_400_BAD_REQUEST
        )

    usuario.contrasena_hash = make_password(nueva_contrasena)
    usuario.save(update_fields=['contrasena_hash'])

    return Response({
        'mensaje': 'Contraseña actualizada correctamente'
    })


@api_view(['POST'])
def crear_primer_propietario_view(request):
    """
    Crea el primer propietario del sistema.

    Este endpoint solamente funciona cuando todavía
    no existe ningún usuario.
    """

    if Usuario.objects.exists():
        return Response(
            {'error': 'El propietario inicial ya fue creado'},
            status=status.HTTP_403_FORBIDDEN
        )

    nombre_completo = request.data.get('nombre_completo')
    correo = request.data.get('correo')
    contrasena = request.data.get('contrasena')
    telefono_whatsapp = request.data.get('telefono_whatsapp', '')

    if not nombre_completo or not correo or not contrasena:
        return Response(
            {
                'error': (
                    'nombre_completo, correo y contrasena '
                    'son obligatorios'
                )
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    if len(contrasena) < 6:
        return Response(
            {'error': 'La contraseña debe tener al menos 6 caracteres'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if Usuario.objects.filter(correo=correo).exists():
        return Response(
            {'error': 'El correo ya está registrado'},
            status=status.HTTP_400_BAD_REQUEST
        )

    usuario = Usuario.objects.create(
        nombre_completo=nombre_completo,
        correo=correo,
        telefono_whatsapp=telefono_whatsapp,
        rol='propietario',
        activo=True,
        contrasena_hash=make_password(contrasena)
    )

    return Response(
        {
            'mensaje': 'Propietario inicial creado correctamente',
            'usuario': UsuarioSerializer(usuario).data
        },
        status=status.HTTP_201_CREATED
    )