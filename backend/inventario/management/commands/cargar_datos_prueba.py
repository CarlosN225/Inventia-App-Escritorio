"""
Carga datos de prueba para Inventia: propietaria (Ana Luisa), negocio,
configuración, las 16 categorías fijas y 50 productos de dulcería.

Uso:
    python manage.py cargar_datos_prueba
    python manage.py cargar_datos_prueba --contrasena "OtraClave"

Idempotente: si se corre dos veces no duplica nada; conserva productos,
contraseñas y existencias ya registrados.
"""
import random
from datetime import date, timedelta

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.db import transaction

from inventario.models import Categoria, Configuracion, MovimientoInventario, Negocio, Producto
from usuarios.models import Usuario

# Las 16 categorías fijas que se acordaron (sin texto libre; "Otros" como respaldo)
CATEGORIAS = [
    ("Dulces", "Dulces enchilados, tamarindos, mazapanes y caramelos"),        # 0
    ("Chocolates", "Chocolates de marca"),                                     # 1
    ("Paletas", "Paletas de caramelo y enchiladas"),                           # 2
    ("Chicles", "Chicles y gomas de mascar"),                                  # 3
    ("Gomitas", "Gomitas y dulces de grenetina"),                              # 4
    ("Galletas", "Galletas y obleas"),                                         # 5
    ("Botanas", "Papas, cacahuates y frituras"),                               # 6
    ("Salsas y chamoy", "Salsas, chamoy y polvos enchilados"),                 # 7
    ("Bebidas", "Refrescos, aguas y jugos"),                                   # 8
    ("Globos", "Globos de látex y metálicos"),                                 # 9
    ("Piñatas", "Piñatas"),                                                    # 10
    ("Velas", "Velas de cumpleaños y de número"),                              # 11
    ("Desechables", "Platos, vasos y cubiertos desechables"),                  # 12
    ("Artículos de fiesta", "Confeti, serpentinas, gorros y decoración"),      # 13
    ("Juguetes", "Juguetes pequeños"),                                         # 14
    ("Otros", "Lo que no entra en ninguna otra categoría"),                    # 15
]

