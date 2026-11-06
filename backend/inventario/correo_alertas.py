"""Avisos por correo: qué se manda y cuándo.

REGLA DE ORO: las notificaciones no deben ser spam.
  1. Sin riesgos                         -> no hay correo.
  2. Los mismos riesgos que la última vez -> no se repite.
  3. Algo nuevo (un producto se agotó, bajó de su mínimo o entra a 7 días
     de caducar)                          -> se manda el aviso.
  4. Los lunes, si algo sigue pendiente   -> recordatorio.
"Enviar ahora" y el correo de prueba siempre envían, porque los pide el dueño.

Cada revisión deja un registro en AlertaStock con su "firma": la lista de
riesgos que había en ese momento. Comparando firmas se sabe qué es nuevo.
"""
import json
import logging
import os
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db.models import F, Q
from django.utils import timezone

from .correo_html import CID_LOGO, MANUAL, NOVEDAD, RECORDATORIO, armar_html, armar_texto, asunto
from .models import AlertaStock, Configuracion, Producto

logger = logging.getLogger("inventia.alertas")

SIN_NOVEDAD = "sin_novedad"  # se revisó y no hacía falta escribir
DESCARTADO = "descartado"    # quedó pendiente pero otro envío ya lo cubrió (o ya es de otro día)

DIAS_URGENTE = 7
LUNES = 0
MINUTOS_ENTRE_REINTENTOS = 4

# El logo se carga desde GitHub (repo público). Así Gmail lo muestra sin ponerlo
# como archivo adjunto en la bandeja. Se puede cambiar con INVENTIA_LOGO_URL en el .env;
# si se deja vacío, el logo va pegado dentro del correo (y Gmail lo enseña como adjunto).
LOGO_URL = os.getenv(
    "INVENTIA_LOGO_URL",
    "https://raw.githubusercontent.com/CarlosN225/Inventia-App-Escritorio/main/backend/inventario/recursos/logo_correo.png",
).strip()

# Viaja dentro de la carpeta inventario, así también queda en el .exe
RUTA_LOGO = Path(__file__).resolve().parent / "recursos" / "logo_correo.png"


def obtener_configuracion():
    return Configuracion.objects.select_related("negocio").order_by("id").first()


# ---------------------------------------------------------------------------
# Qué productos están en riesgo
# ---------------------------------------------------------------------------

def _productos_en_riesgo(config, hoy):
    productos = Producto.objects.filter(activo=True)
    bajos = list(productos.filter(stock_actual__lt=F("stock_minimo")))

    caducan = []
    if config.maneja_caducidad:
        limite = hoy + timedelta(days=config.dias_aviso_caducidad or 30)
        caducan = list(
            productos.filter(stock_actual__gt=0, fecha_caducidad__isnull=False, fecha_caducidad__lte=limite)
        )
    return bajos, caducan


def clave_stock(producto):
    estado = "agotado" if producto.stock_actual <= 0 else "bajo"
    return f"{estado}:{producto.pk}"


def clave_caducidad(producto):
    # Con la fecha, un lote nuevo que también está por caducar cuenta como novedad
    return f"caduca:{producto.pk}:{producto.fecha_caducidad.isoformat()}"


def firma_conocida():
    """Lo último que el dueño ya sabe: el último aviso que sí llegó o la última
    revisión en la que no hubo nada que avisar."""
    registro = (
        AlertaStock.objects.filter(Q(enviada=True) | Q(motivo=SIN_NOVEDAD))
        .order_by("-fecha_generacion")
        .first()
    )
    if not registro or not registro.firma:
        return set()
    try:
        return set(json.loads(registro.firma))
    except ValueError:
        return set()


