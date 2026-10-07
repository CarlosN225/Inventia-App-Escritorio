"""Aquí usamos un "Router" de Django que genera
todas las rutas web automáticamente basándose en las vistas de views."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import CategoriaViewSet, ProductoViewSet, MovimientoViewSet, VentaViewSet, CompraViewSet

router = DefaultRouter()
router.register(r'categorias', CategoriaViewSet)
router.register(r'productos', ProductoViewSet)
router.register(r'movimientos', MovimientoViewSet)
router.register(r'ventas', VentaViewSet)
router.register(r'compras', CompraViewSet)

urlpatterns = [
    path('', include(router.urls)),
]