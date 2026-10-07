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