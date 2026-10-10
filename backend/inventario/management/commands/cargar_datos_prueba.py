"""
Carga datos de prueba para Inventia: propietaria (Ana Luisa), un encargado,
negocio, configuración, las 16 categorías fijas y 50 productos de dulcería.

Uso:
    python manage.py cargar_datos_prueba
    python manage.py cargar_datos_prueba --con-ventas          (30 días de ventas, para la demo)
    python manage.py cargar_datos_prueba --con-ventas --dias 45
    python manage.py cargar_datos_prueba --contrasena "OtraClave"

Idempotente: si se corre dos veces no duplica nada. Las ventas de ejemplo solo
se generan cuando los productos se acaban de crear (base limpia).
"""
import random
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from inventario.models import (
    Categoria,
    Configuracion,
    DetalleVenta,
    MovimientoInventario,
    Negocio,
    Producto,
    Venta,
)
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

# Qué tanto se vende cada categoría (para que el Top tenga sentido)
POPULARIDAD = {0: 3, 1: 4, 2: 4, 3: 2, 4: 3, 5: 2, 6: 4, 7: 2, 8: 4, 9: 1, 10: 0.3, 11: 1, 12: 1, 13: 1, 14: 0.8, 15: 0.5}

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


def momento(dia, hora, minuto):
    return timezone.make_aware(datetime.combine(dia, time(hora, minuto)))


