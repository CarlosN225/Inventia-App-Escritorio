"""
Plan B de soporte: el propietario perdió su contraseña Y su código de recuperación.

Lo usa una persona de soporte de Inventia, en la computadora del cliente,
con el propietario presente e identificado. Solo cambia la contraseña
(no lee ni toca ningún otro dato) y deja registro en la bitácora de seguridad.

    python manage.py restablecer_propietario                 # lista los propietarios
    python manage.py restablecer_propietario --correo ana@x  # le pone una contraseña temporal

En el .exe: Inventia.exe --restablecer-propietario [correo]
"""
from secrets import token_urlsafe

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError

from usuarios.models import EventoSeguridad, Usuario


class Command(BaseCommand):
    help = "Soporte: pone una contraseña temporal al propietario (queda registrado)."

    def add_arguments(self, parser):
        parser.add_argument("--correo", help="Correo del propietario a restablecer")

    def handle(self, *args, **options):
        propietarios = Usuario.objects.filter(rol=Usuario.ROL_PROPIETARIO, activo=True).order_by("id")

        if not propietarios.exists():
            raise CommandError("Esta instalación todavía no tiene propietario.")

        correo = (options.get("correo") or "").strip().lower()

        if not correo:
            self.stdout.write("Propietarios de esta instalación:")
            for p in propietarios:
                self.stdout.write(f"  - {p.nombre_completo} <{p.correo}>")
            self.stdout.write("Vuelve a correrlo con --correo <correo>.")
            return

        usuario = propietarios.filter(correo=correo).first()
        if not usuario:
            raise CommandError(f"No hay un propietario activo con el correo {correo}.")

        temporal = token_urlsafe(8)
        usuario.contrasena_hash = make_password(temporal)
        usuario.debe_cambiar_contrasena = True
        # El código anterior se da por perdido: al entrar, Mi perfil le pedirá generar uno nuevo
        usuario.codigo_recuperacion_hash = ""
        usuario.save(update_fields=["contrasena_hash", "debe_cambiar_contrasena", "codigo_recuperacion_hash"])

        EventoSeguridad.objects.create(
            usuario=usuario,
            realizado_por=None,
            tipo=EventoSeguridad.TIPO_RESTABLECIDA_POR_SOPORTE,
            detalle="Restablecida en persona por soporte de Inventia",
        )

        self.stdout.write(self.style.SUCCESS(f"Contraseña temporal de {usuario.nombre_completo}: {temporal}"))
        self.stdout.write("Al entrar, Inventia le pedirá crear su propia contraseña y un código de recuperación nuevo.")
