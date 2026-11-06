from datetime import timedelta
from django.utils import timezone
from .models import AlertaStock
from .correo_alertas import obtener_configuracion, enviar_resumen_hoy, reintentar_pendientes


def revisar_alertas():
    config = obtener_configuracion()
    if not config or not config.alertas_activas:
        return
    ahora = timezone.localtime()
    # Si la computadora estaba apagada a la hora programada, enviar al arrancar.
    if ahora.time().replace(tzinfo=None) >= config.hora_resumen:
        hoy = timezone.localdate()
        registro = AlertaStock.objects.filter(fecha_resumen=hoy).first()
        if not registro or not registro.enviada:
            try: enviar_resumen_hoy()
            except Exception: pass
    # Reintentos solo cada cinco minutos; los fallos permanecen guardados.
    if ahora.minute % 5 == 0:
        reintentar_pendientes()
