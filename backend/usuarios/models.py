from django.db import models


class Usuario(models.Model):
    ROL_PROPIETARIO = "propietario"
    ROL_ENCARGADO = "encargado"
    ROL_CHOICES = [
        (ROL_PROPIETARIO, "Propietario"),
        (ROL_ENCARGADO, "Encargado"),
    ]

    id = models.AutoField(primary_key=True, db_column="id_usuario")
    nombre_completo = models.CharField(max_length=120)
    correo = models.EmailField(max_length=150, unique=True)
    contrasena_hash = models.CharField(max_length=255)
    telefono_whatsapp = models.CharField(max_length=20)
    rol = models.CharField(max_length=20, choices=ROL_CHOICES)
    activo = models.BooleanField(default=True)
        # Si entró con una contraseña temporal (alta o restablecida), debe cambiarla al entrar
    debe_cambiar_contrasena = models.BooleanField(default=False)
    # Código de recuperación del propietario (cifrado, como la contraseña). Se muestra una sola vez.
    codigo_recuperacion_hash = models.CharField(max_length=255, blank=True, default="")
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "Usuario"
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"

    def __str__(self):
        return f"{self.nombre_completo} ({self.rol})"


class EventoSeguridad(models.Model):
    """Bitácora de cambios sensibles en las cuentas (quién restableció qué y cuándo)."""

    TIPO_RECUPERO_CON_CODIGO = "recupero_con_codigo"
    TIPO_CODIGO_GENERADO = "codigo_generado"
    TIPO_RESTABLECIDA_POR_PROPIETARIO = "restablecida_por_propietario"
    TIPO_RESTABLECIDA_POR_SOPORTE = "restablecida_por_soporte"
    TIPO_PROPIETARIO_AGREGADO = "propietario_agregado"
    TIPO_PROPIETARIO_DESACTIVADO = "propietario_desactivado"
    TIPO_PROPIETARIO_REACTIVADO = "propietario_reactivado"
    TIPO_CHOICES = [
        (TIPO_RECUPERO_CON_CODIGO, "Recuperó su contraseña con el código"),
        (TIPO_CODIGO_GENERADO, "Generó un código de recuperación nuevo"),
        (TIPO_RESTABLECIDA_POR_PROPIETARIO, "Contraseña restablecida por un propietario"),
        (TIPO_RESTABLECIDA_POR_SOPORTE, "Contraseña restablecida por soporte de Inventia"),
        (TIPO_PROPIETARIO_AGREGADO, "Se agregó un propietario"),
        (TIPO_PROPIETARIO_DESACTIVADO, "El propietario principal dio de baja al segundo propietario"),
        (TIPO_PROPIETARIO_REACTIVADO, "El propietario principal reactivó al segundo propietario"),
    ]

    id = models.AutoField(primary_key=True, db_column="id_evento")
    usuario = models.ForeignKey(
        Usuario, db_column="id_usuario", on_delete=models.CASCADE, related_name="eventos_seguridad"
    )
    realizado_por = models.ForeignKey(
        Usuario, db_column="id_realizado_por", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="eventos_realizados",
    )
    tipo = models.CharField(max_length=40, choices=TIPO_CHOICES)
    detalle = models.CharField(max_length=200, blank=True, default="")
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "EventoSeguridad"
        ordering = ["-fecha"]
        verbose_name = "Evento de seguridad"
        verbose_name_plural = "Eventos de seguridad"

    def __str__(self):
        return f"{self.get_tipo_display()} · {self.usuario}"


def propietario_principal():
    """El dueño que registró el negocio en el asistente (o, si no hay negocio, el primer propietario)."""
    from inventario.models import Negocio

    negocio = Negocio.objects.select_related("usuario_admin").order_by("id").first()
    if negocio and negocio.usuario_admin_id:
        return negocio.usuario_admin
    return Usuario.objects.filter(rol=Usuario.ROL_PROPIETARIO).order_by("id").first()
