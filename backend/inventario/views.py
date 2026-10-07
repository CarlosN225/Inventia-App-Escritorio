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

    

# ============================================================
#  CONFIGURACIÓN DEL NEGOCIO
#  Todos la consultan (para saber qué mostrar); solo el propietario la cambia.
# ============================================================
from datetime import datetime

from rest_framework.views import APIView

from .models import Negocio, Configuracion
from usuarios.permissions import EsPropietario

PREFERENCIAS = ["maneja_caducidad", "vende_mayoreo", "maneja_promociones", "usa_codigo_barras", "alertas_activas"]


def _solo_digitos(texto):
    return "".join(c for c in str(texto or "") if c.isdigit())


def _datos_configuracion(negocio):
    config, _ = Configuracion.objects.get_or_create(negocio=negocio)
    return {
        "negocio": {
            "nombre": negocio.nombre,
            "direccion": negocio.direccion or "",
            "telefono": negocio.telefono or "",
        },
        "preferencias": {campo: getattr(config, campo) for campo in PREFERENCIAS},
        "whatsapp": {
            "telefono_alertas": config.telefono_alertas or "",
            "hora_resumen": config.hora_resumen.strftime("%H:%M") if config.hora_resumen else "20:00",
            "dias_aviso_caducidad": config.dias_aviso_caducidad,
        },
    }


class ConfiguracionView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [EsUsuarioAutenticado()]
        return [EsPropietario()]

    def get(self, request):
        negocio = Negocio.objects.first()
        if not negocio:
            return Response({"error": "Todavía no hay un negocio configurado."}, status=status.HTTP_404_NOT_FOUND)
        return Response(_datos_configuracion(negocio))

    def patch(self, request):
        negocio = Negocio.objects.first()
        if not negocio:
            return Response({"error": "Todavía no hay un negocio configurado."}, status=status.HTTP_404_NOT_FOUND)

        config, _ = Configuracion.objects.get_or_create(negocio=negocio)
        errores = {}

        # Datos del negocio
        datos_negocio = request.data.get("negocio") or {}
        if "nombre" in datos_negocio:
            nombre = (datos_negocio.get("nombre") or "").strip()
            if not nombre:
                errores["nombre"] = "El nombre del negocio no puede quedar vacío."
            else:
                negocio.nombre = nombre
        if "direccion" in datos_negocio:
            negocio.direccion = (datos_negocio.get("direccion") or "").strip()
        if "telefono" in datos_negocio:
            telefono = _solo_digitos(datos_negocio.get("telefono"))
            if telefono and len(telefono) != 10:
                errores["telefono"] = "El teléfono debe tener 10 dígitos."
            else:
                negocio.telefono = telefono

        # Los 5 interruptores
        preferencias = request.data.get("preferencias") or {}
        for campo in PREFERENCIAS:
            if campo in preferencias:
                setattr(config, campo, bool(preferencias[campo]))

        # WhatsApp
        whatsapp = request.data.get("whatsapp") or {}
        if "telefono_alertas" in whatsapp:
            telefono = _solo_digitos(whatsapp.get("telefono_alertas"))
            if telefono and len(telefono) != 10:
                errores["telefono_alertas"] = "El WhatsApp debe tener 10 dígitos."
            else:
                config.telefono_alertas = telefono
        if "hora_resumen" in whatsapp:
            try:
                config.hora_resumen = datetime.strptime(str(whatsapp["hora_resumen"]), "%H:%M").time()
            except ValueError:
                errores["hora_resumen"] = "Usa el formato HH:MM, por ejemplo 20:00."
        if "dias_aviso_caducidad" in whatsapp:
            try:
                dias = int(whatsapp["dias_aviso_caducidad"])
                if not 1 <= dias <= 120:
                    raise ValueError
                config.dias_aviso_caducidad = dias
            except (TypeError, ValueError):
                errores["dias_aviso_caducidad"] = "Escribe un número de días entre 1 y 120."

        if errores:
            return Response(errores, status=status.HTTP_400_BAD_REQUEST)

        negocio.save()
        config.save()
        return Response(_datos_configuracion(negocio))