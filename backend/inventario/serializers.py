"""La función de este archivo es tomar tus modelos de Python y traducirlos a formato JSON (
el idioma universal de internet) para que el frontend web de React los pueda leer y escribir."""

from rest_framework import serializers
from .models import Categoria, Producto, Movimiento, Alerta

class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = '__all__'

class ProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producto
        fields = '__all__'

class MovimientoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Movimiento
        fields = '__all__'

class AlertaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alerta
        fields = '__all__'