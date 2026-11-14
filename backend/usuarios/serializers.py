from rest_framework import serializers
from .models import Usuario, propietario_principal


class UsuarioSerializer(serializers.ModelSerializer):
    # Solo dice SI tiene código; el código nunca se manda
    tiene_codigo_recuperacion = serializers.SerializerMethodField()
    # El principal es quien registró el negocio: solo él puede dar de baja al segundo propietario
    es_principal = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = [
            'id',
            'nombre_completo',
            'correo',
            'telefono_whatsapp',
            'rol',
            'activo',
            'debe_cambiar_contrasena',
            'tiene_codigo_recuperacion',
            'es_principal',
        ]

    def get_tiene_codigo_recuperacion(self, obj):
        return bool(obj.codigo_recuperacion_hash)

    def get_es_principal(self, obj):
        if obj.rol != Usuario.ROL_PROPIETARIO:
            return False
        if 'principal_id' not in self.context:
            principal = propietario_principal()
            self.context['principal_id'] = principal.id if principal else None
        return obj.id == self.context['principal_id']


class UsuarioRegistroSerializer(serializers.ModelSerializer):
    """
    Serializer utilizado por el propietario para crear encargados (o un segundo propietario).
    El rol lo valida la vista; por defecto es encargado.
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
        rol = validated_data.pop('rol', 'encargado')  # lo decide la vista, no el frontend

        usuario = Usuario(
            **validated_data,
            rol=rol,
            activo=True,
            debe_cambiar_contrasena=True  # la que le da el dueño es temporal
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
