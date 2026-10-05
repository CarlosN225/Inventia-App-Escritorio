"""Ajustes del resumen. TODO: cuando Santi pase Configuración a los modelos,
cambiar SOLO esta función para leer telefono_alertas, hora_resumen,
dias_aviso_caducidad y alertas_activas de la base de datos."""

import os
from datetime import time

from django.conf import settings


def obtener_config():
    hora = os.environ.get('INVENTIA_HORA_RESUMEN', '20:00')
    h, m = (int(x) for x in hora.split(':'))
    return {
        'alertas_activas': os.environ.get('INVENTIA_ALERTAS_ACTIVAS', '1') == '1',
        'telefono_alertas': os.environ.get('INVENTIA_TELEFONO_ALERTAS', ''),
        'hora_resumen': time(h, m),
        'dias_aviso_caducidad': int(os.environ.get('INVENTIA_DIAS_AVISO_CADUCIDAD', '30')),
    }
