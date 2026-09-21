from rest_framework import serializers
from .models import Usuario

class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ['id', 'nombre_completo', 'correo', 'telefono_whatsapp', 'rol', 'activo']


class UsuarioRegistroSerializer(serializers.ModelSerializer):
    contrasena = serializers.CharField(write_only=True)

    class Meta:
        model = Usuario
        fields = ['nombre_completo', 'correo', 'contrasena', 'telefono_whatsapp', 'rol']

    def create(self, validated_data):
        from django.contrib.auth.hashers import make_password
        contrasena = validated_data.pop('contrasena')
        usuario = Usuario(**validated_data)
        usuario.contrasena_hash = make_password(contrasena)
        usuario.save()
        return usuario