"""
Cada venta guarda el costo del producto en ese momento, para que su ganancia
no cambie cuando después llegan compras a otro precio.
Las ventas que ya existían se llenan con el último costo conocido.
"""
from django.db import migrations, models


def llenar_costos(apps, schema_editor):
    DetalleVenta = apps.get_model("inventario", "DetalleVenta")

    for detalle in DetalleVenta.objects.select_related("producto").filter(costo_unitario__isnull=True):
        costo = detalle.producto.ultimo_costo
        if costo and costo > 0:
            detalle.costo_unitario = costo
            detalle.save(update_fields=["costo_unitario"])


class Migration(migrations.Migration):

    dependencies = [
        ("inventario", "0011_producto_actualizado_en"),
    ]

    operations = [
        migrations.AddField(
            model_name="detalleventa",
            name="costo_unitario",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.RunPython(llenar_costos, migrations.RunPython.noop),
    ]