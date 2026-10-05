from django.db import models


class AlertaStock(models.Model):
    """Un resumen diario de WhatsApp. Se guarda ANTES de mandarlo para no perderlo
    si no hay internet; `fecha_resumen` es única para no mandar dos el mismo día."""

    fecha_resumen = models.DateField(unique=True)
    mensaje = models.TextField()
    enviada = models.BooleanField(default=False)
    fecha_envio = models.DateTimeField(null=True, blank=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    ultimo_error = models.CharField(max_length=255, blank=True, default='')

    def __str__(self):
        return f"Resumen {self.fecha_resumen} - enviada: {self.enviada}"
