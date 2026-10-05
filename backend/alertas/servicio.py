"""Cola de resúmenes: guardar primero, enviar después, reintentar si falla."""

import threading
from datetime import datetime, timedelta

from django.utils import timezone

from . import resumen as resumen_mod
from .config import obtener_config
from .models import AlertaStock
from .twilio_cliente import ErrorEnvio, SinConexion, enviar_whatsapp

REINTENTO_MINUTOS = 5

# Un solo proceso Django: este candado evita que el scheduler y el botón manden el mismo resumen a la vez
_candado = threading.Lock()
_ultimo_intento = None


class AlertaError(Exception):
    def __init__(self, codigo, detalle=''):
        super().__init__(codigo)
        self.codigo = codigo
        self.detalle = detalle


def _intentar(alerta):
    """Intenta mandar una alerta ya guardada. Devuelve True si salió."""
    global _ultimo_intento
    _ultimo_intento = timezone.now()
    if alerta.enviada:
        return True
    try:
        enviar_whatsapp(obtener_config()['telefono_alertas'], alerta.mensaje)
    except SinConexion as e:
        alerta.ultimo_error = 'sin_conexion'
        alerta.save(update_fields=['ultimo_error'])
        raise AlertaError('sin_conexion', str(e))
    except ErrorEnvio as e:
        alerta.ultimo_error = str(e)[:255]
        alerta.save(update_fields=['ultimo_error'])
        raise AlertaError('error_envio', str(e))
    alerta.enviada = True
    alerta.fecha_envio = timezone.now()
    alerta.ultimo_error = ''
    alerta.save(update_fields=['enviada', 'fecha_envio', 'ultimo_error'])
    return True


def _guardar_del_dia(hoy):
    datos = resumen_mod.calcular(hoy)
    mensaje = resumen_mod.armar_mensaje(datos)
    alerta, creada = AlertaStock.objects.get_or_create(fecha_resumen=hoy, defaults={'mensaje': mensaje})
    if not creada and not alerta.enviada and alerta.mensaje != mensaje:
        alerta.mensaje = mensaje  # sigue pendiente: lo ponemos al día con el inventario actual
        alerta.save(update_fields=['mensaje'])
    return alerta


def enviar_ahora():
    """Botón 'Enviar ahora'. Lanza AlertaError si no se pudo."""
    with _candado:
        hoy = timezone.localdate()
        existente = AlertaStock.objects.filter(fecha_resumen=hoy, enviada=True).first()
        if existente:
            raise AlertaError('ya_enviado')
        alerta = _guardar_del_dia(hoy)  # queda guardado aunque falle el envío
        _intentar(alerta)
        return alerta


def enviar_prueba(telefono=None):
    telefono = telefono or obtener_config()['telefono_alertas']
    try:
        enviar_whatsapp(telefono, 'INVENTIA: mensaje de prueba. Si lo lees, el resumen diario llegará a este número.')
    except SinConexion as e:
        raise AlertaError('sin_conexion', str(e))
    except ErrorEnvio as e:
        raise AlertaError('error_envio', str(e))


def proximo_envio(ahora=None):
    ahora = timezone.localtime(ahora or timezone.now())
    hora = obtener_config()['hora_resumen']
    hoy = ahora.date()
    ya_hoy = AlertaStock.objects.filter(fecha_resumen=hoy, enviada=True).exists()
    dia = hoy if (ahora.time() < hora and not ya_hoy) else hoy + timedelta(days=1)
    return timezone.make_aware(datetime.combine(dia, hora))


def revisar():
    """La llama el scheduler cada minuto. Crea el resumen del día si ya toca y reintenta pendientes."""
    cfg = obtener_config()
    if not cfg['alertas_activas']:
        return
    with _candado:
        ahora = timezone.localtime()
        hoy = ahora.date()

        # Ya toca (o la compu estaba apagada a esa hora): guardar el resumen del día si no existe
        if ahora.time() >= cfg['hora_resumen'] and not AlertaStock.objects.filter(fecha_resumen=hoy).exists():
            _guardar_del_dia(hoy)
            hay_nuevo = True
        else:
            hay_nuevo = False

        # Reintento: lo recién guardado se intenta ya; lo viejo, cada 5 minutos
        toca_reintento = (
            hay_nuevo or _ultimo_intento is None
            or timezone.now() - _ultimo_intento >= timedelta(minutes=REINTENTO_MINUTOS)
        )
        if not toca_reintento:
            return
        for alerta in AlertaStock.objects.filter(enviada=False).order_by('fecha_resumen'):
            try:
                _intentar(alerta)
            except AlertaError as e:
                if e.codigo == 'sin_conexion':
                    break  # sin internet no tiene caso probar los demás
