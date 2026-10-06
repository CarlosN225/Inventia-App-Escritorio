import uuid
from django.db import migrations


def conservar_historial(apps, schema_editor):
    Usuario = apps.get_model('usuarios', 'Usuario')
    Categoria = apps.get_model('inventario', 'Categoria')
    Producto = apps.get_model('inventario', 'Producto')
    Movimiento = apps.get_model('inventario', 'MovimientoInventario')
    Alerta = apps.get_model('inventario', 'AlertaStock')
    if Movimiento.objects.filter(usuario__isnull=True).exists() or Alerta.objects.filter(usuario__isnull=True).exists():
        # Historical rows did not store an author. Never attribute them to a real person.
        historico, _ = Usuario.objects.get_or_create(correo='historico@inventia.invalid', defaults={
            'nombre_completo': 'Autor no registrado (histórico)', 'rol': 'encargado',
            'activo': False, 'contrasena_hash': '!', 'telefono_whatsapp': ''})
        Movimiento.objects.filter(usuario__isnull=True).update(usuario=historico)
        Alerta.objects.filter(usuario__isnull=True).update(usuario=historico)
    if Producto.objects.filter(categoria__isnull=True).exists():
        categoria, _ = Categoria.objects.get_or_create(nombre='Sin categoría', defaults={'activa': True})
        Producto.objects.filter(categoria__isnull=True).update(categoria=categoria)
    for p in Producto.objects.all():
        saldo = p.stock_actual
        for m in Movimiento.objects.filter(producto=p).order_by('-fecha_movimiento', '-pk'):
            tipo = {'ENTRADA': 'entrada', 'SALIDA': 'salida'}.get(m.tipo_movimiento, m.tipo_movimiento)
            m.tipo_movimiento = tipo
            m.stock_resultante = saldo
            if saldo < 0:
                raise ValueError('Historial con stock negativo: revisar antes de migrar.')
            m.save(update_fields=['tipo_movimiento', 'stock_resultante'])
            saldo -= m.cantidad if tipo == 'entrada' else -m.cantidad
    for a in Alerta.objects.all():
        a.uuid_local = str(uuid.uuid4())
        a.nivel_stock = Producto.objects.get(pk=a.producto_id).stock_actual
        a.save(update_fields=['uuid_local', 'nivel_stock'])

class Migration(migrations.Migration):
    dependencies = [('inventario', '0003_compra_configuracion_detallecompra_detalleventa_and_more')]
    operations = [migrations.RunPython(conservar_historial, migrations.RunPython.noop)]
