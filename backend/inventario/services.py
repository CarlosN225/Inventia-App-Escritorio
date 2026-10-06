from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import Producto, Alerta
from usuarios.models import Usuario


@transaction.atomic
def registrar_movimiento(serializer):
    datos = serializer.validated_data
    tipo = datos["tipo_movimiento"]
    cantidad = datos["cantidad"]

    # Traemos el producto "bloqueado" para que nadie lo modifique al mismo tiempo
    producto = Producto.objects.select_for_update().get(pk=datos["producto"].pk)

    if cantidad <= 0:
        raise ValidationError({"cantidad": "La cantidad debe ser mayor a 0."})

    stock_anterior = producto.stock_actual

    if tipo == "entrada":
        producto.stock_actual += cantidad
    elif tipo == "salida":
        if cantidad > producto.stock_actual:
            raise ValidationError({
                "cantidad": f"No hay suficiente stock. Disponible: {producto.stock_actual}."
            })
        producto.stock_actual -= cantidad
    else:
        raise ValidationError({"tipo": "Tipo de movimiento no válido."})

    producto.save(update_fields=["stock_actual"])
    # El DER requiere autor y saldo. Se toman de la sesión y del stock calculado.
    usuario = Usuario.objects.get(pk=serializer.context['request'].session['id_usuario'])
    movimiento = serializer.save(usuario=usuario, stock_resultante=producto.stock_actual)

    # Alerta solo cuando el producto CRUZA el stock mínimo hacia abajo
    estaba_bien = stock_anterior > producto.stock_minimo
    ahora_esta_bajo = producto.stock_actual <= producto.stock_minimo

    if estaba_bien and ahora_esta_bajo:
        Alerta.objects.create(
            producto=producto,
            usuario=usuario,
            nivel_stock=producto.stock_actual,
            mensaje=(
                f"Stock bajo: {producto.nombre} ({producto.codigo_barras}) "
                f"tiene {producto.stock_actual} piezas. Mínimo: {producto.stock_minimo}."
            ),
            enviada=False,
        )
        # Aquí después Héctor conecta Twilio para mandar el WhatsApp
        # y marcar enviada=True cuando sí se envíe.

    return movimiento