# (nombre, categoría (índice), unidad_medida, precio_venta, precio_mayoreo,
#  cantidad_minima_mayoreo, piezas_por_empaque, maneja_caducidad)
PRODUCTOS = [
    # Chocolates
    ("Chocolate Carlos V", 1, "pieza", 12.0, 10.0, 12, 20, True),
    ("Chocolate Kinder Bueno", 1, "pieza", 22.0, 19.0, 10, 24, True),
    ("Chocolate Ferrero Rocher 3pz", 1, "caja", 45.0, 40.0, 6, 16, True),
    ("Chocolate Snickers", 1, "pieza", 16.0, 14.0, 12, 24, True),
    ("Chocolate Hershey's barra", 1, "pieza", 18.0, None, None, 24, True),
    ("Chocolate M&M's bolsa", 1, "bolsa", 20.0, 17.0, 10, 24, True),
    ("Chocolate Turín oblea", 1, "pieza", 8.0, 6.5, 20, 30, False),
    ("Chocolate Abuelita tableta", 1, "pieza", 28.0, None, None, 12, True),
    ("Chocolate Lindt trufa", 1, "pieza", 35.0, 30.0, 6, 12, True),

    # Galletas
    ("Galletas Emperador", 5, "pieza", 16.0, 14.0, 12, 24, True),
    ("Obleas rellenas", 5, "pieza", 4.0, 3.0, 30, 60, False),

    # Gomitas
    ("Gomitas Trululu bolsa", 4, "bolsa", 10.0, 8.0, 15, 30, False),
    ("Gomitas osito Haribo", 4, "bolsa", 18.0, 15.0, 10, 24, False),
    ("Gomitas ácidas Sonric's", 4, "bolsa", 12.0, 10.0, 15, 30, False),

    # Paletas
    ("Paleta Payaso", 2, "pieza", 6.0, 5.0, 24, 50, True),
    ("Paleta Hot Wheels", 2, "pieza", 5.5, 4.5, 24, 48, True),
    ("Paleta Vero Mango", 2, "pieza", 5.0, 4.0, 30, 50, True),

    # Dulces
    ("Pulparindo", 0, "pieza", 7.0, 5.5, 20, 40, True),
    ("Dulce de tamarindo enchilado", 0, "pieza", 8.0, 6.0, 20, 40, False),
    ("Mazapán De la Rosa", 0, "pieza", 6.5, 5.0, 24, 48, True),
    ("Caramelos macizos surtidos", 0, "bolsa", 25.0, 20.0, 6, 12, False),

    # Chicles
    ("Chicle Trident sin azúcar", 3, "paquete", 14.0, 12.0, 12, 24, True),

    # Botanas
    ("Papas Sabritas original", 6, "bolsa", 18.0, 15.0, 12, 24, True),
    ("Cacahuate japonés", 6, "bolsa", 14.0, 11.0, 15, 30, True),
    ("Chicharrón de cerdo", 6, "bolsa", 22.0, 18.0, 10, 20, True),
    ("Doritos queso", 6, "bolsa", 19.0, 16.0, 12, 24, True),
    ("Cheetos Flamin' Hot", 6, "bolsa", 19.0, 16.0, 12, 24, True),
    ("Palomitas para microondas", 6, "caja", 24.0, 20.0, 8, 16, True),
    ("Cacahuate garapiñado", 6, "bolsa", 16.0, 13.0, 15, 30, True),
    ("Takis Fuego", 6, "bolsa", 18.0, 15.0, 12, 24, True),

    # Salsas y chamoy
    ("Salsa Valentina 370ml", 7, "pieza", 24.0, 21.0, 12, 24, True),
    ("Chamoy Miguelito 250ml", 7, "pieza", 30.0, 26.0, 12, 24, True),

    # Bebidas
    ("Coca-Cola 600ml", 8, "pieza", 18.0, 16.0, 12, 24, True),
    ("Agua Bonafont 600ml", 8, "pieza", 12.0, 10.0, 12, 24, True),
    ("Jugo Boing 500ml", 8, "pieza", 14.0, 12.0, 12, 24, True),
    ("Gatorade 600ml", 8, "pieza", 20.0, 17.0, 10, 20, True),
    ("Electrolit 625ml", 8, "pieza", 28.0, 24.0, 8, 16, True),

    # Globos
    ("Globo número metálico", 9, "pieza", 45.0, 38.0, 6, 10, False),
    ("Globo látex #9", 9, "pieza", 3.0, 2.5, 50, 50, False),

    # Piñatas
    ("Piñata estrella mediana", 10, "pieza", 120.0, 100.0, 3, 6, False),
    ("Piñata personaje infantil", 10, "pieza", 180.0, 150.0, 3, 6, False),

    # Velas
    ("Velas de cumpleaños paq. 24", 11, "paquete", 18.0, 15.0, 10, 20, False),
    ("Vela número dorada", 11, "pieza", 25.0, 21.0, 10, 20, False),

    # Desechables
    ("Platos desechables paq. 20", 12, "paquete", 25.0, 22.0, 6, 12, False),
    ("Vasos desechables paq. 25", 12, "paquete", 22.0, 19.0, 6, 12, False),

    # Artículos de fiesta
    ("Confeti bolsa", 13, "bolsa", 20.0, None, None, 12, False),
    ("Serpentina rollo", 13, "pieza", 10.0, None, None, 24, False),
    ("Gorro de fiesta paq. 10", 13, "paquete", 35.0, 30.0, 6, 12, False),

    # Juguetes
    ("Pelota saltarina", 14, "pieza", 10.0, 8.0, 12, 24, False),

    # Otros
    ("Bolsa de regalo mediana", 15, "pieza", 15.0, 12.0, 10, 20, False),
]


