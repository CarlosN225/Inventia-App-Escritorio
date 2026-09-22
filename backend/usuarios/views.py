from django.contrib.auth.hashers import check_password
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Usuario
from .serializers import UsuarioSerializer, UsuarioRegistroSerializer


@api_view(['POST'])
def login_view(request):
    correo = request.data.get('correo')
    contrasena = request.data.get('contrasena')

    try:
        usuario = Usuario.objects.get(correo=correo, activo=True)
    except Usuario.DoesNotExist:
        return Response({'error': 'Correo o contraseña incorrectos'}, status=status.HTTP_401_UNAUTHORIZED)

    if not check_password(contrasena, usuario.contrasena_hash):
        return Response({'error': 'Correo o contraseña incorrectos'}, status=status.HTTP_401_UNAUTHORIZED)

    request.session['id_usuario'] = usuario.id
    request.session['rol'] = usuario.rol

    return Response({
        'usuario': UsuarioSerializer(usuario).data,
        'mensaje': 'Login exitoso'
    })


@api_view(['POST'])
def logout_view(request):
    request.session.flush()
    return Response({'mensaje': 'Sesión cerrada'})


@api_view(['GET'])
def me_view(request):
    print("SESSION:", request.session.session_key)
    print("ID USUARIO:", request.session.get('id_usuario'))
    print("ROL:", request.session.get('rol'))

    id_usuario = request.session.get('id_usuario')

    if not id_usuario:
        return Response(
            {'error': 'No hay sesión activa'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    try:
        usuario = Usuario.objects.get(id=id_usuario, activo=True)
    except Usuario.DoesNotExist:
        return Response(
            {'error': 'Usuario no encontrado'},
            status=status.HTTP_404_NOT_FOUND
        )

    return Response(UsuarioSerializer(usuario).data)


@api_view(['POST'])
def registrar_usuario_view(request):
    # Solo el propietario puede crear nuevos usuarios (encargados)
    rol_sesion = request.session.get('rol')
    if rol_sesion != 'propietario':
        return Response({'error': 'No tienes permiso para crear usuarios'}, status=status.HTTP_403_FORBIDDEN)

    serializer = UsuarioRegistroSerializer(data=request.data)
    if serializer.is_valid():
        usuario = serializer.save()
        return Response(UsuarioSerializer(usuario).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)