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



# ============================================================
#  VENTAS Y COMPRAS
#  Se crean y se consultan; no se editan ni se borran.
# ============================================================
from rest_framework import status
from rest_framework.response import Response

from .models import Venta, Compra
from .serializers import RegistrarVentaSerializer, VentaSerializer, RegistrarCompraSerializer, CompraSerializer
from .services import registrar_venta, registrar_compra


class VentaViewSet(mixins.CreateModelMixin,
                   mixins.ListModelMixin,
                   mixins.RetrieveModelMixin,
                   viewsets.GenericViewSet):
    queryset = Venta.objects.all().order_by("-fecha_venta")
    serializer_class = VentaSerializer
    permission_classes = [EsUsuarioAutenticado]

    def create(self, request, *args, **kwargs):
        entrada = RegistrarVentaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        venta = registrar_venta(request, entrada.validated_data["renglones"])
        return Response(VentaSerializer(venta).data, status=status.HTTP_201_CREATED)


class CompraViewSet(mixins.CreateModelMixin,
                    mixins.ListModelMixin,
                    mixins.RetrieveModelMixin,
                    viewsets.GenericViewSet):
    queryset = Compra.objects.all().order_by("-fecha_compra")
    serializer_class = CompraSerializer
    permission_classes = [EsUsuarioAutenticado]

    def create(self, request, *args, **kwargs):
        entrada = RegistrarCompraSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        compra = registrar_compra(
            request, datos["proveedor"], datos.get("nota", ""), datos["renglones"], datos.get("fecha")
        )
        return Response(CompraSerializer(compra).data, status=status.HTTP_201_CREATED)