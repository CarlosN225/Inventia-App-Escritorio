"""
Respaldos de Inventia.

- Un respaldo es un .zip con la base (inventia.sqlite3) y una ficha (respaldo.json).
- Se copia con la API de respaldo de SQLite: es seguro aunque Inventia esté abierto.
- Automático: uno diario (se guardan los últimos 10) y uno por correo cada viernes en la noche.
- Manual: a la carpeta elegida, a una USB (opcional) o al correo del propietario.
- Restaurar: revisa que el archivo sea de Inventia, guarda antes una copia de lo actual,
  copia el respaldo encima de la base y actualiza las tablas si el respaldo era de una versión anterior.
"""
import json
import os
import re
import shutil
import sqlite3
import string
import sys
import tempfile
import zipfile
from datetime import datetime, timedelta
from pathlib import Path

from django.core.management import call_command
from django.db import connection
from django.utils import timezone

VERSION_APP = "1.1.0"
NOMBRE_DB = "inventia.sqlite3"
NOMBRE_FICHA = "respaldo.json"
CARPETA_DEFECTO = "Inventia Respaldos"
CARPETA_USB = "Respaldos Inventia"
CONSERVAR_AUTOMATICOS = 10
TIPOS = {"auto": "automático", "manual": "manual", "usb": "USB", "correo": "correo", "previo": "antes de restaurar"}
PATRON = re.compile(r"^Inventia_respaldo_(\d{4}-\d{2}-\d{2})_(\d{2})(\d{2})_([a-z]+)(?:-\d+)?\.zip$")

# Viernes 20:00 (hora local): a partir de ahí se manda el respaldo semanal por correo
DIA_CORREO = 4
HORA_CORREO = 20


class RespaldoInvalido(Exception):
    """El archivo no es un respaldo de Inventia (o está dañado)."""


# ---------------------------------------------------------------------------
# Carpetas
# ---------------------------------------------------------------------------

def _documentos():
    """La carpeta Documentos real (en Windows puede estar movida a OneDrive)."""
    if sys.platform == "win32":
        try:
            import ctypes
            from ctypes import wintypes
            ruta = ctypes.create_unicode_buffer(wintypes.MAX_PATH)
            if ctypes.windll.shell32.SHGetFolderPathW(None, 5, None, 0, ruta) == 0 and Path(ruta.value).is_dir():
                return Path(ruta.value)  # 5 = CSIDL_PERSONAL (Documentos)
        except Exception:
            pass
    for candidato in (Path.home() / "Documents", Path.home() / "Documentos"):
        if candidato.is_dir():
            return candidato
    return Path.home()


def _raiz():
    """C:\\Inventia Respaldos en Windows (junto a C:\\Inventia); fácil de encontrar en una visita."""
    if sys.platform != "win32":
        return None
    return Path(os.environ.get("SystemDrive", "C:") + "\\") / CARPETA_DEFECTO


def carpeta_por_defecto():
    raiz = _raiz()
    if raiz is not None:
        try:
            raiz.mkdir(parents=True, exist_ok=True)
            return raiz
        except OSError:
            pass  # sin permiso en la raíz (ej. compu de oficina): se usa Documentos
    return _documentos() / CARPETA_DEFECTO


def carpeta_actual(config=None):
    if config and config.carpeta_respaldo:
        return Path(config.carpeta_respaldo)
    return carpeta_por_defecto()


