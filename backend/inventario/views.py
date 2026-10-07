"""Las vistas son los controladores que toman el serializers.py y
deciden qué hacer cuando el frontend pide o envía información."""

from rest_framework import viewsets, mixins

from .models import Categoria, Producto, MovimientoInventario
from .serializers import CategoriaSerializer, ProductoSerializer, MovimientoSerializer
from .services import registrar_movimiento
from usuarios.permissions import EsUsuarioAutenticado, EsPropietario


class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer

    def get_permissions(self):
        # Consultar categorías: propietario y encargado
        if self.action in ['list', 'retrieve']:
            return [EsUsuarioAutenticado()]

        # Crear, editar y eliminar categorías: solo propietario
        return [EsPropietario()]


class ProductoViewSet(viewsets.ModelViewSet):
    queryset = Producto.objects.all()
    serializer_class = ProductoSerializer

    def get_permissions(self):
        # Consultar productos: propietario y encargado
        if self.action in ['list', 'retrieve']:
            return [EsUsuarioAutenticado()]

        # Crear, editar y eliminar productos: solo propietario
        return [EsPropietario()]


class MovimientoViewSet(mixins.CreateModelMixin,
                        mixins.ListModelMixin,
                        mixins.RetrieveModelMixin,
                        viewsets.GenericViewSet):
    """Los movimientos se crean y consultan, pero no se editan ni se borran,
    para que el stock nunca quede descuadrado."""

    queryset = MovimientoInventario.objects.select_related("producto", "usuario").order_by("-fecha_movimiento")
    serializer_class = MovimientoSerializer
    permission_classes = [EsUsuarioAutenticado]

    def perform_create(self, serializer):
        registrar_movimiento(serializer)