class Command(BaseCommand):
    help = "Carga datos de prueba de Inventia (propietaria, encargado, negocio, 16 categorías y 50 productos)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--contrasena',
            default='Char123',
            help='Contraseña de la propietaria de prueba (solo se usa al crearla).',
        )
        parser.add_argument(
            '--con-ventas',
            action='store_true',
            help='Genera un historial de ventas realista (para la demo).',
        )
        parser.add_argument(
            '--dias',
            type=int,
            default=30,
            help='Cuántos días de ventas generar con --con-ventas (por defecto 30).',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        random.seed(42)

        # ---------- Usuarios ----------
        propietaria, creado = Usuario.objects.get_or_create(
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
            f"Propietaria: {propietaria.nombre_completo} ({'creada' if creado else 'ya existía'})"
        ))

        encargado, creado = Usuario.objects.get_or_create(
            correo="luis@querubines.com",
            defaults={
                "nombre_completo": "Luis Hernández Pérez",
                "contrasena_hash": make_password("Luis2026"),
                "telefono_whatsapp": "5511111111",
                "rol": Usuario.ROL_ENCARGADO,
                "activo": True,
            },
        )
        self.stdout.write(self.style.SUCCESS(
            f"Encargado: {encargado.nombre_completo} ({'creado' if creado else 'ya existía'})"
        ))

        # ---------- Negocio y preferencias ----------
        negocio, creado = Negocio.objects.get_or_create(
            nombre="Dulcería Los Querubines",
            defaults={
                "propietario": propietaria.nombre_completo,
                "direccion": "Calle Morelos 12, Col. Centro",
                "telefono": "5512345678",
                "usuario_admin": propietaria,
            },
        )
        self.stdout.write(self.style.SUCCESS(
            f"Negocio: {negocio.nombre} ({'creado' if creado else 'ya existía'})"
        ))

        # Código de barras apagado (la mayoría de las dulcerías no lo usa)
        Configuracion.objects.get_or_create(
            negocio=negocio,
            defaults={
                "maneja_caducidad": True,
                "maneja_promociones": True,
                "usa_codigo_barras": False,
                "alertas_activas": True,
                "vende_mayoreo": True,
                "telefono_alertas": propietaria.telefono_whatsapp,
                "contacto_alertas": propietaria.nombre_completo,
            },
        )

        categorias_obj = []
        for nombre, descripcion in CATEGORIAS:
            categoria, _ = Categoria.objects.get_or_create(
                nombre=nombre, defaults={"descripcion": descripcion, "activa": True}
            )
            categorias_obj.append(categoria)
        self.stdout.write(self.style.SUCCESS(f"Categorías listas: {len(categorias_obj)}"))

        # ---------- Planear cada producto (stock final de la demo) ----------
        hoy = date.today()
        planes = []

        for i, (nombre, cat_idx, unidad, precio, mayoreo, cant_min, empaque, usa_cad) in enumerate(PRODUCTOS, start=1):
            # Cada 9° producto con caducidad vence pronto (sale en "Por caducar")
            if usa_cad and i % 9 == 0:
                fecha_cad = hoy + timedelta(days=random.randint(3, 25))
            elif usa_cad:
                fecha_cad = hoy + timedelta(days=random.randint(45, 400))
            else:
                fecha_cad = None

            stock_minimo = random.choice([5, 8, 10, 12, 15])
            stock_maximo = stock_minimo * random.choice([6, 8, 10])

            # Algunos agotados y algunos en stock bajo, siempre los mismos
            if i % 17 == 0:
                stock_final = 0
            elif i % 6 == 0:
                stock_final = random.randint(1, stock_minimo - 1)
            else:
                stock_final = random.randint(stock_minimo, stock_maximo)

            planes.append({
                "i": i,
                "nombre": nombre,
                "categoria": categorias_obj[cat_idx],
                "cat_idx": cat_idx,
                "unidad": unidad,
                "precio": precio,
                "mayoreo": mayoreo,
                "cant_min": cant_min,
                "empaque": empaque,
                "fecha_cad": fecha_cad,
                "stock_minimo": stock_minimo,
                "stock_maximo": stock_maximo,
                "stock_final": stock_final,
                "costo": round(precio * random.choice([0.62, 0.66, 0.70]), 2),
                "vendidos": 0,
            })

        # ---------- Planear las ventas (si se pidieron) ----------
        ventas_planeadas = []

        if options["con_ventas"]:
            pesos = [POPULARIDAD[p["cat_idx"]] for p in planes]
            ahora = timezone.localtime()

            for atras in range(options["dias"] - 1, -1, -1):
                dia = hoy - timedelta(days=atras)
                fin_de_semana = dia.weekday() >= 5
                cuantas = random.randint(8, 12) if fin_de_semana else random.randint(4, 7)

                for _ in range(cuantas):
                    hora = random.randint(9, 20)
                    minuto = random.randint(0, 59)

                    # Las de hoy, solo hasta la hora actual
                    if atras == 0 and (hora, minuto) >= (ahora.hour, ahora.minute):
                        continue

                    renglones = []
                    elegidos = set()

                    for _ in range(random.choice([1, 1, 2, 2, 3, 4])):
                        plan = random.choices(planes, weights=pesos, k=1)[0]
                        if plan["i"] in elegidos:
                            continue
                        elegidos.add(plan["i"])

                        # De vez en cuando, una venta a mayoreo
                        if plan["mayoreo"] and plan["cant_min"] and random.random() < 0.06:
                            cantidad, tipo = plan["cant_min"], "mayoreo"
                        else:
                            cantidad, tipo = random.choice([1, 1, 1, 2, 2, 3]), "normal"

                        plan["vendidos"] += cantidad
                        renglones.append((plan, cantidad, tipo))

                    if renglones:
                        vendedor = encargado if random.random() < 0.4 else propietaria
                        ventas_planeadas.append((momento(dia, hora, minuto), vendedor, renglones))

            ventas_planeadas.sort(key=lambda v: v[0])

        # ---------- Crear los productos ----------
        inicio_historial = momento(hoy - timedelta(days=options["dias"]), 8, 0)
        creados = 0

        for plan in planes:
            # Arranca con su stock final + lo que se va a vender, para que al final cuadre
            stock_inicial = plan["stock_final"] + plan["vendidos"]

            producto, creado = Producto.objects.get_or_create(
                nombre=plan["nombre"],
                categoria=plan["categoria"],
                defaults={
                    "codigo_barras": f"750{1000000 + plan['i']:07d}",
                    "unidad_medida": plan["unidad"],
                    "precio_venta": plan["precio"],
                    "ultimo_costo": plan["costo"],
                    "precio_mayoreo": plan["mayoreo"],
                    "cantidad_minima_mayoreo": plan["cant_min"],
                    "piezas_por_empaque": plan["empaque"],
                    "tipo_empaque": "caja" if plan["empaque"] else None,
                    "fecha_caducidad": plan["fecha_cad"],
                    "stock_actual": stock_inicial,
                    "stock_minimo": plan["stock_minimo"],
                    "stock_maximo": plan["stock_maximo"],
                    "activo": True,
                },
            )
            plan["producto"] = producto

            # Entrada inicial (los que arrancan en 0 no llevan, porque sería una entrada de 0)
            if creado and stock_inicial > 0:
                mov = MovimientoInventario.objects.create(
                    producto=producto,
                    usuario=propietaria,
                    tipo_movimiento='entrada',
                    cantidad=stock_inicial,
                    stock_resultante=stock_inicial,
                    motivo='Inventario inicial',
                )
                MovimientoInventario.objects.filter(pk=mov.pk).update(fecha_movimiento=inicio_historial)

            if creado:
                creados += 1

        self.stdout.write(self.style.SUCCESS(
            f"Productos nuevos creados: {creados} (total en el catálogo de prueba: {len(PRODUCTOS)})"
        ))

        # ---------- Aplicar las ventas, día por día ----------
        if ventas_planeadas and creados < len(PRODUCTOS):
            self.stdout.write(self.style.WARNING(
                "No se generaron ventas: ya había productos. Usa --con-ventas sobre una base limpia."
            ))
        elif ventas_planeadas:
            for cuando, vendedor, renglones in ventas_planeadas:
                venta = Venta.objects.create(usuario=vendedor, total=Decimal("0"), fecha_venta=cuando)
                total = Decimal("0")

                for plan, cantidad, tipo in renglones:
                    producto = plan["producto"]
                    precio = Decimal(str(plan["mayoreo"] if tipo == "mayoreo" else plan["precio"]))
                    subtotal = precio * cantidad

                    DetalleVenta.objects.create(
                        venta=venta,
                        producto=producto,
                        cantidad=cantidad,
                        precio_unitario=precio,
                        subtotal=subtotal,
                        tipo_precio=tipo,
                    )

                    producto.stock_actual -= cantidad
                    producto.save(update_fields=["stock_actual"])

                    mov = MovimientoInventario.objects.create(
                        producto=producto,
                        usuario=vendedor,
                        venta=venta,
                        tipo_movimiento='salida',
                        cantidad=cantidad,
                        stock_resultante=producto.stock_actual,
                        motivo=f"Venta #{venta.pk}",
                    )
                    # La fecha real de la venta (el modelo pone "ahora" al crear)
                    MovimientoInventario.objects.filter(pk=mov.pk).update(fecha_movimiento=cuando)

                    total += subtotal

                venta.total = total
                venta.save(update_fields=["total"])
                Venta.objects.filter(pk=venta.pk).update(fecha_venta=cuando)

            self.stdout.write(self.style.SUCCESS(
                f"Ventas de ejemplo: {len(ventas_planeadas)} en los últimos {options['dias']} días"
            ))

        self.stdout.write(self.style.SUCCESS("Datos de prueba cargados correctamente."))