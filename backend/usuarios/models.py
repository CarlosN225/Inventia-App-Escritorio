from django.db import models

class Usuario(models.Model):
    ROL_PROPIETARIO = "propietario"
    ROL_ENCARGADO = "encargado"
    ROL_CHOICES = [
        (ROL_PROPIETARIO, "Propietario"),
        (ROL_ENCARGADO, "Encargado"),
    ]

    id = models.AutoField(primary_key=True, db_column="id_usuario")
    nombre_completo = models.CharField(max_length=120)
    correo = models.EmailField(max_length=150, unique=True)
    contrasena_hash = models.CharField(max_length=255)
    telefono_whatsapp = models.CharField(max_length=20)
    rol = models.CharField(max_length=20, choices=ROL_CHOICES)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "Usuario"
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"

    def __str__(self):
        return self.nombre_completo


