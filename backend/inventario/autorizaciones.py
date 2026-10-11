"""
PIN del propietario y autorizaciones de precio.

- El PIN se guarda cifrado (como las contraseñas).
- 3 intentos fallidos lo bloquean 5 minutos.
- Una autorización es un "sello" firmado por el backend: sirve solo para un producto,
  a un precio, y vence en 10 minutos. Nadie la puede inventar ni modificar.
"""
from datetime import timedelta
from decimal import Decimal
from math import ceil

from django.contrib.auth.hashers import check_password
from django.core import signing
from django.utils import timezone

SAL = "inventia.autorizacion.precio"
VIGENCIA_SEGUNDOS = 30 * 60
MAX_INTENTOS = 3
BLOQUEO = timedelta(minutes=5)

MOTIVOS_PRECIO = [
    "Descuento a cliente frecuente",
    "Producto con detalle",
    "Ajuste de precio",
    "Otro",
]



def motivo_valido(motivo):
    """Uno de los motivos fijos, o "Otro: <lo que escribieron>" (mínimo 3 letras)."""
    if motivo in MOTIVOS_PRECIO and motivo != "Otro":
        return True
    return motivo.startswith("Otro: ") and len(motivo[6:].strip()) >= 3 and len(motivo) <= 120


def pin_con_formato(pin):
    return isinstance(pin, str) and pin.isdigit() and len(pin) == 4

def verificar_pin(config, pin):
    """Revisa el PIN. Devuelve (correcto, mensaje, bloqueado). Lleva la cuenta de intentos y el bloqueo."""
    ahora = timezone.now()

    if config.pin_bloqueado_hasta and config.pin_bloqueado_hasta > ahora:
        minutos = ceil((config.pin_bloqueado_hasta - ahora).total_seconds() / 60)
        return False, f"El PIN está bloqueado por seguridad. Intenta de nuevo en {minutos} min.", True

    if not config.pin_hash:
        return False, "El propietario todavía no configura su PIN.", False

    if check_password(str(pin), config.pin_hash):
        config.pin_intentos_fallidos = 0
        config.pin_bloqueado_hasta = None
        config.save(update_fields=["pin_intentos_fallidos", "pin_bloqueado_hasta"])
        return True, "", False

    config.pin_intentos_fallidos += 1

    if config.pin_intentos_fallidos >= MAX_INTENTOS:
        config.pin_intentos_fallidos = 0
        config.pin_bloqueado_hasta = ahora + BLOQUEO
        config.save(update_fields=["pin_intentos_fallidos", "pin_bloqueado_hasta"])
        return False, "PIN incorrecto 3 veces. Por seguridad se bloqueó 5 minutos.", True

    config.save(update_fields=["pin_intentos_fallidos"])
    restantes = MAX_INTENTOS - config.pin_intentos_fallidos
    return (
        False,
        f"PIN incorrecto. Te {'queda' if restantes == 1 else 'quedan'} {restantes} {'intento' if restantes == 1 else 'intentos'}.",
        False,
    )

def firmar_autorizacion(producto_id, precio, motivo, autorizo_id):
    precio = Decimal(precio).quantize(Decimal("0.01"))
    return signing.dumps({"p": producto_id, "precio": str(precio), "m": motivo, "a": autorizo_id}, salt=SAL)


def leer_autorizacion(token):
    """Devuelve los datos del sello, o None si es falso o ya venció."""
    try:
        return signing.loads(token or "", salt=SAL, max_age=VIGENCIA_SEGUNDOS)
    except signing.BadSignature:  # incluye cuando ya venció
        return None