class Command(BaseCommand):
    help = "Carga datos de prueba de Inventia (propietaria, negocio, 16 categorías y 50 productos)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--contrasena',
            default='Char123',
            help='Contraseña de la propietaria de prueba (solo se usa al crearla).',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        random.seed(42)

        # Propietaria de prueba (solo puede haber un propietario)
        usuario, creado = Usuario.objects.get_or_create(
            correo="ana@querubines.com",
            defaults={
                "nombre_completo": "Ana Luisa Reyes Martínez",
                "contrasena_hash": make_password(options["contrasena"]),
                "telefono_whatsapp": "5500000000",
                "rol": Usuario.ROL_PROPIETARIO,
                "activo": True,
            },
        )
        self.stdout.write(self.style.SUCCESS(
            f"Propietaria: {usuario.nombre_completo} ({'creada' if creado else 'ya existía'})"
        ))

        negocio, creado = Negocio.objects.get_or_create(
            nombre="Dulcería Los Querubines",
            defaults={
                "propietario": usuario.nombre_completo,
                "direccion": "Calle Morelos 12, Col. Centro",
                "telefono": "5512345678",
                "usuario_admin": usuario,
            },
        )
        self.stdout.write(self.style.SUCCESS(
            f"Negocio: {negocio.nombre} ({'creado' if creado else 'ya existía'})"
        ))

        # Preferencias: código de barras apagado (la mayoría de las dulcerías no lo usa)
        Configuracion.objects.get_or_create(
            negocio=negocio,
            defaults={
                "maneja_caducidad": True,
                "maneja_promociones": True,
                "usa_codigo_barras": False,
                "alertas_activas": True,
                "vende_mayoreo": True,
            },
        )

        categorias_obj = []
        for nombre, descripcion in CATEGORIAS:
            categoria, _ = Categoria.objects.get_or_create(
                nombre=nombre, defaults={"descripcion": descripcion, "activa": True}
            )
            categorias_obj.append(categoria)
        self.stdout.write(self.style.SUCCESS(f"Categorías listas: {len(categorias_obj)}"))

        hoy = date.today()
        creados = 0

        for i, (nombre, cat_idx, unidad, precio, mayoreo, cant_min, empaque, usa_cad) in enumerate(PRODUCTOS, start=1):
            # Para la demo: cada 9° producto con caducidad vence pronto (sale en "Por caducar")
            if usa_cad and i % 9 == 0:
                fecha_cad = hoy + timedelta(days=random.randint(3, 25))
            elif usa_cad:
                fecha_cad = hoy + timedelta(days=random.randint(45, 400))
            else:
                fecha_cad = None

            stock_minimo = random.choice([5, 8, 10, 12, 15])
            stock_maximo = stock_minimo * random.choice([6, 8, 10])

            # Para la demo: algunos agotados y algunos en stock bajo, siempre los mismos
            if i % 17 == 0:
                stock_actual = 0
            elif i % 6 == 0:
                stock_actual = random.randint(1, stock_minimo - 1)
            else:
                stock_actual = random.randint(stock_minimo, stock_maximo)

            producto, creado = Producto.objects.get_or_create(
                nombre=nombre,
                categoria=categorias_obj[cat_idx],
                defaults={
                    "codigo_barras": f"750{1000000 + i:07d}",
                    "unidad_medida": unidad,
                    "precio_venta": precio,
                    "ultimo_costo": round(precio * random.choice([0.62, 0.66, 0.70]), 2),
                    "precio_mayoreo": mayoreo,
                    "cantidad_minima_mayoreo": cant_min,
                    "piezas_por_empaque": empaque,
                    "tipo_empaque": "caja" if empaque else None,
                    "fecha_caducidad": fecha_cad,
                    "stock_actual": stock_actual,
                    "stock_minimo": stock_minimo,
                    "stock_maximo": stock_maximo,
                    "activo": True,
                },
            )

            # Movimiento de entrada inicial, para que el historial no arranque vacío
            # (los agotados no llevan movimiento, porque no se puede registrar una entrada de 0)
            if creado and producto.stock_actual > 0:
                MovimientoInventario.objects.create(
                    producto=producto,
                    usuario=usuario,
                    tipo_movimiento='entrada',
                    cantidad=producto.stock_actual,
                    stock_resultante=producto.stock_actual,
                    motivo='Datos iniciales de prueba',
                )

            if creado:
                creados += 1

        self.stdout.write(self.style.SUCCESS(
            f"Productos nuevos creados: {creados} (total en el catálogo de prueba: {len(PRODUCTOS)})"
        ))
        self.stdout.write(self.style.SUCCESS("Datos de prueba cargados correctamente."))