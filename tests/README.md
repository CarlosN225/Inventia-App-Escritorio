# Pruebas de Inventia

Esta carpeta guarda los **resultados** de las pruebas automatizadas, el **reporte de cobertura** y el resultado de los **linters**.
El código de las pruebas vive junto a cada app del backend.

| Archivo de pruebas | Qué cubre | Pruebas |
|---|---|---|
| `backend/usuarios/tests.py` | F-01 Acceso · F-02 Asistente inicial · F-11 Usuarios y permisos · Mi perfil | 27 |
| `backend/inventario/test_funciones.py` | F-03 a F-10, F-12, F-13 · configuración · promociones · avisos por correo | 61 |
| `backend/inventario/tests.py` | Movimientos de inventario (entradas, salidas, mermas y correcciones) | 21 |
| **Total** | | **109** |

Cada función de la matriz tiene al menos un caso con datos válidos y otro con datos inválidos o inexistentes.
Los nombres `test_cp_XX_YY_…` corresponden a los casos `CP-XX-YY` del documento de pruebas.
Todos los datos son ficticios. El correo se prueba con un buzón simulado en memoria: no se manda nada real.

## Cómo correrlas

Desde `backend/`, con el entorno virtual activo:

```bash
pip install coverage ruff                 # solo la primera vez
coverage run manage.py test -v 2          # corre las 109 pruebas
coverage report                           # porcentaje de cobertura en la consola
coverage report > ../tests/cobertura.txt  # lo guarda en esta carpeta
coverage html                             # reporte navegable en tests/cobertura_html/index.html
ruff check .                              # linter del backend
```

Desde `frontend/`:

```bash
npm run lint                              # linter del frontend (oxlint)
```

## Qué se mide y qué se excluye

La configuración está en `backend/.coveragerc`.

**Se mide:** el código propio de las apps `inventario` y `usuarios`.
- Vistas (controladores)
- Servicios (lógica de ventas, compras y movimientos)
- Serializadores (validación de entradas)
- Modelos y permisos
- Lógica de los avisos por correo

**Se excluye, porque no es lógica del sistema:**
- `migrations/`: código generado por Django.
- `management/commands/`: el script que carga los datos de demostración.
- `admin.py` y `apps.py`: configuración de Django.
- Los propios archivos de pruebas.
- La carpeta `inventia_backend/`: es configuración del proyecto (settings, urls y wsgi).

## Linters

| Parte | Herramienta | Configuración | Resultado |
|---|---|---|---|
| Backend | Ruff | `backend/ruff.toml` (reglas E, F y W de PEP 8; líneas de 120) | Sin errores |
| Frontend | oxlint | `frontend/.oxlintrc.json` | 0 errores; 14 avisos de estilo de React (`set-state-in-effect`, `preserve-manual-memoization`, `exhaustive-deps`) que no afectan el funcionamiento |
