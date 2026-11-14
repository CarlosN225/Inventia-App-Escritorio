"""
Código de recuperación del propietario.

- Se genera al crear la cuenta (asistente inicial) o desde Mi perfil.
- Se muestra UNA sola vez; se guarda cifrado (igual que la contraseña).
- Con él, el propietario cambia su contraseña desde el login, sin internet y sin ayuda.
"""
import secrets

from django.contrib.auth.hashers import check_password, make_password
from django.core.cache import cache

# Sin letras ni números que se confunden al copiarlos a mano (O/0, I/1, L)
ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
MAX_INTENTOS = 5
MINUTOS_BLOQUEO = 15


def generar_codigo():
    """Ej. 'K7P2-M9QX-4TRW'."""
    letras = "".join(secrets.choice(ALFABETO) for _ in range(12))
    return f"{letras[0:4]}-{letras[4:8]}-{letras[8:12]}"


def normalizar(codigo):
    """Acepta minúsculas, espacios o sin guiones: 'k7p2 m9qx 4trw' == 'K7P2-M9QX-4TRW'."""
    return "".join(c for c in str(codigo or "").upper() if c.isalnum())


def cifrar(codigo):
    return make_password(normalizar(codigo))


def coincide(codigo, codigo_hash):
    return bool(codigo_hash) and check_password(normalizar(codigo), codigo_hash)


def asignar_codigo_nuevo(usuario):
    """Le pone un código nuevo al usuario (sin guardar) y regresa el código en claro."""
    codigo = generar_codigo()
    usuario.codigo_recuperacion_hash = cifrar(codigo)
    return codigo


# ---------- Freno a quien intente adivinar códigos ----------

def _llave(correo):
    return f"inventia:recuperar:{(correo or '').strip().lower()}"


def bloqueado(correo):
    return cache.get(_llave(correo), 0) >= MAX_INTENTOS


def registrar_fallo(correo):
    llave = _llave(correo)
    cache.set(llave, cache.get(llave, 0) + 1, MINUTOS_BLOQUEO * 60)


def limpiar_fallos(correo):
    cache.delete(_llave(correo))
