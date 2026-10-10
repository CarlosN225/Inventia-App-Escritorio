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
    promocion_vigente = serializers.SerializerMethodField()

    class Meta:
        model = Producto
        fields = [
            "id",
            "codigo_barras",
            "nombre",
            "descripcion",
            "marca",
            "contenido_neto",
            "unidad_contenido",
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
            "promocion_vigente",
        ]

    def to_representation(self, instance):
        datos = super().to_representation(instance)
        request = self.context.get("request")
        rol = request.session.get("rol") if request else None

        if rol != "propietario":
            datos.pop("ultimo_costo", None)

        return datos

    def update(self, instance, validated_data):
        # Al editar, el stock no se toca: solo cambia con compras, ventas, mermas o correcciones
        validated_data.pop("stock_actual", None)
        return super().update(instance, validated_data)

    def get_promocion_vigente(self, obj):
        return promocion_vigente(obj)
    
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



# ============================================================
#  VENTAS Y COMPRAS
# ============================================================
from decimal import Decimal

from .models import Venta, DetalleVenta, Compra, DetalleCompra

TIPOS_PRECIO = ["normal", "mayoreo", "promocion", "editado"]


# ---------- Lo que manda el frontend ----------

class RenglonVentaSerializer(serializers.Serializer):
    producto = serializers.PrimaryKeyRelatedField(queryset=Producto.objects.all())
    cantidad = serializers.IntegerField(min_value=1)
    precio_unitario = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"))
    tipo_precio = serializers.ChoiceField(choices=TIPOS_PRECIO, default="normal")


class RegistrarVentaSerializer(serializers.Serializer):
    renglones = RenglonVentaSerializer(many=True, allow_empty=False)


class RenglonCompraSerializer(serializers.Serializer):
    producto = serializers.PrimaryKeyRelatedField(queryset=Producto.objects.all())
    cantidad = serializers.IntegerField(min_value=1)  # en la unidad de venta (las cajas ya convertidas)
    costo_unitario = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"))
    fecha_caducidad = serializers.DateField(required=False, allow_null=True)


class RegistrarCompraSerializer(serializers.Serializer):
    proveedor = serializers.CharField(max_length=120)
    nota = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    fecha = serializers.DateField(required=False)
    renglones = RenglonCompraSerializer(many=True, allow_empty=False)


# ---------- Lo que contesta el backend ----------

class DetalleVentaSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)

    class Meta:
        model = DetalleVenta
        fields = ["id", "producto", "producto_nombre", "cantidad", "precio_unitario", "subtotal", "tipo_precio"]


class VentaSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source="usuario.nombre_completo", read_only=True)
    detalles = serializers.SerializerMethodField()

    class Meta:
        model = Venta
        fields = ["id", "fecha_venta", "usuario", "usuario_nombre", "total", "detalles"]

    def get_detalles(self, obj):
        # Usa lo que ya se trajo con prefetch_related (sin consultar otra vez)
        return DetalleVentaSerializer(obj.detalles.all(), many=True).data
 

class DetalleCompraSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)

    class Meta:
        model = DetalleCompra
        fields = ["id", "producto", "producto_nombre", "cantidad", "costo_unitario", "fecha_caducidad", "subtotal"]


class CompraSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source="usuario.nombre_completo", read_only=True)
    detalles = serializers.SerializerMethodField()

    class Meta:
        model = Compra
        fields = ["id", "proveedor", "fecha_compra", "nota", "usuario", "usuario_nombre", "total", "detalles"]

    def get_detalles(self, obj):
        detalles = DetalleCompra.objects.filter(compra=obj).select_related("producto")
        return DetalleCompraSerializer(detalles, many=True).data

    

# ============================================================
#  PROMOCIONES
# ============================================================
from django.utils import timezone

from .models import Promocion


class PromocionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Promocion
        fields = ["id", "producto", "tipo_promocion", "valor", "fecha_inicio", "fecha_fin", "activa"]

    def validate(self, datos):
        # En una edición parcial (ej. solo pausar), completa con lo que ya tenía
        actual = self.instance
        tipo = datos.get("tipo_promocion", getattr(actual, "tipo_promocion", None))
        valor = datos.get("valor", getattr(actual, "valor", None))
        inicio = datos.get("fecha_inicio", getattr(actual, "fecha_inicio", None))
        fin = datos.get("fecha_fin", getattr(actual, "fecha_fin", None))
        producto = datos.get("producto", getattr(actual, "producto", None))

        if valor is not None and valor <= 0:
            raise serializers.ValidationError({"valor": "El descuento debe ser mayor a 0."})
        if tipo == Promocion.TIPO_PORCENTAJE and valor is not None and valor > 90:
            raise serializers.ValidationError({"valor": "El descuento no puede pasar de 90%."})
        if tipo == Promocion.TIPO_MONTO and producto and valor is not None and valor >= producto.precio_venta:
            raise serializers.ValidationError({"valor": "El descuento debe ser menor al precio de venta."})
        if inicio and fin and fin < inicio:
            raise serializers.ValidationError({"fecha_fin": "La fecha de fin debe ser después del inicio."})

        return datos


def promocion_vigente(producto):
    """La promoción activa de hoy (si hay varias, la de mayor valor).
    Usa las promociones ya traídas con prefetch_related: no hace otra consulta por producto."""
    hoy = timezone.localdate()
    vigentes = [
        p for p in producto.promociones.all()
        if p.activa and p.fecha_inicio <= hoy <= p.fecha_fin
    ]
    if not vigentes:
        return None

    promo = max(vigentes, key=lambda p: p.valor)
    return {
        "id": promo.id,
        "tipo": "porcentaje" if promo.tipo_promocion == Promocion.TIPO_PORCENTAJE else "monto",
        "valor": str(promo.valor),
        "fecha_fin": promo.fecha_fin.isoformat(),
    }