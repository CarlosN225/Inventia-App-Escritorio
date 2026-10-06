"""Adaptadores del contrato original a los nombres del DER.
No incorpora endpoints del catálogo ampliado ni operaciones nuevas.
"""
from rest_framework import serializers
from .models import Categoria, Producto, Movimiento

class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ['id', 'nombre', 'descripcion']

class ProductoSerializer(serializers.ModelSerializer):
    codigo = serializers.CharField(source='codigo_barras', max_length=50)
    cantidad = serializers.IntegerField(source='stock_actual', min_value=0, required=False)
    class Meta:
        model = Producto
        fields = ['id', 'codigo', 'nombre', 'categoria', 'cantidad', 'stock_minimo']
    def validate_codigo(self, value):
        qs = Producto.objects.filter(codigo_barras=value)
        if self.instance: qs = qs.exclude(pk=self.instance.pk)
        if qs.exists(): raise serializers.ValidationError('Ese código ya existe.')
        return value

class MovimientoSerializer(serializers.ModelSerializer):
    tipo = serializers.ChoiceField(source='tipo_movimiento', choices=['ENTRADA','SALIDA'])
    fecha = serializers.DateTimeField(source='fecha_movimiento', read_only=True)
    observaciones = serializers.CharField(source='motivo', required=False, allow_blank=True, allow_null=True, max_length=200)
    class Meta:
        model = Movimiento
        fields = ['id', 'producto', 'tipo', 'cantidad', 'fecha', 'observaciones']
    def validate_tipo(self, value): return value.lower()
    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['tipo'] = data['tipo'].upper()
        return data

