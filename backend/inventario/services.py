from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import Producto
from usuarios.models import Usuario


@transaction.atomic
def registrar_movimiento(serializer):
    """Registra un movimiento y actualiza el stock del producto en una sola transacción.
    Las alertas ya no se guardan aquí: el resumen diario las calcula en vivo (app alertas).
    TODO (Santi): agregar los tipos merma y corrección."""
    datos = serializer.validated_data
    tipo = datos["tipo_movimiento"]
    cantidad = datos["cantidad"]

    # Traemos el producto "bloqueado" para que nadie lo modifique al mismo tiempo
    producto = Producto.objects.select_for_update().get(pk=datos["producto"].pk)

    if cantidad <= 0:
        raise ValidationError({"cantidad": "La cantidad debe ser mayor a 0."})

    if tipo == "entrada":
        producto.stock_actual += cantidad
    elif tipo == "salida":
        if cantidad > producto.stock_actual:
            raise ValidationError({
                "cantidad": f"No hay suficiente stock. Disponible: {producto.stock_actual}."
            })
        producto.stock_actual -= cantidad
    else:
        raise ValidationError({"tipo_movimiento": "Tipo de movimiento no válido."})

    producto.save(update_fields=["stock_actual"])

    # El DER requiere autor y saldo: se toman de la sesión y del stock calculado
    usuario = Usuario.objects.get(pk=serializer.context["request"].session["id_usuario"])
    return serializer.save(usuario=usuario, stock_resultante=producto.stock_actual)