from django.db import migrations, models


def llenar_contacto(apps, schema_editor):
    """En las bases que ya existían, el WhatsApp de alertas queda a nombre del dueño."""
    Configuracion = apps.get_model("inventario", "Configuracion")

    for config in Configuracion.objects.select_related("negocio__usuario_admin"):
        if not config.contacto_alertas:
            admin = config.negocio.usuario_admin
            config.contacto_alertas = admin.nombre_completo if admin else (config.negocio.propietario or "")
            config.save(update_fields=["contacto_alertas"])


class Migration(migrations.Migration):

    dependencies = [
        ("inventario", "0007_categorias_fijas"),
    ]

    operations = [
        migrations.AddField(
            model_name="configuracion",
            name="contacto_alertas",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.RunPython(llenar_contacto, migrations.RunPython.noop),
    ]