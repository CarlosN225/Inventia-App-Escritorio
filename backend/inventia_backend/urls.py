from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/usuarios/', include('usuarios.urls')),
    path('api/alertas/', include('alertas.urls')),
    path('api/', include('inventario.urls')),
]