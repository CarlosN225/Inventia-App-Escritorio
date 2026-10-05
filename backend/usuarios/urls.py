from django.urls import path

from .views import (
    login_view,
    logout_view,
    me_view,
    registrar_usuario_view,
    listar_usuarios_view,
    cambiar_estado_usuario_view,
    restablecer_contrasena_view,
    actualizar_mi_perfil_view,
    cambiar_mi_contrasena_view,
    crear_primer_propietario_view,
    editar_usuario_view,
eliminar_usuario_view,
)


urlpatterns = [
    path('login/', login_view, name='login'),
    path('logout/', logout_view, name='logout'),
    path('me/', me_view, name='me'),

    # Administración de usuarios - propietario
    path('registrar/', registrar_usuario_view, name='registrar_usuario'),
    path('lista/', listar_usuarios_view, name='listar_usuarios'),
    path(
    '<int:usuario_id>/',
    editar_usuario_view,
    name='editar_usuario'
),

path(
    '<int:usuario_id>/eliminar/',
    eliminar_usuario_view,
    name='eliminar_usuario'
),
    path(
        '<int:usuario_id>/estado/',
        cambiar_estado_usuario_view,
        name='cambiar_estado_usuario'
    ),
    path(
        '<int:usuario_id>/reset-password/',
        restablecer_contrasena_view,
        name='restablecer_contrasena'
    ),

    # Perfil propio - propietario y encargado
    path(
        'mi-perfil/',
        actualizar_mi_perfil_view,
        name='actualizar_mi_perfil'
    ),
    path(
        'mi-contrasena/',
        cambiar_mi_contrasena_view,
        name='cambiar_mi_contrasena'
    ),

    # Configuración inicial
    path(
        'primer-propietario/',
        crear_primer_propietario_view,
        name='crear_primer_propietario'
    ),
]