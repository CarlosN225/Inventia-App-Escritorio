from django.urls import path

from . import views

urlpatterns = [
    path('resumen/', views.resumen_view),
    path('estado/', views.estado_view),
    path('enviar-ahora/', views.enviar_ahora_view),
    path('prueba/', views.prueba_view),
]
