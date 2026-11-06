"""Lo que corre solo cada minuto mientras INVENTIA está abierto."""
import logging

from django.utils import timezone

from .correo_alertas import obtener_configuracion, reintentar_pendientes, revisar_hoy

logger = logging.getLogger("inventia.alertas")


def revisar_alertas():
    config = obtener_configuracion()
    if not config or not config.alertas_activas:
        return

    ahora = timezone.localtime()

    # A la hora elegida (o al prender la compu, si ya pasó) se hace la revisión del día.
    # revisar_hoy() decide si de verdad hay que escribir: la regla de oro vive ahí.
    if ahora.time().replace(tzinfo=None) >= config.hora_resumen:
        try:
            revisar_hoy()
        except Exception:
            logger.exception("Falló la revisión diaria de alertas")

    # Si algo de hoy quedó pendiente, se reintenta cada cinco minutos
    if ahora.minute % 5 == 0:
        try:
            reintentar_pendientes()
        except Exception:
            logger.exception("Falló el reintento de alertas")
