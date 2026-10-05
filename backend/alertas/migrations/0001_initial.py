from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='AlertaStock',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('fecha_resumen', models.DateField(unique=True)),
                ('mensaje', models.TextField()),
                ('enviada', models.BooleanField(default=False)),
                ('fecha_envio', models.DateTimeField(blank=True, null=True)),
                ('fecha_creacion', models.DateTimeField(auto_now_add=True)),
                ('ultimo_error', models.CharField(blank=True, default='', max_length=255)),
            ],
        ),
    ]
