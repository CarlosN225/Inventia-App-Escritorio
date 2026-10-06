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
    """Producto con todos los campos del DER, con los nombres reales del modelo.
    Al encargado no se le manda el costo (solo el propietario ve costos y ganancias)."""

    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)

    class Meta:
        model = Producto
        fields = [
            "id",
            "codigo_barras",
            "nombre",
            "descripcion",
            "marca",
            "categoria",
            "categoria_nombre",
            "unidad_medida",
            "precio_venta",
            "ultimo_costo",
            "precio_mayoreo",
            "cantidad_minima_mayoreo",
            "piezas_por_empaque",
            "tipo_empaque",
            "fecha_caducidad",
            "imagen",
            "stock_actual",
            "stock_minimo",
            "stock_maximo",
            "activo",
        ]

    def to_representation(self, instance):
        datos = super().to_representation(instance)
        request = self.context.get("request")
        rol = request.session.get("rol") if request else None

        if rol != "propietario":
            datos.pop("ultimo_costo", None)

        return datos

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

