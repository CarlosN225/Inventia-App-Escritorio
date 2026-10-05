import atexit
import logging

from apscheduler.schedulers.background import BackgroundScheduler

log = logging.getLogger(__name__)
_scheduler = None


def _tarea():
    from . import servicio
    try:
        servicio.revisar()
    except Exception:
        log.exception('Fallo al revisar el resumen de WhatsApp')


def iniciar():
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler()
    # Cada minuto; max_instances=1 evita traslapes. next_run_time=ahora cubre "compu prendida tarde".
    from datetime import datetime
    _scheduler.add_job(_tarea, 'interval', minutes=1, max_instances=1, coalesce=True,
                       next_run_time=datetime.now(), id='resumen_whatsapp')
    _scheduler.start()
    atexit.register(lambda: _scheduler.shutdown(wait=False))
