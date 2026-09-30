"""Las vistas son los controladores que toman el serializers.py
deciden qué hacer cuando el frontend pide o envía información."""

from rest_framework import viewsets, mixins
from .models import Categoria, Producto, Movimiento, Alerta
from .serializers import CategoriaSerializer, ProductoSerializer, MovimientoSerializer, AlertaSerializer
from .services import registrar_movimiento


class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer


class ProductoViewSet(viewsets.ModelViewSet):
    queryset = Producto.objects.all()
    serializer_class = ProductoSerializer


class MovimientoViewSet(mixins.CreateModelMixin,
                        mixins.ListModelMixin,
                        mixins.RetrieveModelMixin,
                        viewsets.GenericViewSet):
    """Los movimientos se crean y consultan, pero no se editan ni se borran,
    para que el stock nunca quede descuadrado."""
    queryset = Movimiento.objects.all().order_by("-fecha")
    serializer_class = MovimientoSerializer

    def perform_create(self, serializer):
        registrar_movimiento(serializer)


class AlertaViewSet(viewsets.ReadOnlyModelViewSet):
    """Las alertas las genera el sistema solo; aquí únicamente se consultan."""
    queryset = Alerta.objects.all().order_by("-fecha_creacion")
    serializer_class = AlertaSerializer