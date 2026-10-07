from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import MovimientoInventario, Producto
from usuarios.models import Usuario


@transaction.atomic
def registrar_movimiento(serializer):
    """Registra un movimiento y actualiza el stock del producto en una sola transacción.

    Si algo falla, no se guarda nada (ni el movimiento ni el cambio de stock).

    Tipos:
      - entrada:    suma `cantidad` al stock.
      - salida:     resta `cantidad`; no puede dejar el stock negativo.
      - merma:      resta `cantidad` (producto perdido); no puede dejar el stock negativo.
      - correccion: suma `cantidad`, que es la DIFERENCIA con signo (+ sobrante, - faltante).
                    Solo el propietario puede hacerla.

    Las validaciones de forma (cantidad > 0, motivo de la merma, nota de la corrección)
    ya las hizo el serializer; aquí van las reglas que dependen del stock y del usuario.
    Las alertas no se guardan aquí: el resumen diario las calcula en vivo (app alertas).
    """
    datos = serializer.validated_data
    tipo = datos["tipo_movimiento"]
    cantidad = datos["cantidad"]
    request = serializer.context["request"]

    # Solo el propietario puede corregir el inventario
    if tipo == MovimientoInventario.TIPO_CORRECCION and request.session.get("rol") != "propietario":
        raise PermissionDenied("Solo el propietario puede corregir el inventario.")

    # Traemos el producto "bloqueado" para que nadie lo modifique al mismo tiempo
    producto = Producto.objects.select_for_update().get(pk=datos["producto"].pk)

    if not producto.activo:
        raise ValidationError({"producto": "El producto está desactivado."})

    stock_anterior = producto.stock_actual

    if tipo == MovimientoInventario.TIPO_ENTRADA:
        stock_nuevo = stock_anterior + cantidad
    elif tipo in (MovimientoInventario.TIPO_SALIDA, MovimientoInventario.TIPO_MERMA):
        stock_nuevo = stock_anterior - cantidad
    elif tipo == MovimientoInventario.TIPO_CORRECCION:
        stock_nuevo = stock_anterior + cantidad
    else:
        raise ValidationError({"tipo": "Tipo de movimiento no válido."})

    if stock_nuevo < 0:
        if tipo == MovimientoInventario.TIPO_CORRECCION:
            mensaje = (
                f"La corrección dejaría el stock en {stock_nuevo}. "
                f"Stock actual: {stock_anterior}."
            )
        else:
            mensaje = f"No hay suficiente stock. Disponible: {stock_anterior}."
        raise ValidationError({"cantidad": mensaje})

    producto.stock_actual = stock_nuevo
    producto.save(update_fields=["stock_actual"])

    # El DER requiere autor y saldo: se toman de la sesión y del stock calculado
    usuario = Usuario.objects.get(pk=request.session["id_usuario"])
    return serializer.save(usuario=usuario, stock_resultante=stock_nuevo)



# ============================================================
#  VENTAS Y COMPRAS
#  Todo en una transacción: si un renglón falla, no se guarda nada.
# ============================================================
from decimal import Decimal

from datetime import datetime

from django.utils import timezone

from .models import Venta, DetalleVenta, Compra, DetalleCompra


def _usuario_de_sesion(request):
    return Usuario.objects.get(pk=request.session["id_usuario"])


@transaction.atomic
def registrar_venta(request, renglones):
    """Crea la venta con su detalle, descuenta el stock y deja un movimiento de salida por renglón."""
    usuario = _usuario_de_sesion(request)
    venta = Venta.objects.create(usuario=usuario, total=Decimal("0"), fecha_venta=timezone.now())
    total = Decimal("0")

    for r in renglones:
        # Se vuelve a leer en cada renglón, por si el mismo producto viene dos veces
        producto = Producto.objects.select_for_update().get(pk=r["producto"].pk)

        if not producto.activo:
            raise ValidationError({"renglones": f"{producto.nombre} está desactivado."})

        if r["cantidad"] > producto.stock_actual:
            raise ValidationError({
                "renglones": f"No hay suficiente {producto.nombre}. Disponible: {producto.stock_actual}."
            })

        subtotal = r["precio_unitario"] * r["cantidad"]

        DetalleVenta.objects.create(
            venta=venta,
            producto=producto,
            cantidad=r["cantidad"],
            precio_unitario=r["precio_unitario"],
            subtotal=subtotal,
            tipo_precio=r.get("tipo_precio", "normal"),
        )

        producto.stock_actual -= r["cantidad"]
        producto.save(update_fields=["stock_actual"])

        MovimientoInventario.objects.create(
            producto=producto,
            usuario=usuario,
            venta=venta,
            tipo_movimiento=MovimientoInventario.TIPO_SALIDA,
            cantidad=r["cantidad"],
            stock_resultante=producto.stock_actual,
            motivo=f"Venta #{venta.pk}",
        )

        total += subtotal

    venta.total = total
    venta.save(update_fields=["total"])
    return venta


@transaction.atomic
def registrar_compra(request, proveedor, nota, renglones, fecha=None):
    """Crea la compra con su detalle, suma el stock, actualiza el último costo y la caducidad,
    y deja un movimiento de entrada por renglón."""
    usuario = _usuario_de_sesion(request)
    compra = Compra.objects.create(
        proveedor=proveedor.strip(),
        nota=(nota or "").strip(),
        usuario=usuario,
        total=Decimal("0"),
        # Si eligieron otro día (ej. capturan hoy una compra de ayer), se respeta con la hora actual
        fecha_compra=(
            timezone.make_aware(datetime.combine(fecha, timezone.localtime().time()))
            if fecha and fecha != timezone.localdate()
            else timezone.now()
        ),
    )
    total = Decimal("0")

    for r in renglones:
        producto = Producto.objects.select_for_update().get(pk=r["producto"].pk)

        if not producto.activo:
            raise ValidationError({"renglones": f"{producto.nombre} está desactivado."})

        subtotal = r["costo_unitario"] * r["cantidad"]
        caducidad = r.get("fecha_caducidad")

        DetalleCompra.objects.create(
            compra=compra,
            producto=producto,
            cantidad=r["cantidad"],
            costo_unitario=r["costo_unitario"],
            fecha_caducidad=caducidad,
            subtotal=subtotal,
        )

        tenia_stock = producto.stock_actual > 0
        producto.stock_actual += r["cantidad"]
        producto.ultimo_costo = r["costo_unitario"]

        # La caducidad que importa es la más próxima: si no tenía stock, manda la nueva
        if caducidad and (not tenia_stock or not producto.fecha_caducidad or caducidad < producto.fecha_caducidad):
            producto.fecha_caducidad = caducidad

        producto.save(update_fields=["stock_actual", "ultimo_costo", "fecha_caducidad"])

        MovimientoInventario.objects.create(
            producto=producto,
            usuario=usuario,
            compra=compra,
            tipo_movimiento=MovimientoInventario.TIPO_ENTRADA,
            cantidad=r["cantidad"],
            stock_resultante=producto.stock_actual,
            motivo=f"Compra #{compra.pk} · {compra.proveedor}",
        )

        total += subtotal

    compra.total = total
    compra.save(update_fields=["total"])
    return compra