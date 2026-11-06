from django.db import migrations, models


class Migration(migrations.Migration):
    """Avisos por correo sin spam: se guarda por qué se generó cada aviso y qué
    riesgos había, y se permite más de un registro por día (botón "Enviar ahora")."""

    dependencies = [("inventario", "0014_alertas_por_correo")]

    operations = [
        migrations.AddField(
            model_name="alertastock",
            name="motivo",
            field=models.CharField(blank=True, default="", max_length=15),
        ),
        migrations.AddField(
            model_name="alertastock",
            name="firma",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AlterField(
            model_name="alertastock",
            name="fecha_resumen",
            field=models.DateField(db_index=True),
        ),
    ]
