"""Generación, envío y reintento de resúmenes diarios por correo."""
from datetime import timedelta

from django.conf import settings
from django.core.mail import EmailMessage
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from .models import AlertaStock, Configuracion, Producto


def obtener_configuracion():
    return Configuracion.objects.select_related("negocio").order_by("id").first()


def datos_resumen(config=None, hoy=None):
    config = config or obtener_configuracion()
    hoy = hoy or timezone.localdate()
    if not config:
        return {"fecha": hoy.isoformat(), "stock_bajo": [], "por_caducar": [], "dias_aviso_caducidad": 30}
    productos = Producto.objects.filter(activo=True)
    bajos = list(productos.filter(stock_actual__lt=F("stock_minimo")).order_by("stock_actual", "nombre"))
    limite = hoy + timedelta(days=config.dias_aviso_caducidad or 30)
    caducan = list(productos.filter(stock_actual__gt=0, fecha_caducidad__isnull=False,
                                    fecha_caducidad__gte=hoy, fecha_caducidad__lte=limite)
                   .order_by("fecha_caducidad", "nombre"))
    return {"fecha": hoy.isoformat(), "stock_bajo": bajos, "por_caducar": caducan,
            "dias_aviso_caducidad": config.dias_aviso_caducidad or 30}


def construir_mensaje(config=None, hoy=None):
    datos = datos_resumen(config, hoy)
    fecha_obj = hoy or timezone.localdate()
    meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
    fecha = f"{fecha_obj.day} {meses[fecha_obj.month - 1]}"
    lineas = [f"INVENTIA · Resumen del {fecha}"]
    bajos, caducan = datos["stock_bajo"], datos["por_caducar"]
    if bajos:
        lineas += ["", f"Stock bajo ({len(bajos)}):"]
        for p in bajos[:3]:
            lineas.append(f"- {p.nombre}: agotado" if p.stock_actual <= 0 else f"- {p.nombre}: quedan {p.stock_actual}")
        if len(bajos) > 3:
            lineas.append(f"…y {len(bajos) - 3} más")
    if caducan:
        lineas += ["", f"Por caducar ({len(caducan)}):"]
        hoy_real = hoy or timezone.localdate()
        for p in caducan[:3]:
            dias = (p.fecha_caducidad - hoy_real).days
            lineas.append(f"- {p.nombre}: {dias} días ({p.stock_actual} pzas)")
        if len(caducan) > 3:
            lineas.append(f"…y {len(caducan) - 3} más")
    if not bajos and not caducan:
        lineas += ["", "Todo en orden. No hay productos con stock bajo ni próximos a caducar."]
    return "\n".join(lineas)


def enviar_correo(texto, correo=None, asunto="INVENTIA · Resumen de inventario"):
    config = obtener_configuracion()
    correo = correo or (config.correo_alertas if config else "")
    if not correo:
        raise ValueError("correo_no_configurado")
    if not getattr(settings, "BREVO_SMTP_LOGIN", "") or not getattr(settings, "BREVO_SMTP_KEY", ""):
        raise RuntimeError("brevo_no_configurado")
    if not getattr(settings, "BREVO_FROM_EMAIL", ""):
        raise RuntimeError("brevo_remitente_no_configurado")
    mensaje = EmailMessage(asunto, texto, settings.DEFAULT_FROM_EMAIL, [correo])
    if mensaje.send(fail_silently=False) != 1:
        raise ConnectionError("correo_no_enviado")


def crear_o_recuperar_resumen(hoy=None):
    hoy = hoy or timezone.localdate()
    config = obtener_configuracion()
    mensaje = construir_mensaje(config, hoy)
    with transaction.atomic():
        registro = AlertaStock.objects.filter(fecha_resumen=hoy).first()
        if registro:
            return registro, False
        try:
            registro = AlertaStock.objects.create(fecha_resumen=hoy, mensaje=mensaje, enviada=False)
        except IntegrityError:
            registro = AlertaStock.objects.get(fecha_resumen=hoy)
            return registro, False
    return registro, True


def enviar_resumen_hoy(forzar=False):
    config = obtener_configuracion()
    if not config:
        raise ValueError("configuracion_no_encontrada")
    if not config.alertas_activas:
        raise ValueError("alertas_desactivadas")
    registro, _ = crear_o_recuperar_resumen()
    if registro.enviada:
        return registro
    try:
        enviar_correo(registro.mensaje, config.correo_alertas)
        registro.enviada = True
        registro.fecha_envio = timezone.now()
        registro.ultimo_error = ""
    except Exception as exc:
        registro.ultimo_error = str(exc)[:255] or "correo_no_enviado"
        registro.save(update_fields=["ultimo_error"])
        if isinstance(exc, (RuntimeError, ValueError)):
            raise
        raise ConnectionError("correo_no_enviado") from exc
    registro.save(update_fields=["enviada", "fecha_envio", "ultimo_error"])
    return registro


def reintentar_pendientes():
    config = obtener_configuracion()
    if not config or not config.alertas_activas:
        return
    limite_reintento = timezone.now() - timedelta(minutes=4)
    pendientes = AlertaStock.objects.filter(enviada=False, fecha_generacion__lte=limite_reintento).order_by("fecha_generacion")
    for registro in pendientes:
        try:
            enviar_correo(registro.mensaje, config.correo_alertas)
            registro.enviada = True
            registro.fecha_envio = timezone.now()
            registro.ultimo_error = ""
            registro.save(update_fields=["enviada", "fecha_envio", "ultimo_error"])
        except Exception as exc:
            registro.ultimo_error = str(exc)[:255] or "correo_no_enviado"
            registro.save(update_fields=["ultimo_error"])
            break
