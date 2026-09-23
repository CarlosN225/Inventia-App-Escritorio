"""Aquí usaremos un "Router" de Django que genera
 todas las rutas web automáticamente basándose en las vistas de views"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoriaViewSet, ProductoViewSet, MovimientoViewSet, AlertaViewSet

router = DefaultRouter()
router.register(r'categorias', CategoriaViewSet)
router.register(r'productos', ProductoViewSet)
router.register(r'movimientos', MovimientoViewSet)
router.register(r'alertas', AlertaViewSet)

urlpatterns = [
    path('', include(router.urls)),
]


"""Ahora debemos decirle al proyecto principal que las rutas de 
inventario existen. cd backend/inventia_backend/urls.py
"""