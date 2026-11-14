"""API de respaldos: estado, carpeta, respaldar (carpeta / USB / correo) y restaurar."""
import logging
from pathlib import Path

from django.contrib.auth.hashers import check_password
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from usuarios.models import Usuario
from usuarios.permissions import EsPropietario

from . import respaldos
from .correo_alertas import obtener_configuracion

logger = logging.getLogger("inventia.respaldos")

MENSAJES_CORREO = {
    "brevo_no_configurado": "El envío de correos no está configurado en esta computadora.",
    "correo_no_configurado": "Primero guarda un correo en Configuración › Correo y alertas.",
}


def _error(texto, codigo=status.HTTP_400_BAD_REQUEST):
    return Response({"error": texto}, status=codigo)


class EstadoRespaldosView(APIView):
    permission_classes = [EsPropietario]

    def get(self, request):
        config = obtener_configuracion()
        carpeta = respaldos.carpeta_actual(config)
        lista = respaldos.listar(carpeta)
        ultimo_auto = next((r for r in lista if r["tipo"] == "auto"), None)
        return Response({
            "carpeta": str(carpeta),
            "carpeta_por_defecto": str(respaldos.carpeta_por_defecto()),
            "sugeridas": respaldos.carpetas_sugeridas(),
            "respaldos": lista,
            "ultimo_automatico": ultimo_auto["fecha"] if ultimo_auto else None,
            "ultimo_correo": config.ultimo_respaldo_correo if config else None,
            "correo_destino": (config.correo_alertas if config else "") or "",
            "usb": respaldos.unidades_usb(),
            "conservar": respaldos.CONSERVAR_AUTOMATICOS,
        })


class CarpetaRespaldoView(APIView):
    permission_classes = [EsPropietario]

    def patch(self, request):
        config = obtener_configuracion()
        if not config:
            return _error("Primero termina la configuración inicial.")
        try:
            carpeta = respaldos.validar_carpeta(request.data.get("carpeta") or "")
        except ValueError as e:
            return _error(str(e))
        config.carpeta_respaldo = str(carpeta)
        config.save(update_fields=["carpeta_respaldo"])
        return Response({"carpeta": str(carpeta)})


class CrearRespaldoView(APIView):
    """Respaldar ahora: en la carpeta elegida o en una USB."""
    permission_classes = [EsPropietario]

    def post(self, request):
        config = obtener_configuracion()
        destino = request.data.get("destino") or "carpeta"

        if destino == "usb":
            unidad = request.data.get("unidad") or ""
            if unidad not in respaldos.unidades_usb():
                return _error("No encuentro esa USB. Conéctala y vuelve a intentar.")
            carpeta, tipo = Path(f"{unidad}\\") / respaldos.CARPETA_USB, "usb"
        else:
            carpeta, tipo = respaldos.carpeta_actual(config), "manual"

        try:
            archivo = respaldos.crear_respaldo(carpeta, tipo=tipo)
        except OSError:
            logger.exception("No se pudo crear el respaldo")
            return _error("No se pudo guardar el respaldo en esa carpeta.")
        return Response({"archivo": archivo.name, "carpeta": str(carpeta)}, status=status.HTTP_201_CREATED)


class CorreoRespaldoView(APIView):
    """Mandar el respaldo al correo del propietario (necesita internet y Brevo)."""
    permission_classes = [EsPropietario]

    def post(self, request):
        config = obtener_configuracion()
        try:
            destino = respaldos.enviar_por_correo(config)
        except (RuntimeError, ValueError) as e:
            return _error(MENSAJES_CORREO.get(str(e), "No se pudo enviar el respaldo por correo."))
        except Exception:
            logger.exception("No se pudo enviar el respaldo por correo")
            return _error("No se pudo enviar. Revisa tu conexión a internet e intenta de nuevo.",
                          status.HTTP_502_BAD_GATEWAY)
        from django.utils import timezone
        if config:
            config.ultimo_respaldo_correo = timezone.now()
            config.save(update_fields=["ultimo_respaldo_correo"])
        return Response({"correo": destino})


class RestaurarRespaldoView(APIView):
    """
    Restaura un respaldo.
    - Instalación vacía (sin usuarios): sin sesión, desde el asistente.
    - Con dueño: solo el propietario, con su contraseña; antes se respalda lo actual.
    Recibe un archivo subido ('archivo') o el nombre de uno de la carpeta de respaldos ('nombre').
    """
    permission_classes = [AllowAny]

    def post(self, request):
        instalacion_vacia = not Usuario.objects.exists()
        carpeta_previa = None

        if not instalacion_vacia:
            if request.session.get("rol") != "propietario":
                return _error("Solo el propietario puede restaurar un respaldo.", status.HTTP_403_FORBIDDEN)
            duena = Usuario.objects.filter(id=request.session.get("id_usuario"), activo=True).first()
            if not duena or not check_password(request.data.get("contrasena") or "", duena.contrasena_hash):
                return _error("La contraseña no es correcta.")
            carpeta_previa = respaldos.carpeta_actual(obtener_configuracion())

        subido = request.FILES.get("archivo")
        if subido:
            origen = subido.file if hasattr(subido, "file") else subido
        else:
            nombre = Path(request.data.get("nombre") or "").name  # sin rutas raras
            origen = respaldos.carpeta_actual(obtener_configuracion()) / nombre
            if not nombre or not origen.is_file():
                return _error("Elige un respaldo.")

        try:
            ficha = respaldos.restaurar(origen, carpeta_previa=carpeta_previa)
        except respaldos.RespaldoInvalido as e:
            return _error(str(e))
        except Exception:
            logger.exception("Falló la restauración")
            return _error("No se pudo restaurar el respaldo.", status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Los usuarios y contraseñas ahora son los del respaldo: se vuelve a iniciar sesión
        request.session.flush()
        return Response({
            "mensaje": "Respaldo restaurado. Inicia sesión con tu usuario de siempre.",
            "negocio": ficha.get("negocio", ""),
            "fecha": ficha.get("fecha", ""),
        })
