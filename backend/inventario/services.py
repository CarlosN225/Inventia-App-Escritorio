from django.db import transaction
from .models import Producto, Movimiento

def registrar_movimiento(producto_id, tipo, cantidad, observaciones=None):
    """
    Registra un movimiento de inventario (Entrada, Salida, Merma, Corrección)
    dentro de una transacción atómica, validando que no quede stock negativo
    y guardando el stock resultante.
    """
    with transaction.atomic():
        # Bloqueamos el producto para evitar conflictos concurrentes
        producto = Producto.objects.select_for_update().get(id=producto_id)
        
        stock_actual = producto.cantidad
        tipo_upper = tipo.upper()
        
        # Calcular el nuevo stock según el tipo de movimiento
        if tipo_upper == 'ENTRADA':
            nuevo_stock = stock_actual + cantidad
        elif tipo_upper == 'SALIDA':
            nuevo_stock = stock_actual - cantidad
        elif tipo_upper == 'MERMA':
            nuevo_stock = stock_actual - cantidad
        elif tipo_upper == 'CORRECCION':
            # En corrección de inventario, la cantidad representa el nuevo stock físico directo
            nuevo_stock = cantidad
        else:
            raise ValueError(f"Tipo de movimiento '{tipo}' no válido.")
            
        # Regla de oro: El stock nunca puede ser negativo
        if nuevo_stock < 0:
            raise ValueError("Operación rechazada: El stock resultante no puede ser negativo.")
            
        # Actualizamos el stock del producto
        producto.cantidad = nuevo_stock
        producto.save()
        
        # Creamos el registro en el historial de movimientos
        movimiento = Movimiento.objects.create(
            producto=producto,
            tipo=tipo_upper,
            cantidad=cantidad,
            stock_resultante=nuevo_stock,
            observaciones=observaciones
        )
        
        return movimiento