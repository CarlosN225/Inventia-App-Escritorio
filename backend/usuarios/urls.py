from django.urls import path
from .views import login_view, logout_view, me_view, registrar_usuario_view

urlpatterns = [
    path('login/', login_view, name='login'),
    path('logout/', logout_view, name='logout'),
    path('me/', me_view, name='me'),
    path('registrar/', registrar_usuario_view, name='registrar_usuario'),
]
