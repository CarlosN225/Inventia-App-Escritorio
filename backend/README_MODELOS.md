# Backend — entrega de modelos, migraciones y datos de prueba

Esta carpeta parte del backend ORIGINAL que compartiste. El alcance es:

1. Modelos Django de las 12 entidades del DER.
2. `db_table` con los nombres de tabla de tu script y `db_column` para sus IDs.
3. Migraciones desde los modelos originales, conservando registros.
4. Comando de carga de datos de prueba, independiente de otros servicios.

El catálogo ampliado, las imágenes de 400 × 400, las promociones como función de
la aplicación y los procesos nuevos de compras/correcciones quedan para la
siguiente etapa. Sus entidades y campos están declarados para soportarlos después.

## Cómo agregarlo al proyecto original

1. Respalda tu carpeta `backend` actual.
2. Copia los archivos de esta carpeta encima de tu `backend` original.
   **Conserva tu archivo `backend/db.sqlite3`**: el ZIP no incluye una base que
   sobrescriba tus usuarios o datos. No borres tus archivos `0001_initial.py`.
   Conserva también tu entorno virtual si ya tienes uno.
3. Desde `backend`, con tu entorno Python activado:

```powershell
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py cargar_datos_prueba
python manage.py runserver
```

En una instalación nueva, Django crea `db.sqlite3` al ejecutar `migrate`.
Se probó con Python 3.12, Django 5.2.17 y Django REST Framework 3.16.1. Pillow es
necesario para el campo `ImageField`, aunque el procesamiento de fotos se hará
más adelante. No hay que cambiar ni copiar el frontend.

El propietario de prueba usa:

- Correo: `admin@inventia.test`
- Contraseña: `InventiaDemo2026!`

El comando agrega un negocio, su configuración, 5 categorías y 50 productos.
Por cada producto nuevo deja un movimiento inicial con autor y stock resultante.
Puede ejecutarse otra vez: no duplica productos ni movimientos, no cambia
contraseñas y no reinicia existencias. La contraseña solo se puede especificar
al crear el usuario de prueba en una base donde todavía no existe:

```powershell
python manage.py cargar_datos_prueba --contrasena "TuClaveDePrueba"
```

## Tablas

| Modelo | Tabla (`db_table`) | Clave primaria en SQLite |
| --- | --- | --- |
| usuarios.Usuario | Usuario | id_usuario |
| Negocio | Negocio | id_negocio |
| Configuracion | Configuracion | id_configuracion |
| Categoria | Categoria | id_categoria |
| Producto | Producto | id_producto |
| Promocion | Promocion | id_promocion |
| Venta | Venta | id_venta |
| DetalleVenta | DetalleVenta | id_detalle_venta |
| Compra | Compra | id_compra |
| DetalleCompra | DetalleCompra | id_detalle_compra |
| MovimientoInventario | MovimientoInventario | id_movimiento |
| AlertaStock | AlertaStock | id_alerta |

Los nombres son los que aparecen realmente en `database/scripts_sql/inventia.db`.
Aunque el DER escribe algunos nombres con guiones bajos y mayúsculas, el script
usa CamelCase. El atributo Python de clave primaria sigue siendo `id` para
conservar la compatibilidad del módulo de usuarios.

Los modelos incluyen campos preparados para el trabajo posterior: imagen y
marca del producto, nota de compra y stock resultante del movimiento. Declarar
esos campos no implementa el manejo de imágenes ni las operaciones de compra.

## Archivos y compatibilidad

Cambios principales:

- `inventario/models.py`
- `usuarios/models.py`
- Migraciones nuevas en ambas aplicaciones (se conservan las iniciales).
- `inventario/management/commands/cargar_datos_prueba.py` y sus `__init__.py`.
- `requirements.txt`, con dependencias verificadas.

También fue necesario ajustar mínimamente estos tres archivos existentes:

- `inventario/serializers.py`: traduce los nombres originales `codigo`,
  `cantidad`, `tipo`, `fecha` y `observaciones` a las columnas del DER.
- `inventario/views.py`: cambia solamente los nombres de los dos campos de
  fecha usados para ordenar movimientos y alertas.
- `inventario/services.py`: mantiene la operación ORIGINAL de entradas/salidas;
  adapta los nombres de campos y completa el autor y saldo que exige el DER.

Estos ajustes conservan las rutas y los formatos de la API original. No añaden
endpoints de compras, correcciones, promociones ni subida de imágenes. Los aliases
`Movimiento` y `Alerta` permiten que los imports originales sigan funcionando;
no crean otras tablas. La función general nueva para los cuatro tipos de
movimientos no forma parte de esta entrega.

La configuración, las rutas principales, la autenticación, los permisos,
los administradores, el empaquetado y las demás vistas de usuarios son los del
ZIP original. El ajuste de compatibilidad no completa las funciones que ya
estaban pendientes en ese proyecto.

## Migración de registros anteriores

Se renombran tablas y campos, sin borrar y recrear tus datos. Se conserva el
stock existente y se reconstruye el saldo resultante de los movimientos
anteriores. Si un registro no tenía autor, se vincula a una cuenta histórica
inactiva. Los productos sin categoría reciben una categoría histórica.

`database/scripts_sql/inventia.db` es una base de referencia distinta de
`backend/db.sqlite3`: estas migraciones se aplican a la base del backend, no
importan automáticamente el otro archivo. No apuntes directamente a la base de
referencia con `--fake`: usa el historial normal de migraciones de Django.

## Validación

Se comprobó la migración desde una base nueva y desde la estructura anterior
con registros, la coincidencia entre modelos y migraciones, la carga de 50
productos sin duplicados, el login y las rutas originales de consulta y
entradas/salidas. Se conserva `tests.py` del proyecto original; las pruebas de
verificación se ejecutaron aparte para no agregar funciones ajenas al alcance.

```powershell
python manage.py check
python manage.py makemigrations --check --dry-run
```
