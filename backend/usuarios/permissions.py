from rest_framework.permissions import BasePermission


class EsUsuarioAutenticado(BasePermission):
    """
    Permite el acceso únicamente a usuarios con una sesión activa.
    """

    def has_permission(self, request, view):
        id_usuario = request.session.get('id_usuario')
        rol = request.session.get('rol')

        return bool(id_usuario and rol in ['propietario', 'encargado'])


class EsPropietario(BasePermission):
    """
    Permite el acceso únicamente al propietario.
    """

    def has_permission(self, request, view):
        id_usuario = request.session.get('id_usuario')
        rol = request.session.get('rol')

        return bool(id_usuario and rol == 'propietario')


class EsPropietarioOEncargado(BasePermission):
    """
    Permite el acceso tanto al propietario como al encargado.
    """

    def has_permission(self, request, view):
        id_usuario = request.session.get('id_usuario')
        rol = request.session.get('rol')

        return bool(id_usuario and rol in ['propietario', 'encargado'])