"""
Carga datos de prueba para Inventia: usuario administrador, negocio,
configuracion, 5 categorias y 50 productos de dulceria.

Uso:
    python manage.py cargar_datos_prueba
    python manage.py cargar_datos_prueba --contrasena "TuClaveDePrueba"

Idempotente: conserva productos, contraseñas y existencias ya registrados.
"""
import random
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction

from inventario.models import Categoria, Configuracion, Negocio, Producto, MovimientoInventario
from usuarios.models import Usuario
from django.contrib.auth.hashers import make_password

CATEGORIAS = [
    ("Chocolates", "Chocolates de marca y granel"),
    ("Dulces y gomitas", "Dulces, gomitas y chicles"),
    ("Papeleria y pinateria", "Pinatas, bolsas y articulos de fiesta"),
    ("Botanas saladas", "Papas, cacahuates y frituras"),
    ("Bebidas", "Refrescos, aguas y jugos en botella/lata"),
]

# (nombre, categoria(indice 0-4), unidad_medida, precio_venta, precio_mayoreo,
#  cantidad_minima_mayoreo, piezas_por_empaque, usa_caducidad)
PRODUCTOS = [
    ("Chocolate Carlos V", 0, "pieza", 12.0, 10.0, 12, 20, True),
    ("Chocolate Kinder Bueno", 0, "pieza", 22.0, 19.0, 10, 24, True),
    ("Chocolate Ferrero Rocher 3pz", 0, "caja", 45.0, 40.0, 6, 16, True),
    ("Chocolate Milky Way", 0, "pieza", 15.0, None, None, 20, True),
    ("Chocolate Snickers", 0, "pieza", 16.0, 14.0, 12, 24, True),
    ("Chocolate Hershey's Barra", 0, "pieza", 18.0, None, None, 24, True),
    ("Chocolate M&M's bolsa", 0, "bolsa", 20.0, 17.0, 10, 24, True),
    ("Chocolate Turin Oblea", 0, "pieza", 8.0, 6.5, 20, 30, False),
    ("Chocolate Abuelita tableta", 0, "pieza", 28.0, None, None, 12, True),
    ("Chocolate Lindt trufa", 0, "pieza", 35.0, 30.0, 6, 12, True),

    ("Gomitas Trululu bolsa", 1, "bolsa", 10.0, 8.0, 15, 30, False),
    ("Paleta Payaso", 1, "pieza", 6.0, 5.0, 24, 50, True),
    ("Pulparindo", 1, "pieza", 7.0, 5.5, 20, 40, True),
    ("Vero Mango", 1, "pieza", 5.0, 4.0, 30, 50, True),
    ("Dulce de tamarindo enchilado", 1, "pieza", 8.0, 6.0, 20, 40, False),
    ("Mazapan De la Rosa", 1, "pieza", 6.5, 5.0, 24, 48, True),
    ("Gomitas osito Haribo", 1, "bolsa", 18.0, 15.0, 10, 24, False),
    ("Chicle Trident sin azucar", 1, "paquete", 14.0, 12.0, 12, 24, True),
    ("Paleta Hot Wheels", 1, "pieza", 5.5, 4.5, 24, 48, True),
    ("Caramelos macizos surtidos", 1, "bolsa", 25.0, 20.0, 6, 12, False),
    ("Obleas rellenas", 1, "pieza", 4.0, 3.0, 30, 60, False),
    ("Gomitas acidas Sonric's", 1, "bolsa", 12.0, 10.0, 15, 30, False),

    ("Pinata estrella mediana", 2, "pieza", 120.0, 100.0, 3, 6, False),
    ("Pinata personaje infantil", 2, "pieza", 180.0, 150.0, 3, 6, False),
    ("Bolsa de dulces para fiesta", 2, "paquete", 15.0, 12.0, 10, 20, False),
    ("Confeti bolsa", 2, "bolsa", 20.0, None, None, 12, False),
    ("Serpentina rollo", 2, "pieza", 10.0, None, None, 24, False),
    ("Gorro de fiesta paquete 10pz", 2, "paquete", 35.0, 30.0, 6, 12, False),
    ("Globo numero metalico", 2, "pieza", 45.0, 38.0, 6, 10, False),
    ("Pinata burro tradicional", 2, "pieza", 150.0, 130.0, 3, 6, False),

    ("Papas Sabritas original", 3, "bolsa", 18.0, 15.0, 12, 24, True),
    ("Cacahuate japones", 3, "bolsa", 14.0, 11.0, 15, 30, True),
    ("Chicharron de cerdo", 3, "bolsa", 22.0, 18.0, 10, 20, True),
    ("Doritos queso", 3, "bolsa", 19.0, 16.0, 12, 24, True),
    ("Cheetos flamin hot", 3, "bolsa", 19.0, 16.0, 12, 24, True),
    ("Totopos Barcel", 3, "bolsa", 17.0, 14.0, 12, 24, True),
    ("Palomitas microondas", 3, "caja", 24.0, 20.0, 8, 16, True),
    ("Cacahuate garapinado", 3, "bolsa", 16.0, 13.0, 15, 30, True),
    ("Papas Ruffles queso", 3, "bolsa", 20.0, 17.0, 12, 24, True),
    ("Churritos Takis", 3, "bolsa", 18.0, 15.0, 12, 24, True),

    ("Coca-Cola 600ml", 4, "pieza", 18.0, 16.0, 12, 24, True),
    ("Agua Bonafont 600ml", 4, "pieza", 12.0, 10.0, 12, 24, True),
    ("Jugo Boing 500ml", 4, "pieza", 14.0, 12.0, 12, 24, True),
    ("Refresco Sidral Mundet lata", 4, "pieza", 15.0, 13.0, 12, 24, True),
    ("Gatorade 600ml", 4, "pieza", 20.0, 17.0, 10, 20, True),
    ("Agua mineral Topo Chico", 4, "pieza", 16.0, 14.0, 12, 24, True),
    ("Jumex nectar 335ml", 4, "pieza", 11.0, 9.0, 15, 30, True),
    ("Refresco Manzanita Sol lata", 4, "pieza", 14.0, 12.0, 12, 24, True),
    ("Te Lipton 600ml", 4, "pieza", 17.0, 15.0, 12, 24, True),
    ("Electrolit 625ml", 4, "pieza", 28.0, 24.0, 8, 16, True),
]


