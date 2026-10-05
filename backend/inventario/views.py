from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .services import registrar_movimiento

class RegistrarMovimientoAPIView(APIView):
    def post(self, request):
        try:
            producto_id = request.data.get('producto_id')
            tipo = request.data.get('tipo')
            cantidad = request.data.get('cantidad')
            observaciones = request.data.get('observaciones', '')

            # Validar que vengan los datos obligatorios
            if not producto_id or not tipo or cantidad is None:
                return Response(
                    {"error": "Faltan datos obligatorios (producto_id, tipo, cantidad)."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Llamamos a tu servicio que acabamos de crear
            movimiento = registrar_movimiento(
                producto_id=producto_id,
                tipo=tipo,
                cantidad=int(cantidad),
                observaciones=observaciones
            )

            return Response({
                "message": "Movimiento registrado con éxito",
                "stock_resultante": movimiento.stock_resultante,
                "tipo": movimiento.tipo
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)