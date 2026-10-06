from rest_framework import serializers
from .models import Usuario


class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = [
            'id',
            'nombre_completo',
            'correo',
            'telefono_whatsapp',
            'rol',
            'activo'
        ]


class UsuarioRegistroSerializer(serializers.ModelSerializer):
    """
    Serializer utilizado por el propietario para crear encargados.
    El rol NO se recibe desde el frontend: siempre será encargado.
    """

    contrasena = serializers.CharField(write_only=True)

    telefono_whatsapp = serializers.CharField(
        required=False,
        allow_blank=True
    )

    class Meta:
        model = Usuario
        fields = [
            'nombre_completo',
            'correo',
            'contrasena',
            'telefono_whatsapp'
        ]

    def create(self, validated_data):
        from django.contrib.auth.hashers import make_password

        contrasena = validated_data.pop('contrasena')

        usuario = Usuario(
            **validated_data,
            rol='encargado',
            activo=True
        )

        usuario.contrasena_hash = make_password(contrasena)
        usuario.save()

        return usuario
class UsuarioEditarSerializer(serializers.ModelSerializer):
    """
    Permite al propietario editar los datos de un encargado.

    El rol, contraseña y estado no se pueden modificar
    desde este serializer.
    """

    class Meta:
        model = Usuario
        fields = [
            'nombre_completo',
            'correo',
            'telefono_whatsapp'
        ]

    def validate_correo(self, value):
        usuario_actual = self.instance

        existe = Usuario.objects.filter(
            correo=value
        ).exclude(
            id=usuario_actual.id
        ).exists()

        if existe:
            raise serializers.ValidationError(
                'Ese correo ya está registrado por otro usuario.'
            )

        return value
class UsuarioActualizarPerfilSerializer(serializers.ModelSerializer):
    """
    Permite al usuario modificar únicamente sus propios datos personales.
    """

    class Meta:
        model = Usuario
        fields = [
            'nombre_completo',
            'telefono_whatsapp'
        ]


class CambiarContrasenaSerializer(serializers.Serializer):
    """
    Permite al usuario cambiar su propia contraseña.
    """

    contrasena_actual = serializers.CharField(write_only=True)
    nueva_contrasena = serializers.CharField(write_only=True)

    def validate_nueva_contrasena(self, value):
        if len(value) < 6:
            raise serializers.ValidationError(
                'La nueva contraseña debe tener al menos 6 caracteres.'
            )

        return value