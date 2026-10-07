"""Adaptadores del contrato original a los nombres del DER.
No incorpora endpoints del catálogo ampliado ni operaciones nuevas.
"""
from rest_framework import serializers
from .models import Categoria, Producto, MovimientoInventario

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
    """Movimientos de inventario, con los nombres del DER.

    Campos: id, producto, producto_nombre, tipo_movimiento, cantidad, motivo_merma,
    motivo, stock_resultante, usuario, usuario_nombre, venta, compra, fecha_movimiento.

    - `tipo_movimiento`: entrada | salida | merma | correccion (minúsculas; se acepta
      cualquier mayúscula/minúscula al recibirlo).
    - `cantidad`: positiva en entrada, salida y merma. En correccion es la DIFERENCIA
      con signo (+ sobrante, - faltante), distinta de 0.
    - `motivo_merma`: obligatorio solo en merma. Acepta `consumo` y `devolucion`
      además de `consumo_propio` y `devolucion_proveedor`.
    - `motivo`: nota. Obligatoria en correccion y cuando la merma es "otro".
    - Solo lectura: producto_nombre, usuario, usuario_nombre, stock_resultante,
      venta, compra y fecha_movimiento. El usuario lo pone el backend desde la sesión.

    Por compatibilidad también se reciben los nombres viejos `tipo` y `observaciones`.
    """

    ALIAS_MOTIVO_MERMA = {
        "consumo": MovimientoInventario.MOTIVO_MERMA_CONSUMO_PROPIO,
        "devolucion": MovimientoInventario.MOTIVO_MERMA_DEVOLUCION_PROVEEDOR,
    }

    tipo_movimiento = serializers.ChoiceField(choices=MovimientoInventario.TIPO_CHOICES)
    motivo = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, max_length=200
    )
    motivo_merma = serializers.ChoiceField(
        choices=MovimientoInventario.MOTIVO_MERMA_CHOICES,
        required=False,
        allow_null=True,
    )
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)
    usuario_nombre = serializers.CharField(source="usuario.nombre_completo", read_only=True)

    class Meta:
        model = MovimientoInventario
        fields = [
            "id",
            "producto",
            "producto_nombre",
            "tipo_movimiento",
            "cantidad",
            "motivo_merma",
            "motivo",
            "stock_resultante",
            "usuario",
            "usuario_nombre",
            "venta",
            "compra",
            "fecha_movimiento",
        ]
        read_only_fields = ["stock_resultante", "usuario", "venta", "compra", "fecha_movimiento"]

    def to_internal_value(self, data):
        # Copia editable de lo que manda el frontend, para normalizar sin tocar el original
        data = data.copy()

        # Nombres viejos -> nombres del DER (solo si no vino el nuevo)
        if "tipo_movimiento" not in data and "tipo" in data:
            data["tipo_movimiento"] = data["tipo"]
        if "motivo" not in data and "observaciones" in data:
            data["motivo"] = data["observaciones"]

        tipo = data.get("tipo_movimiento")
        if isinstance(tipo, str):
            data["tipo_movimiento"] = tipo.strip().lower()

        motivo_merma = data.get("motivo_merma")
        if motivo_merma in ("", None):
            data["motivo_merma"] = None
        elif isinstance(motivo_merma, str):
            data["motivo_merma"] = self.ALIAS_MOTIVO_MERMA.get(motivo_merma, motivo_merma)

        return super().to_internal_value(data)

    def validate(self, attrs):
        tipo = attrs["tipo_movimiento"]
        cantidad = attrs["cantidad"]
        motivo = (attrs.get("motivo") or "").strip()
        motivo_merma = attrs.get("motivo_merma")

        if tipo == MovimientoInventario.TIPO_CORRECCION:
            if cantidad == 0:
                raise serializers.ValidationError(
                    {"cantidad": "La corrección debe tener una diferencia distinta de 0."}
                )
            if not motivo:
                raise serializers.ValidationError(
                    {"motivo": "La corrección requiere un motivo."}
                )
        elif cantidad <= 0:
            raise serializers.ValidationError(
                {"cantidad": "La cantidad debe ser mayor a 0."}
            )

        if tipo == MovimientoInventario.TIPO_MERMA:
            if not motivo_merma:
                raise serializers.ValidationError(
                    {"motivo_merma": "La merma requiere un motivo."}
                )
            if motivo_merma == MovimientoInventario.MOTIVO_MERMA_OTRO and not motivo:
                raise serializers.ValidationError(
                    {"motivo": "Explica la merma en la nota cuando el motivo es \"otro\"."}
                )
        else:
            # Solo la merma lleva motivo_merma
            attrs["motivo_merma"] = None

        attrs["motivo"] = motivo or None
        return attrs