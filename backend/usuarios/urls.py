from django.urls import path

from .views import (
    login_view,
    logout_view,
    me_view,
    registrar_usuario_view,
    listar_usuarios_view,
    editar_usuario_view,
    eliminar_usuario_view,
    cambiar_estado_usuario_view,
    restablecer_contrasena_view,
    actualizar_mi_perfil_view,
    cambiar_mi_contrasena_view,
    crear_primer_propietario_view,
    estado_inicial_view,
    recuperar_contrasena_view,
    generar_codigo_recuperacion_view,
    eventos_seguridad_view,
)


urlpatterns = [
    path('login/', login_view, name='login'),
    path('logout/', logout_view, name='logout'),
    path('me/', me_view, name='me'),

    # Administración de usuarios - propietario
    path('registrar/', registrar_usuario_view, name='registrar_usuario'),
    path('lista/', listar_usuarios_view, name='listar_usuarios'),
    path('<int:usuario_id>/', editar_usuario_view, name='editar_usuario'),
    path('<int:usuario_id>/eliminar/', eliminar_usuario_view, name='eliminar_usuario'),
    path('<int:usuario_id>/estado/', cambiar_estado_usuario_view, name='cambiar_estado_usuario'),
    path('<int:usuario_id>/reset-password/', restablecer_contrasena_view, name='restablecer_contrasena'),

    # Perfil propio - propietario y encargado
    path('mi-perfil/', actualizar_mi_perfil_view, name='actualizar_mi_perfil'),
    path('mi-contrasena/', cambiar_mi_contrasena_view, name='cambiar_mi_contrasena'),

    # Configuración inicial (sin sesión: se usa antes del primer login)
    path('primer-propietario/', crear_primer_propietario_view, name='crear_primer_propietario'),
    path('estado-inicial/', estado_inicial_view, name='estado_inicial'),

    # Recuperación de contraseña del propietario
    path('recuperar-contrasena/', recuperar_contrasena_view, name='recuperar_contrasena'),
    path('codigo-recuperacion/', generar_codigo_recuperacion_view, name='generar_codigo_recuperacion'),
    path('eventos-seguridad/', eventos_seguridad_view, name='eventos_seguridad'),
]