def armar_resumen(config, hoy=None, conocida=None):
    """Todo lo que lleva el correo, ya marcado con qué es nuevo."""
    hoy = hoy or timezone.localdate()
    conocida = firma_conocida() if conocida is None else conocida
    bajos, caducan = _productos_en_riesgo(config, hoy)

    stock = []
    for p in bajos:
        clave = clave_stock(p)
        # Si ya sabía que estaba agotado y ahora solo está bajo, no es novedad (mejoró)
        ya_sabia = clave in conocida or (clave.startswith("bajo:") and f"agotado:{p.pk}" in conocida)
        stock.append({
            "id": p.pk,
            "nombre": p.nombre,
            "stock": p.stock_actual,
            "minimo": p.stock_minimo,
            "agotado": p.stock_actual <= 0,
            "nuevo": not ya_sabia,
            "clave": clave,
        })
    # Lo nuevo primero, luego lo agotado, luego lo que tiene menos respecto a su mínimo
    stock.sort(key=lambda i: (not i["nuevo"], not i["agotado"], i["stock"] / i["minimo"] if i["minimo"] else 0, i["nombre"]))

    por_caducar = []
    for p in caducan:
        dias = (p.fecha_caducidad - hoy).days
        urgente = dias <= DIAS_URGENTE
        clave = clave_caducidad(p)
        por_caducar.append({
            "id": p.pk,
            "nombre": p.nombre,
            "stock": p.stock_actual,
            "dias": dias,
            "urgente": urgente,
            # Solo avisa cuando entra a la zona roja (7 días o menos), no por cada día de los 30
            "nuevo": urgente and clave not in conocida,
            "clave": clave if urgente else None,
        })
    por_caducar.sort(key=lambda i: (not i["nuevo"], i["dias"], i["nombre"]))

    firma = sorted({i["clave"] for i in stock} | {i["clave"] for i in por_caducar if i["clave"]})

    return {
        "fecha": hoy,
        "negocio": config.negocio.nombre if config.negocio_id else "",
        "maneja_caducidad": config.maneja_caducidad,
        "dias_aviso": config.dias_aviso_caducidad or 30,
        "stock": stock,
        "caducan": por_caducar,
        "agotados": sum(1 for i in stock if i["agotado"]),
        "nuevos": sum(1 for i in stock + por_caducar if i["nuevo"]),
        "total_productos": len({i["id"] for i in stock + por_caducar}),
        "primero": not AlertaStock.objects.filter(enviada=True).exists(),
        "firma": firma,
    }


def decidir_motivo(resumen, hoy):
    """La regla de oro, en cuatro líneas."""
    if resumen["total_productos"] == 0:
        return SIN_NOVEDAD   # 1. No hay riesgos
    if resumen["nuevos"]:
        return NOVEDAD       # 3. Pasó algo nuevo
    if hoy.weekday() == LUNES and not _aviso_reciente(hoy):
        return RECORDATORIO  # 4. Recordatorio de los lunes
    return SIN_NOVEDAD       # 2. Lo mismo que la última vez


def _aviso_reciente(hoy):
    """Si el fin de semana ya llegó un aviso, el recordatorio del lunes sobra."""
    return AlertaStock.objects.filter(enviada=True, fecha_resumen__gte=hoy - timedelta(days=2)).exists()


# ---------------------------------------------------------------------------
# Compatibilidad con /api/alertas/resumen/
# ---------------------------------------------------------------------------

def datos_resumen(config=None, hoy=None):
    config = config or obtener_configuracion()
    hoy = hoy or timezone.localdate()
    if not config:
        return {"fecha": hoy.isoformat(), "stock_bajo": [], "por_caducar": [], "dias_aviso_caducidad": 30}
    bajos, caducan = _productos_en_riesgo(config, hoy)
    return {
        "fecha": hoy.isoformat(),
        "stock_bajo": sorted(bajos, key=lambda p: (p.stock_actual, p.nombre)),
        "por_caducar": sorted(caducan, key=lambda p: (p.fecha_caducidad, p.nombre)),
        "dias_aviso_caducidad": config.dias_aviso_caducidad or 30,
    }


def construir_mensaje(config=None, hoy=None):
    config = config or obtener_configuracion()
    if not config:
        return ""
    return armar_texto(armar_resumen(config, hoy), MANUAL)


# ---------------------------------------------------------------------------
# Envío
# ---------------------------------------------------------------------------

class CorreoConLogo(EmailMultiAlternatives):
    """Correo de texto + HTML. Si no hay URL del logo, lo pega adentro (cid:logo-inventia).
    Si el archivo del logo no está, el correo sale igual, solo sin imagen."""

    pegar_logo = False

    def message(self, *args, **kwargs):
        msg = super().message(*args, **kwargs)
        if not self.pegar_logo or not RUTA_LOGO.exists():
            return msg
        for parte in msg.walk():
            if parte.get_content_type() == "text/html":
                parte.add_related(
                    RUTA_LOGO.read_bytes(), "image", "png",
                    cid=f"<{CID_LOGO}>", disposition="inline",
                )
                break
        return msg


def enviar_correo(texto, correo=None, asunto_correo="INVENTIA · Resumen de inventario", html=None):
    """Manda un correo por Brevo (texto y, si se da, también HTML)."""
    config = obtener_configuracion()
    correo = correo or (config.correo_alertas if config else "")
    if not correo:
        raise ValueError("correo_no_configurado")
    if not getattr(settings, "BREVO_SMTP_LOGIN", "") or not getattr(settings, "BREVO_SMTP_KEY", ""):
        raise RuntimeError("brevo_no_configurado")
    if not getattr(settings, "BREVO_FROM_EMAIL", ""):
        raise RuntimeError("brevo_remitente_no_configurado")

    mensaje = CorreoConLogo(asunto_correo, texto, settings.DEFAULT_FROM_EMAIL, [correo])
    if html:
        mensaje.attach_alternative(html, "text/html")
        mensaje.pegar_logo = not LOGO_URL
    if mensaje.send(fail_silently=False) != 1:
        raise ConnectionError("correo_no_enviado")


