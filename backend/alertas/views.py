from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from usuarios.permissions import EsPropietario, EsPropietarioOEncargado
from . import resumen as resumen_mod
from . import servicio
from .config import obtener_config
from .models import AlertaStock

ERRORES_HTTP = {'sin_conexion': 503, 'ya_enviado': 409, 'error_envio': 502}


def _error(e):
    cuerpo = {'error': e.codigo}
    if e.detalle and e.codigo != 'sin_conexion':
        cuerpo['detalle'] = e.detalle
    return Response(cuerpo, status=ERRORES_HTTP.get(e.codigo, 400))


def _estado_payload():
    ultimo = AlertaStock.objects.order_by('-fecha_resumen').first()
    ultimo_envio = None
    if ultimo:
        ultimo_envio = {
            'fecha': (ultimo.fecha_envio or ultimo.fecha_creacion).isoformat(),
            'enviada': ultimo.enviada,
        }
    return {
        'ultimo_envio': ultimo_envio,
        'pendientes': AlertaStock.objects.filter(enviada=False).count(),
        'proximo_envio': servicio.proximo_envio().isoformat() if obtener_config()['alertas_activas'] else None,
    }


@api_view(['GET'])
@permission_classes([EsPropietarioOEncargado])
def resumen_view(request):
    datos = resumen_mod.calcular()
    datos['mensaje'] = resumen_mod.armar_mensaje(datos)
    return Response(datos)


@api_view(['GET'])
@permission_classes([EsPropietarioOEncargado])
def estado_view(request):
    return Response(_estado_payload())


@api_view(['POST'])
@permission_classes([EsPropietarioOEncargado])
def enviar_ahora_view(request):
    try:
        alerta = servicio.enviar_ahora()
    except servicio.AlertaError as e:
        return _error(e)
    return Response({'enviada': True, 'fecha_envio': alerta.fecha_envio.isoformat()})


@api_view(['POST'])
@permission_classes([EsPropietario])
def prueba_view(request):
    try:
        servicio.enviar_prueba(request.data.get('telefono'))
    except servicio.AlertaError as e:
        return _error(e)
    return Response({'enviada': True})