def carpetas_sugeridas():
    """La de siempre (C:\\Inventia Respaldos), Documentos, y OneDrive / Google Drive si la compu los tiene."""
    sugeridas = []
    raiz = _raiz()
    if raiz is not None:
        sugeridas.append({"nombre": "Disco C:", "ruta": str(raiz), "nube": False})
    sugeridas.append({"nombre": "Documentos", "ruta": str(_documentos() / CARPETA_DEFECTO), "nube": False})

    vistos = set()
    for variable in ("OneDrive", "OneDriveConsumer", "OneDriveCommercial"):
        base = os.environ.get(variable)
        if base and Path(base).is_dir() and base not in vistos:
            vistos.add(base)
            sugeridas.append({"nombre": "OneDrive", "ruta": str(Path(base) / CARPETA_DEFECTO), "nube": True})

    posibles_drive = [Path.home() / "Google Drive", Path.home() / "Google Drive" / "Mi unidad",
                      Path.home() / "Google Drive" / "My Drive"]
    if sys.platform == "win32":
        for letra in string.ascii_uppercase:
            posibles_drive += [Path(f"{letra}:/Mi unidad"), Path(f"{letra}:/My Drive")]
    for base in posibles_drive:
        try:
            if base.is_dir() and (base.name in ("Mi unidad", "My Drive") or not (base / "Mi unidad").is_dir()):
                sugeridas.append({"nombre": "Google Drive", "ruta": str(base / CARPETA_DEFECTO), "nube": True})
                break
        except OSError:
            continue

    return sugeridas


def validar_carpeta(ruta):
    """Crea la carpeta si no existe y prueba que se pueda escribir. Regresa el Path."""
    carpeta = Path(str(ruta).strip()).expanduser()
    if not str(ruta).strip() or not carpeta.is_absolute():
        raise ValueError("Escribe la ruta completa de la carpeta (ej. C:\\Users\\Tu\\Documents\\Inventia Respaldos)")
    try:
        carpeta.mkdir(parents=True, exist_ok=True)
        prueba = carpeta / ".prueba_inventia"
        prueba.write_text("ok", encoding="utf-8")
        prueba.unlink()
    except OSError:
        raise ValueError("No se puede guardar en esa carpeta. Elige otra.")
    return carpeta


def unidades_usb():
    """Letras de las USB conectadas (solo Windows). Ej. ['E:']"""
    if sys.platform != "win32":
        return []
    try:
        import ctypes
        bits = ctypes.windll.kernel32.GetLogicalDrives()
        unidades = []
        for i, letra in enumerate(string.ascii_uppercase):
            if bits & (1 << i) and ctypes.windll.kernel32.GetDriveTypeW(f"{letra}:\\") == 2:  # 2 = extraíble
                unidades.append(f"{letra}:")
        return unidades
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Crear
# ---------------------------------------------------------------------------

def _ultimas_migraciones():
    with connection.cursor() as cursor:
        cursor.execute("SELECT app, name FROM django_migrations ORDER BY id")
        filas = cursor.fetchall()
    ultimas = {}
    for app, nombre in filas:
        ultimas[app] = nombre
    return ultimas


def _ficha(tipo):
    from .models import Negocio
    negocio = Negocio.objects.order_by("id").first()
    return {
        "app": "Inventia",
        "version": VERSION_APP,
        "tipo": tipo,
        "fecha": timezone.localtime().isoformat(timespec="seconds"),
        "negocio": negocio.nombre if negocio else "",
        "migraciones": _ultimas_migraciones(),
    }


def _copiar_base_a(destino):
    """Copia la base viva a un archivo con la API de respaldo de SQLite."""
    connection.ensure_connection()
    copia = sqlite3.connect(str(destino))
    try:
        connection.connection.backup(copia)
    finally:
        copia.close()


def nombre_archivo(tipo, cuando=None):
    cuando = cuando or timezone.localtime()
    return f"Inventia_respaldo_{cuando:%Y-%m-%d_%H%M}_{tipo}.zip"


def crear_respaldo(carpeta, tipo="manual"):
    """Hace el .zip en la carpeta dada y regresa su ruta."""
    carpeta = Path(carpeta)
    carpeta.mkdir(parents=True, exist_ok=True)
    destino = carpeta / nombre_archivo(tipo)
    # Si ya hay uno del mismo minuto, se le agrega un número
    n = 2
    while destino.exists():
        destino = carpeta / nombre_archivo(tipo).replace(".zip", f"-{n}.zip")
        n += 1

    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp) / NOMBRE_DB
        _copiar_base_a(base)
        with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as z:
            z.write(base, NOMBRE_DB)
            z.writestr(NOMBRE_FICHA, json.dumps(_ficha(tipo), ensure_ascii=False, indent=2))
    return destino


