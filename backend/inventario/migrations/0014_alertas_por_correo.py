from django.db import migrations, models


def usar_correo_del_propietario(apps, schema_editor):
    Configuracion = apps.get_model("inventario", "Configuracion")
    for config in Configuracion.objects.select_related("negocio__usuario_admin").all():
        correo = config.negocio.usuario_admin.correo
        if correo:
            Configuracion.objects.filter(pk=config.pk).update(correo_alertas=correo)


def limpiar_historial_anterior(apps, schema_editor):
    # Los registros anteriores guardaban mensajes ya enviados por el proveedor anterior.
    apps.get_model("inventario", "AlertaStock").objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [("inventario", "0013_alertastock_resumen_whatsapp")]

    operations = [
        migrations.AddField(
            model_name="configuracion",
            name="correo_alertas",
            field=models.EmailField(blank=True, default="", max_length=150),
        ),
        migrations.RunPython(usar_correo_del_propietario, migrations.RunPython.noop),
        migrations.RunPython(limpiar_historial_anterior, migrations.RunPython.noop),
        migrations.RemoveField(model_name="configuracion", name="telefono_alertas"),
        migrations.RemoveField(model_name="configuracion", name="contacto_alertas"),
    ]
