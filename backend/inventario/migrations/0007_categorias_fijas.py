"""
Las 16 categorías fijas de Inventia (con "Otros" como respaldo).

Es una migración de datos: no crea tablas, mete los datos que toda dulcería
necesita desde el primer día, para poder dar de alta productos.
Si ya existen (ej. las creó cargar_datos_prueba), no las duplica.
"""
from django.db import migrations

CATEGORIAS = [
    ("Dulces", "Dulces enchilados, tamarindos, mazapanes y caramelos"),
    ("Chocolates", "Chocolates de marca"),
    ("Paletas", "Paletas de caramelo y enchiladas"),
    ("Chicles", "Chicles y gomas de mascar"),
    ("Gomitas", "Gomitas y dulces de grenetina"),
    ("Galletas", "Galletas y obleas"),
    ("Botanas", "Papas, cacahuates y frituras"),
    ("Salsas y chamoy", "Salsas, chamoy y polvos enchilados"),
    ("Bebidas", "Refrescos, aguas y jugos"),
    ("Globos", "Globos de látex y metálicos"),
    ("Piñatas", "Piñatas"),
    ("Velas", "Velas de cumpleaños y de número"),
    ("Desechables", "Platos, vasos y cubiertos desechables"),
    ("Artículos de fiesta", "Confeti, serpentinas, gorros y decoración"),
    ("Juguetes", "Juguetes pequeños"),
    ("Otros", "Lo que no entra en ninguna otra categoría"),
]


def crear_categorias(apps, schema_editor):
    Categoria = apps.get_model("inventario", "Categoria")
    for nombre, descripcion in CATEGORIAS:
        Categoria.objects.get_or_create(nombre=nombre, defaults={"descripcion": descripcion, "activa": True})


class Migration(migrations.Migration):

    dependencies = [
        ("inventario", "0006_campos_faltantes_y_quitar_alertastock"),
    ]

    operations = [
        # Al revertir no se borran: podría haber productos usándolas
        migrations.RunPython(crear_categorias, migrations.RunPython.noop),
    ]