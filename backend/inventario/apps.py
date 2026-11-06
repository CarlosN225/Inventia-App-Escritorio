import os
from django.apps import AppConfig


class InventarioConfig(AppConfig):
    name = 'inventario'

    def ready(self):
        # Evita arrancar dos schedulers con el autoreloader de Django.
        from django.conf import settings
        if settings.DEBUG and os.environ.get('RUN_MAIN') != 'true':
            return
        if os.environ.get('DISABLE_ALERTAS_SCHEDULER') == '1':
            return
        try:
            from apscheduler.schedulers.background import BackgroundScheduler
            from django.conf import settings
            from .alertas_scheduler import revisar_alertas
            scheduler = BackgroundScheduler(timezone=settings.TIME_ZONE)
            scheduler.add_job(revisar_alertas, 'interval', minutes=1, id='inventia_alertas',
                              max_instances=1, coalesce=True, replace_existing=True)
            scheduler.start()
        except Exception:
            # El backend sigue iniciando aunque el scheduler no pueda arrancar.
            pass
