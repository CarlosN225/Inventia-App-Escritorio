from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import Producto, Alerta


@transaction.atomic
def registrar_movimiento(serializer):
    datos = serializer.validated_data
    tipo = datos["tipo"]
    cantidad = datos["cantidad"]

    # Traemos el producto "bloqueado" para que nadie lo modifique al mismo tiempo
    producto = Producto.objects.select_for_update().get(pk=datos["producto"].pk)

    if cantidad <= 0:
        raise ValidationError({"cantidad": "La cantidad debe ser mayor a 0."})

    stock_anterior = producto.cantidad

    if tipo == "ENTRADA":
        producto.cantidad += cantidad
    elif tipo == "SALIDA":
        if cantidad > producto.cantidad:
            raise ValidationError({
                "cantidad": f"No hay suficiente stock. Disponible: {producto.cantidad}."
            })
        producto.cantidad -= cantidad
    else:
        raise ValidationError({"tipo": "Tipo de movimiento no válido."})

    producto.save(update_fields=["cantidad"])
    movimiento = serializer.save()

    # Alerta solo cuando el producto CRUZA el stock mínimo hacia abajo
    estaba_bien = stock_anterior > producto.stock_minimo
    ahora_esta_bajo = producto.cantidad <= producto.stock_minimo

    if estaba_bien and ahora_esta_bajo:
        Alerta.objects.create(
            producto=producto,
            mensaje=(
                f"Stock bajo: {producto.nombre} ({producto.codigo}) "
                f"tiene {producto.cantidad} piezas. Mínimo: {producto.stock_minimo}."
            ),
            enviada_whatsapp=False,
        )
        # Aquí después Héctor conecta Twilio para mandar el WhatsApp
        # y marcar enviada_whatsapp=True cuando sí se envíe.

    return movimiento