"""Este código le dirá a la base de datos (SQLite) qué información necesitas 
guardar sobre las categorías y los productos:"""""

from django.db import models

class Categoria(models.Model):
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.nombre

class Producto(models.Model):
    codigo = models.CharField(max_length=50, unique=True)
    nombre = models.CharField(max_length=200)
    categoria = models.ForeignKey(Categoria, on_delete=models.SET_NULL, null=True)
    cantidad = models.IntegerField(default=0)
    stock_minimo = models.IntegerField(default=5)

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"

class Movimiento(models.Model):
    TIPO_CHOICES = [
        ('ENTRADA', 'Entrada'),
        ('SALIDA', 'Salida'),
    ]
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE)
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    cantidad = models.IntegerField()
    fecha = models.DateTimeField(auto_now_add=True)
    observaciones = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.tipo} - {self.producto.nombre} ({self.cantidad})"

class Alerta(models.Model):
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE)
    mensaje = models.CharField(max_length=255)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    enviada_whatsapp = models.BooleanField(default=False)

    def __str__(self):
        return f"Alerta: {self.producto.nombre} - Enviada: {self.enviada_whatsapp}"