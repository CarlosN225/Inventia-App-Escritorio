import uuid
from datetime import time
from django.db import models
from usuarios.models import Usuario
from django.db.models import CheckConstraint, Q


def generar_uuid_local():
    return str(uuid.uuid4())


class Negocio(models.Model):
    id = models.AutoField(primary_key=True, db_column="id_negocio")
    nombre = models.CharField(max_length=150)
    propietario = models.CharField(max_length=120)
    direccion = models.CharField(max_length=200)
    telefono = models.CharField(max_length=20, null=True, blank=True)
    usuario_admin = models.ForeignKey(
        Usuario,
        db_column="id_usuario_admin",
        on_delete=models.PROTECT,
        related_name="negocios_administrados",
    )

    class Meta:
        db_table = "Negocio"
        verbose_name = "Negocio"
        verbose_name_plural = "Negocios"

    def __str__(self):
        return self.nombre


class Configuracion(models.Model):
    id = models.AutoField(primary_key=True, db_column="id_configuracion")
    negocio = models.OneToOneField(
        Negocio,
        db_column="id_negocio",
        on_delete=models.CASCADE,
        related_name="configuracion",
    )
    maneja_caducidad = models.BooleanField(default=False)
    maneja_promociones = models.BooleanField(default=False)
    usa_codigo_barras = models.BooleanField(default=False)
    alertas_activas = models.BooleanField(default=True)
    vende_mayoreo = models.BooleanField(default=False)
    telefono_alertas = models.CharField(max_length=20, blank=True, default="")
    contacto_alertas = models.CharField(max_length=120, blank=True, default="")  # de quién es el WhatsApp
    hora_resumen = models.TimeField(default=time(20, 0))
    dias_aviso_caducidad = models.PositiveIntegerField(default=30)
    
    class Meta:
        db_table = "Configuracion"
        verbose_name = "Configuracion"
        verbose_name_plural = "Configuraciones"

    def __str__(self):
        return f"Configuracion de {self.negocio.nombre}"


class Categoria(models.Model):
    id = models.AutoField(primary_key=True, db_column="id_categoria")
    nombre = models.CharField(max_length=80)
    descripcion = models.CharField(max_length=200, null=True, blank=True)
    activa = models.BooleanField(default=True)

    class Meta:
        db_table = "Categoria"
        verbose_name = "Categoria"
        verbose_name_plural = "Categorias"

    def __str__(self):
        return self.nombre


class Producto(models.Model):
    UNIDAD_PIEZA = "pieza"
    UNIDAD_BOLSA = "bolsa"
    UNIDAD_CAJA = "caja"
    UNIDAD_PAQUETE = "paquete"
    UNIDAD_CHOICES = [
        (UNIDAD_PIEZA, "Pieza"),
        (UNIDAD_BOLSA, "Bolsa"),
        (UNIDAD_CAJA, "Caja"),
        (UNIDAD_PAQUETE, "Paquete"),
    ]
    TIPO_EMPAQUE_CHOICES = [
        ("caja", "Caja"),
        ("bolsa", "Bolsa"),
        ("paquete", "Paquete"),
    ]

    id = models.AutoField(primary_key=True, db_column="id_producto")
    codigo_barras = models.CharField(max_length=50, unique=True, null=True, blank=True)
    nombre = models.CharField(max_length=120)
    descripcion = models.CharField(max_length=200, null=True, blank=True)
    categoria = models.ForeignKey(
        Categoria,
        db_column="id_categoria",
        on_delete=models.PROTECT,
        related_name="productos",
    )
    unidad_medida = models.CharField(max_length=20, choices=UNIDAD_CHOICES, default="pieza")
    precio_venta = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    ultimo_costo = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    precio_mayoreo = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    cantidad_minima_mayoreo = models.IntegerField(null=True, blank=True)
    piezas_por_empaque = models.IntegerField(null=True, blank=True)
    tipo_empaque = models.CharField(max_length=10, choices=TIPO_EMPAQUE_CHOICES, null=True, blank=True)
    fecha_caducidad = models.DateField(null=True, blank=True)
    imagen = models.ImageField(upload_to="productos/", null=True, blank=True)
    marca = models.CharField(max_length=80, blank=True, default="")
    stock_actual = models.IntegerField(default=0)
    stock_minimo = models.IntegerField()
    stock_maximo = models.IntegerField(null=True, blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = "Producto"
        verbose_name = "Producto"
        verbose_name_plural = "Productos"
        constraints = [models.CheckConstraint(condition=Q(stock_actual__gte=0), name="producto_stock_no_negativo")]

    def __str__(self):
        return self.nombre


class Promocion(models.Model):
    TIPO_PORCENTAJE = "descuento_porcentaje"
    TIPO_MONTO = "descuento_monto"
    TIPO_CHOICES = [
        (TIPO_PORCENTAJE, "Descuento por porcentaje"),
        (TIPO_MONTO, "Descuento por monto"),
    ]

    id = models.AutoField(primary_key=True, db_column="id_promocion")
    producto = models.ForeignKey(
        Producto,
        db_column="id_producto",
        on_delete=models.PROTECT,
        related_name="promociones",
    )
    tipo_promocion = models.CharField(max_length=30, choices=TIPO_CHOICES)
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()
    activa = models.BooleanField(default=True)

    class Meta:
        db_table = "Promocion"
        verbose_name = "Promocion"
        verbose_name_plural = "Promociones"

    def __str__(self):
        return f"{self.producto.nombre} - {self.get_tipo_promocion_display()}"


class Venta(models.Model):
    id = models.AutoField(primary_key=True, db_column="id_venta")
    fecha_venta = models.DateTimeField(auto_now_add=True)
    usuario = models.ForeignKey(
        Usuario,
        db_column="id_usuario",
        on_delete=models.PROTECT,
        related_name="ventas",
    )
    total = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = "Venta"
        verbose_name = "Venta"
        verbose_name_plural = "Ventas"

    def __str__(self):
        return f"Venta #{self.pk}"


class DetalleVenta(models.Model):
    id = models.AutoField(primary_key=True, db_column="id_detalle_venta")
    venta = models.ForeignKey(
        Venta,
        db_column="id_venta",
        on_delete=models.CASCADE,
        related_name="detalles",
    )
    producto = models.ForeignKey(
        Producto,
        db_column="id_producto",
        on_delete=models.PROTECT,
        related_name="detalles_venta",
    )
    cantidad = models.IntegerField()
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)

    TIPO_PRECIO_CHOICES = [
        ("normal", "Normal"),
        ("mayoreo", "Mayoreo"),
        ("promocion", "Promoción"),
        ("editado", "Editado"),
    ]
    tipo_precio = models.CharField(max_length=10, choices=TIPO_PRECIO_CHOICES, default="normal")

    class Meta:
        db_table = "DetalleVenta"
   

    def __str__(self):
        return f"Detalle {self.pk} (Venta {self.venta_id})"


