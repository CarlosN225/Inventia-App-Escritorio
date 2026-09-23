"""Las vistas son los controladores que toman el serializers.py
deciden qué hacer cuando el frontend pide o envía información."""

from rest_framework import viewsets
from .models import Categoria, Producto, Movimiento, Alerta
from .serializers import CategoriaSerializer, ProductoSerializer, MovimientoSerializer, AlertaSerializer

class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer

class ProductoViewSet(viewsets.ModelViewSet):
    queryset = Producto.objects.all()
    serializer_class = ProductoSerializer

class MovimientoViewSet(viewsets.ModelViewSet):
    queryset = Movimiento.objects.all()
    serializer_class = MovimientoSerializer

class AlertaViewSet(viewsets.ModelViewSet):
    queryset = Alerta.objects.all()
    serializer_class = AlertaSerializer  


    