def _pendientes_de_hoy(hoy):
    return AlertaStock.objects.filter(fecha_resumen=hoy, enviada=False).exclude(motivo__in=[SIN_NOVEDAD, DESCARTADO])


def _descartar_viejos(hoy):
    """Lo que no se pudo mandar otro día ya no se manda: hoy se arma con datos frescos."""
    AlertaStock.objects.filter(fecha_resumen__lt=hoy, enviada=False).exclude(
        motivo__in=[SIN_NOVEDAD, DESCARTADO]
    ).update(motivo=DESCARTADO)


def _mandar(registro, resumen, config):
    """Envía el registro. Si falla, guarda el error y lo deja pendiente para reintentar."""
    motivo = registro.motivo
    try:
        enviar_correo(
            armar_texto(resumen, motivo),
            config.correo_alertas,
            asunto(resumen, motivo),
            armar_html(resumen, motivo, LOGO_URL or None),
        )
    except Exception as exc:
        logger.warning("No se pudo enviar el aviso por correo: %s", exc)
        registro.ultimo_error = str(exc)[:255] or "correo_no_enviado"
        registro.save(update_fields=["ultimo_error"])
        if isinstance(exc, (RuntimeError, ValueError)):
            raise
        raise ConnectionError("correo_no_enviado") from exc

    registro.enviada = True
    registro.fecha_envio = timezone.now()
    registro.ultimo_error = ""
    registro.save(update_fields=["enviada", "fecha_envio", "ultimo_error"])

    # Con este envío, lo que hubiera quedado pendiente hoy ya está cubierto
    _pendientes_de_hoy(registro.fecha_resumen).exclude(pk=registro.pk).update(motivo=DESCARTADO)


def _registrar(hoy, motivo, resumen):
    return AlertaStock.objects.create(
        fecha_resumen=hoy,
        motivo=motivo,
        firma=json.dumps(resumen["firma"]),
        mensaje=armar_texto(resumen, motivo),
    )


def _validar(config):
    if not config:
        raise ValueError("configuracion_no_encontrada")
    if not config.alertas_activas:
        raise ValueError("alertas_desactivadas")
    if not config.correo_alertas:
        raise ValueError("correo_no_configurado")


def enviar_ahora():
    """Botón "Enviar resumen ahora": siempre manda, haya o no novedades."""
    config = obtener_configuracion()
    _validar(config)
    hoy = timezone.localdate()
    resumen = armar_resumen(config, hoy)
    registro = _registrar(hoy, MANUAL, resumen)
    _mandar(registro, resumen, config)
    return registro


def revisar_hoy():
    """La revisión diaria (a la hora elegida, o al prender la compu si ya pasó).
    Solo se hace una vez al día. Devuelve el registro, o None si ya se había hecho."""
    config = obtener_configuracion()
    try:
        _validar(config)
    except ValueError:
        return None

    hoy = timezone.localdate()
    if AlertaStock.objects.filter(fecha_resumen=hoy).exclude(motivo=MANUAL).exists():
        return None

    _descartar_viejos(hoy)
    resumen = armar_resumen(config, hoy)
    motivo = decidir_motivo(resumen, hoy)
    registro = _registrar(hoy, motivo, resumen)

    if motivo != SIN_NOVEDAD:
        try:
            _mandar(registro, resumen, config)
        except Exception:
            pass  # Queda pendiente; reintentar_pendientes() lo vuelve a intentar
    return registro


def reintentar_pendientes():
    """Si hoy algo no se pudo mandar (sin internet, Brevo caído...), se reintenta
    con los datos de este momento, no con los de hace horas."""
    config = obtener_configuracion()
    try:
        _validar(config)
    except ValueError:
        return None

    hoy = timezone.localdate()
    limite = timezone.now() - timedelta(minutes=MINUTOS_ENTRE_REINTENTOS)
    registro = _pendientes_de_hoy(hoy).filter(fecha_generacion__lte=limite).order_by("-fecha_generacion").first()
    if not registro:
        return None

    resumen = armar_resumen(config, hoy)
    if registro.motivo != MANUAL:
        motivo = decidir_motivo(resumen, hoy)
        if motivo == SIN_NOVEDAD:
            # Mientras esperaba, se resolvió: ya no hace falta escribir
            registro.motivo = SIN_NOVEDAD
            registro.firma = json.dumps(resumen["firma"])
            registro.save(update_fields=["motivo", "firma"])
            return registro
        registro.motivo = motivo

    registro.firma = json.dumps(resumen["firma"])
    registro.mensaje = armar_texto(resumen, registro.motivo)
    registro.save(update_fields=["motivo", "firma", "mensaje"])

    try:
        _mandar(registro, resumen, config)
    except Exception:
        pass
    return registro


# Nombre anterior, por si algo más lo usa
def enviar_resumen_hoy(forzar=False):
    return enviar_ahora() if forzar else revisar_hoy()