def podar_automaticos(carpeta, conservar=CONSERVAR_AUTOMATICOS):
    """Borra los automáticos más viejos; los manuales no se tocan."""
    automaticos = sorted(Path(carpeta).glob("Inventia_respaldo_*_auto*.zip"), key=lambda p: p.name, reverse=True)
    for viejo in automaticos[conservar:]:
        try:
            viejo.unlink()
        except OSError:
            pass


def listar(carpeta):
    carpeta = Path(carpeta)
    if not carpeta.is_dir():
        return []
    respaldos = []
    for archivo in carpeta.glob("Inventia_respaldo_*.zip"):
        m = PATRON.match(archivo.name)
        if not m:
            continue
        fecha, hora, minuto, tipo = m.groups()
        try:
            tamano = archivo.stat().st_size
        except OSError:
            continue
        cuando = timezone.make_aware(datetime.strptime(f"{fecha} {hora}:{minuto}", "%Y-%m-%d %H:%M"))
        respaldos.append({
            "archivo": archivo.name,
            "tipo": tipo,
            "tipo_texto": TIPOS.get(tipo, tipo),
            "fecha": cuando.isoformat(),
            "tamano_kb": max(1, round(tamano / 1024)),
        })
    respaldos.sort(key=lambda r: r["fecha"], reverse=True)
    return respaldos


def ultimo_automatico(carpeta):
    for r in listar(carpeta):
        if r["tipo"] == "auto":
            return r
    return None


# ---------------------------------------------------------------------------
# Revisar y restaurar
# ---------------------------------------------------------------------------