class Compra(models.Model):
    id = models.AutoField(primary_key=True, db_column="id_compra")
    proveedor = models.CharField(max_length=120)
    fecha_compra = models.DateTimeField()
    nota = models.CharField(max_length=200, blank=True, default="")
    usuario = models.ForeignKey(
        Usuario,
        db_column="id_usuario",
        on_delete=models.PROTECT,
        related_name="compras",
    )
    total = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = "Compra"
        verbose_name = "Compra"
        verbose_name_plural = "Compras"

    def __str__(self):
        return f"Compra #{self.pk} - {self.proveedor}"


class DetalleCompra(models.Model):
    id = models.AutoField(primary_key=True, db_column="id_detalle_compra")
    compra = models.ForeignKey(
        Compra,
        db_column="id_compra",
        on_delete=models.CASCADE,
        related_name="detalles",
    )
    producto = models.ForeignKey(
        Producto,
        db_column="id_producto",
        on_delete=models.PROTECT,
        related_name="detalles_compra",
    )
    cantidad = models.IntegerField()
    costo_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    fecha_caducidad = models.DateField(null=True, blank=True)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = "DetalleCompra"
        verbose_name = "Detalle de compra"
        verbose_name_plural = "Detalles de compra"

    def __str__(self):
        return f"Detalle {self.pk} (Compra {self.compra_id})"


class MovimientoInventario(models.Model):
    TIPO_ENTRADA = "entrada"
    TIPO_SALIDA = "salida"
    TIPO_MERMA = "merma"
    TIPO_CORRECCION = "correccion"
    TIPO_CHOICES = [
        (TIPO_ENTRADA, "Entrada"),
        (TIPO_SALIDA, "Salida"),
        (TIPO_MERMA, "Merma"),
        (TIPO_CORRECCION, "Correccion"),
    ]

    MOTIVO_MERMA_CADUCADO = "caducado"
    MOTIVO_MERMA_DANADO = "danado"
    MOTIVO_MERMA_CONSUMO_PROPIO = "consumo_propio"
    MOTIVO_MERMA_DEVOLUCION_PROVEEDOR = "devolucion_proveedor"
    MOTIVO_MERMA_OTRO = "otro"
    MOTIVO_MERMA_CHOICES = [
        (MOTIVO_MERMA_CADUCADO, "Caducado"),
        (MOTIVO_MERMA_DANADO, "Danado"),
        (MOTIVO_MERMA_CONSUMO_PROPIO, "Consumo propio"),
        (MOTIVO_MERMA_DEVOLUCION_PROVEEDOR, "Devolucion a proveedor"),
        (MOTIVO_MERMA_OTRO, "Otro"),
    ]

    id = models.AutoField(primary_key=True, db_column="id_movimiento")
    producto = models.ForeignKey(
        Producto,
        db_column="id_producto",
        on_delete=models.PROTECT,
        related_name="movimientos",
    )
    usuario = models.ForeignKey(
        Usuario,
        db_column="id_usuario",
        on_delete=models.PROTECT,
        related_name="movimientos",
    )
    venta = models.ForeignKey(
        Venta,
        db_column="id_venta",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movimientos",
    )
    compra = models.ForeignKey(
        Compra,
        db_column="id_compra",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movimientos",
    )
    tipo_movimiento = models.CharField(max_length=20, choices=TIPO_CHOICES)
    motivo_merma = models.CharField(
        max_length=30, choices=MOTIVO_MERMA_CHOICES, null=True, blank=True
    )
    motivo = models.CharField(max_length=200, null=True, blank=True)
    cantidad = models.IntegerField()
    stock_resultante = models.IntegerField(default=0)
    fecha_movimiento = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "MovimientoInventario"
        verbose_name = "Movimiento de inventario"
        verbose_name_plural = "Movimientos de inventario"
        constraints = [
            models.CheckConstraint(condition=Q(stock_resultante__gte=0), name="movimiento_stock_no_negativo"),
            CheckConstraint(
                condition=(
                    (~Q(tipo_movimiento="correccion") | Q(motivo__isnull=False))
                    & (~Q(tipo_movimiento="merma") | Q(motivo_merma__isnull=False))
                    & (~Q(motivo_merma="otro") | Q(motivo__isnull=False))
                ),
                name="chk_movimiento_motivo",
            ),
        ]

    def __str__(self):
        return f"{self.tipo_movimiento} - {self.producto.nombre} ({self.cantidad})"


# Compatibilidad con imports del proyecto original. Son aliases de la misma clase;
# no crean otros modelos ni otras tablas.
Movimiento = MovimientoInventario
