import logging
from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from usuarios.permissions import EsPropietario, EsUsuarioAutenticado

from .correo_alertas import (
    MANUAL,
    construir_mensaje,
    datos_resumen,
    enviar_ahora,
    enviar_correo,
    obtener_configuracion,
    _pendientes_de_hoy,
)
from .models import AlertaStock

logger = logging.getLogger("inventia.alertas")


class ResumenAlertasView(APIView):
    permission_classes = [EsUsuarioAutenticado]

    def get(self, request):
        datos = datos_resumen()
        hoy = timezone.localdate()

        def producto_json(p):
            return {
                "id": p.pk,
                "nombre": p.nombre,
                "stock_actual": p.stock_actual,
                "stock_minimo": p.stock_minimo,
                "fecha_caducidad": p.fecha_caducidad.isoformat() if p.fecha_caducidad else None,
                "dias_restantes": (p.fecha_caducidad - hoy).days if p.fecha_caducidad else None,
            }

        return Response({
            "fecha": datos["fecha"],
            "stock_bajo": [producto_json(p) for p in datos["stock_bajo"]],
            "por_caducar": [producto_json(p) for p in datos["por_caducar"]],
            "dias_aviso_caducidad": datos["dias_aviso_caducidad"],
            "mensaje": construir_mensaje(),
        })


class EstadoAlertasView(APIView):
    permission_classes = [EsUsuarioAutenticado]

    def get(self, request):
        config = obtener_configuracion()
        ahora = timezone.localtime()
        hoy = ahora.date()

        ultimo = AlertaStock.objects.filter(enviada=True).order_by("-fecha_envio").first()
        # La revisión automática de hoy (los envíos con el botón no cuentan)
        revision = (
            AlertaStock.objects.filter(fecha_resumen=hoy).exclude(motivo=MANUAL).order_by("-fecha_generacion").first()
        )

        proximo = None
        if config:
            proximo_dt = ahora.replace(
                hour=config.hora_resumen.hour, minute=config.hora_resumen.minute, second=0, microsecond=0
            )
            if revision:
                proximo_dt += timedelta(days=1)  # Hoy ya se revisó
            elif proximo_dt <= ahora:
                proximo_dt = ahora  # Ya pasó la hora: se revisa en el próximo minuto
            proximo = proximo_dt.isoformat()

        return Response({
            "ultimo_envio": ultimo.fecha_envio.isoformat() if ultimo else None,
            "enviada": bool(ultimo),
            "revision_hoy": revision.motivo if revision else None,  # novedad | recordatorio | sin_novedad | descartado
            "pendientes": _pendientes_de_hoy(hoy).count(),
            "proximo_envio": proximo,
            "alertas_activas": bool(config and config.alertas_activas),
        })


class EnviarAhoraView(APIView):
    permission_classes = [EsPropietario]

    def post(self, request):
        try:
            registro = enviar_ahora()
        except ConnectionError:
            return Response({"error": "correo_no_enviado"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except RuntimeError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "enviada": registro.enviada,
            "fecha_envio": registro.fecha_envio.isoformat() if registro.fecha_envio else None,
            "mensaje": registro.mensaje,
            "pendiente": not registro.enviada,
        })


class PruebaCorreoView(APIView):
    permission_classes = [EsPropietario]

    def post(self, request):
        config = obtener_configuracion()
        if not config or not config.correo_alertas:
            return Response({"error": "correo_no_configurado"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            enviar_correo(
                "Este es un mensaje de prueba. La conexión de correo funciona.",
                config.correo_alertas,
                "INVENTIA · Prueba de correo",
            )
            return Response({"enviada": True, "mensaje": "Correo de prueba enviado."})
        except RuntimeError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception:
            # Se guarda el error real en la terminal del backend para poder revisarlo
            logger.exception("Falló el correo de prueba")
            return Response({"error": "correo_no_enviado"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
