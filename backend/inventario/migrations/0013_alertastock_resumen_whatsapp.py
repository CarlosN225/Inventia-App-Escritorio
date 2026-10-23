from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("inventario", "0012_costo_en_venta")]
    operations = [
        migrations.CreateModel(
            name="AlertaStock",
            fields=[
                ("id", models.AutoField(primary_key=True, serialize=False)),
                ("fecha_resumen", models.DateField(unique=True)),
                ("mensaje", models.TextField()),
                ("enviada", models.BooleanField(default=False)),
                ("fecha_generacion", models.DateTimeField(auto_now_add=True)),
                ("fecha_envio", models.DateTimeField(blank=True, null=True)),
                ("ultimo_error", models.CharField(blank=True, default="", max_length=255)),
            ],
            options={"db_table": "AlertaStock", "ordering": ["-fecha_generacion"],
                     "verbose_name": "Alerta de stock", "verbose_name_plural": "Alertas de stock"},
        ),
    ]