class Command(BaseCommand):
    help = "Carga datos de prueba de Inventia (usuario, negocio, 5 categorias y 50 productos)"

    def add_arguments(self, parser):
        parser.add_argument('--contrasena', default='InventiaDemo2026!', help='Contraseña del usuario de prueba al crearlo.')

    @transaction.atomic
    def handle(self, *args, **options):
        random.seed(42)

        usuario, creado = Usuario.objects.get_or_create(
            correo="admin@inventia.test",
            defaults={
                "nombre_completo": "Admin Inventia",
                "contrasena_hash": make_password(options["contrasena"]),
                "telefono_whatsapp": "5215500000000",
                "rol": Usuario.ROL_PROPIETARIO,
                "activo": True,
            },
        )
        self.stdout.write(self.style.SUCCESS(f"Usuario: {usuario.nombre_completo} ({'creado' if creado else 'ya existia'})"))

        negocio, creado = Negocio.objects.get_or_create(
            nombre="Dulceria Inventia",
            defaults={
                "propietario": usuario.nombre_completo,
                "direccion": "Av. Principal 123, CDMX",
                "telefono": "5215500000001",
                "usuario_admin": usuario,
            },
        )
        self.stdout.write(self.style.SUCCESS(f"Negocio: {negocio.nombre} ({'creado' if creado else 'ya existia'})"))

        Configuracion.objects.get_or_create(
            negocio=negocio,
            defaults={
                "maneja_caducidad": True,
                "maneja_promociones": True,
                "usa_codigo_barras": True,
                "alertas_activas": True,
                "vende_mayoreo": True,
            },
        )

        categorias_obj = []
        for nombre, descripcion in CATEGORIAS:
            cat, creado = Categoria.objects.get_or_create(
                nombre=nombre, defaults={"descripcion": descripcion, "activa": True}
            )
            categorias_obj.append(cat)
        self.stdout.write(self.style.SUCCESS(f"Categorias listas: {len(categorias_obj)}"))

        base_date = date.today()
        creados = 0
        for i, (nombre, cat_idx, unidad, precio, mayoreo, cant_min, empaque, usa_cad) in enumerate(PRODUCTOS, start=1):
            if usa_cad:
                fecha_cad = base_date + timedelta(days=random.randint(30, 400))
            else:
                fecha_cad = None
            stock_minimo = random.choice([5, 8, 10, 12, 15])
            stock_maximo = stock_minimo * random.choice([6, 8, 10])

            producto, creado = Producto.objects.get_or_create(
                nombre=nombre,
                categoria=categorias_obj[cat_idx],
                defaults={
                    "codigo_barras": f"750{1000000 + i:07d}",
                    "unidad_medida": unidad,
                    "precio_venta": precio,
                    "precio_mayoreo": mayoreo,
                    "cantidad_minima_mayoreo": cant_min,
                    "piezas_por_empaque": empaque,
                    "fecha_caducidad": fecha_cad,
                    "stock_actual": random.randint(5, 120),
                    "stock_minimo": stock_minimo,
                    "stock_maximo": stock_maximo,
                    "activo": True,
                },
            )
            if creado:
                # Fixture inicial, no una nueva función de operaciones de inventario.
                MovimientoInventario.objects.create(producto=producto, usuario=usuario,
                    tipo_movimiento='entrada', cantidad=producto.stock_actual,
                    stock_resultante=producto.stock_actual, motivo='Datos iniciales de prueba')
                creados += 1

        self.stdout.write(self.style.SUCCESS(f"Productos nuevos creados: {creados} (total en catalogo definido: {len(PRODUCTOS)})"))
        self.stdout.write(self.style.SUCCESS("Datos de prueba cargados correctamente."))
