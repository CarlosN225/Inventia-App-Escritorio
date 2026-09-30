from django.db import models

class Usuario(models.Model):
    ROL_CHOICES = [
        ('propietario', 'Propietario'),
        ('encargado', 'Encargado'),
    ]

    nombre_completo = models.CharField(max_length=120)
    correo = models.EmailField(max_length=150, unique=True)
    contrasena_hash = models.CharField(max_length=255)
    telefono_whatsapp = models.CharField(max_length=20)
    rol = models.CharField(max_length=20, choices=ROL_CHOICES)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nombre_completo} ({self.rol})"