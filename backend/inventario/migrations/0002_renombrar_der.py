from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [("inventario", "0001_initial")]
    operations = [
        migrations.RenameModel("Movimiento", "MovimientoInventario"),
        migrations.RenameModel("Alerta", "AlertaStock"),
        migrations.RenameField("producto", "codigo", "codigo_barras"),
        migrations.RenameField("producto", "cantidad", "stock_actual"),
        migrations.RenameField("movimientoinventario", "tipo", "tipo_movimiento"),
        migrations.RenameField("movimientoinventario", "fecha", "fecha_movimiento"),
        migrations.RenameField("movimientoinventario", "observaciones", "motivo"),
        migrations.RenameField("alertastock", "fecha_creacion", "fecha_generacion"),
        migrations.RenameField("alertastock", "enviada_whatsapp", "enviada"),
    ]