def leer_respaldo(origen, carpeta_tmp):
    """Valida el .zip y regresa (ruta_de_la_base_extraída, ficha)."""
    try:
        with zipfile.ZipFile(origen) as z:
            nombres = set(z.namelist())
            if NOMBRE_DB not in nombres or NOMBRE_FICHA not in nombres:
                raise RespaldoInvalido("Ese archivo no es un respaldo de Inventia.")
            ficha = json.loads(z.read(NOMBRE_FICHA).decode("utf-8"))
            if ficha.get("app") != "Inventia":
                raise RespaldoInvalido("Ese archivo no es un respaldo de Inventia.")
            z.extract(NOMBRE_DB, carpeta_tmp)
    except (zipfile.BadZipFile, json.JSONDecodeError, KeyError, UnicodeDecodeError):
        raise RespaldoInvalido("El archivo está dañado o no es un respaldo de Inventia.")

    base = Path(carpeta_tmp) / NOMBRE_DB
    try:
        prueba = sqlite3.connect(str(base))
        try:
            if prueba.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise RespaldoInvalido("El respaldo está dañado.")
            tablas = {f[0] for f in prueba.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        finally:
            prueba.close()
    except sqlite3.DatabaseError:
        raise RespaldoInvalido("El respaldo está dañado.")

    if not {"Usuario", "Producto", "django_migrations"} <= tablas:
        raise RespaldoInvalido("Ese archivo no es un respaldo de Inventia.")
    return base, ficha


def restaurar(origen, carpeta_previa=None):
    """
    Restaura el respaldo `origen` (ruta o archivo subido) sobre la base actual.
    Antes deja una copia de lo actual en `carpeta_previa` (si se da y hay datos).
    Regresa la ficha del respaldo restaurado.
    """
    with tempfile.TemporaryDirectory() as tmp:
        # Si viene de una subida, primero se guarda en disco
        if hasattr(origen, "read"):
            ruta_zip = Path(tmp) / "subido.zip"
            with open(ruta_zip, "wb") as destino:
                shutil.copyfileobj(origen, destino)
            origen = ruta_zip

        base, ficha = leer_respaldo(origen, tmp)

        if carpeta_previa is not None:
            crear_respaldo(carpeta_previa, tipo="previo")

        # Copia el respaldo encima de la base viva (sin cerrar la app)
        connection.ensure_connection()
        if connection.in_atomic_block:
            raise RuntimeError("No se puede restaurar dentro de una transacción")
        fuente = sqlite3.connect(str(base))
        try:
            fuente.backup(connection.connection)
        finally:
            fuente.close()

    # Si el respaldo es de una versión anterior, se le agregan las tablas nuevas
    call_command("migrate", interactive=False, verbosity=0)
    return ficha


# ---------------------------------------------------------------------------
# Correo
# ---------------------------------------------------------------------------

def enviar_por_correo(config, carpeta=None):
    """Hace un respaldo y lo manda al correo del propietario (Brevo). Regresa el correo destino."""
    from django.conf import settings
    from usuarios.models import Usuario
    from .correo_alertas import CorreoConLogo

    if not getattr(settings, "BREVO_SMTP_LOGIN", "") or not getattr(settings, "BREVO_SMTP_KEY", ""):
        raise RuntimeError("brevo_no_configurado")

    duena = Usuario.objects.filter(rol=Usuario.ROL_PROPIETARIO, activo=True).order_by("id").first()
    destino = (config.correo_alertas if config else "") or (duena.correo if duena else "")
    if not destino:
        raise ValueError("correo_no_configurado")

    with tempfile.TemporaryDirectory() as tmp:
        archivo = crear_respaldo(carpeta or tmp, tipo="correo")
        negocio = config.negocio.nombre if config else "tu dulcería"
        hoy = timezone.localtime()
        texto = (
            f"Hola,\n\nTe enviamos el respaldo de Inventia de {negocio} del {hoy:%d/%m/%Y a las %H:%M}.\n\n"
            "Guárdalo: si tu computadora se descompone o la cambias, con este archivo recuperas tu información "
            "(Configuración > Respaldos > Restaurar, o desde la primera pantalla en una instalación nueva).\n\n"
            "No lo compartas: trae los datos de tu negocio. Las contraseñas van cifradas.\n\n— Inventia"
        )
        mensaje = CorreoConLogo(
            f"Respaldo de Inventia · {negocio} · {hoy:%d/%m/%Y}", texto, settings.DEFAULT_FROM_EMAIL, [destino]
        )
        mensaje.attach(archivo.name, archivo.read_bytes(), "application/zip")
        if mensaje.send(fail_silently=False) != 1:
            raise ConnectionError("correo_no_enviado")
    return destino


def ultimo_viernes_noche(ahora=None):
    """El viernes a las 20:00 más reciente que ya pasó."""
    ahora = ahora or timezone.localtime()
    dias = (ahora.weekday() - DIA_CORREO) % 7
    viernes = (ahora - timedelta(days=dias)).replace(hour=HORA_CORREO, minute=0, second=0, microsecond=0)
    if viernes > ahora:
        viernes -= timedelta(days=7)
    return viernes


# ---------------------------------------------------------------------------
# Lo que corre solo (scheduler)
# ---------------------------------------------------------------------------

def revisar_automaticos(ahora=None):
    """Respaldo diario (si pasó más de 1 día) y el del viernes por correo. Regresa lo que hizo."""
    from usuarios.models import Usuario
    from .correo_alertas import obtener_configuracion

    hecho = {"diario": False, "correo": False}
    if not Usuario.objects.exists():  # instalación vacía: nada que respaldar
        return hecho

    ahora = ahora or timezone.localtime()
    config = obtener_configuracion()
    carpeta = carpeta_actual(config)

    ultimo = ultimo_automatico(carpeta)
    if not ultimo or datetime.fromisoformat(ultimo["fecha"]) <= ahora - timedelta(days=1):
        crear_respaldo(carpeta, tipo="auto")
        podar_automaticos(carpeta)
        hecho["diario"] = True

    ultimo_correo = config.ultimo_respaldo_correo if config else None
    if config and (ultimo_correo is None or ultimo_correo < ultimo_viernes_noche(ahora)):
        try:
            enviar_por_correo(config)
            config.ultimo_respaldo_correo = ahora
            config.save(update_fields=["ultimo_respaldo_correo"])
            hecho["correo"] = True
        except Exception:
            pass  # sin internet o sin Brevo: se reintenta en la siguiente revisión
    return hecho
