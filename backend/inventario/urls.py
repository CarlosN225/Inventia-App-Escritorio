"""Aquí usamos un "Router" de Django que genera
todas las rutas web automáticamente basándose en las vistas de views."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import CategoriaViewSet, ProductoViewSet, MovimientoViewSet, VentaViewSet, CompraViewSet, ConfiguracionView, PromocionViewSet, PinView, AutorizarPrecioView

router = DefaultRouter()
router.register(r'categorias', CategoriaViewSet)
router.register(r'productos', ProductoViewSet)
router.register(r'movimientos', MovimientoViewSet)
router.register(r'ventas', VentaViewSet)
router.register(r'compras', CompraViewSet)
router.register(r'promociones', PromocionViewSet)

urlpatterns = [
    path('configuracion/', ConfiguracionView.as_view(), name='configuracion'),
    path('', include(router.urls)),
        path('configuracion/pin/', PinView.as_view(), name='configuracion-pin'),
    path('autorizaciones/precio/', AutorizarPrecioView.as_view(), name='autorizar-precio'),
]
from .alertas_api import ResumenAlertasView, EstadoAlertasView, EnviarAhoraView, PruebaCorreoView
urlpatterns += [
    path('alertas/resumen/', ResumenAlertasView.as_view(), name='alertas-resumen'),
    path('alertas/estado/', EstadoAlertasView.as_view(), name='alertas-estado'),
    path('alertas/enviar-ahora/', EnviarAhoraView.as_view(), name='alertas-enviar-ahora'),
    path('alertas/prueba/', PruebaCorreoView.as_view(), name='alertas-prueba'),
]
