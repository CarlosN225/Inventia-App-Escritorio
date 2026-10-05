import os
import sys

from django.apps import AppConfig


class AlertasConfig(AppConfig):
    name = 'alertas'

    def ready(self):
        # No arrancar el scheduler en comandos como migrate, test o shell
        comando = sys.argv[1] if len(sys.argv) > 1 else ''
        if comando in ('migrate', 'makemigrations', 'test', 'shell', 'collectstatic', 'check'):
            return
        # Con runserver + autoreload hay dos procesos; solo el hijo (RUN_MAIN) corre el scheduler
        if comando == 'runserver' and '--noreload' not in sys.argv and os.environ.get('RUN_MAIN') != 'true':
            return
        from . import scheduler
        scheduler.iniciar()
