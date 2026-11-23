# Inventia

**Sistema de inventario para dulcerías** · Aplicación de escritorio para Windows · Versión **1.1.0**

Proyecto Integrador · Equipo 05 · Grupo 1002 · Universidad Tecnológica Fidel Velázquez · Docente: Nora García González

---

## 1. Descripción

Muchas dulcerías pequeñas llevan su mercancía en libreta o de memoria: no saben con certeza qué tienen, se les caducan productos y no saben cuánto ganan.

Inventia es una aplicación de escritorio que:

- Registra **ventas** (con lector de código de barras), **compras** y **mermas**, y actualiza el inventario sola.
- Avisa de productos **por agotarse o por caducar**.
- Calcula la **ganancia estimada** en el Panel principal.
- **Respalda** la información (automático diario, por correo cada viernes, en USB) y la restaura en otro equipo.
- **Funciona sin internet.** Solo los avisos y el respaldo por correo lo necesitan.

Tiene dos roles: **propietario** (configura el negocio, autoriza cambios de precio con su PIN, corrige el inventario) y **encargado** (atiende el mostrador).

Caso de referencia: Dulcería «Los Querubines» (datos ficticios). Prueba piloto con contrato en 3 negocios reales de Nicolás Romero, Estado de México.

## 2. Funciones

| ID | Función | ID | Función |
|---|---|---|---|
| F-01 | Acceso (iniciar y cerrar sesión) | F-09 | Alertas de stock y caducidad |
| F-02 | Configuración inicial (asistente) | F-10 | Avisos por correo |
| F-03 | Catálogo de productos | F-11 | Usuarios y permisos |
| F-04 | Registrar venta | F-12 | Autorizar cambio de precio con PIN |
| F-05 | Registrar compra | F-13 | Panel principal |
| F-06 | Registrar merma | F-14 | Respaldos |
| F-07 | Corrección de inventario | F-15 | Recuperación de cuenta |
| F-08 | Historial y exportación (Excel y PDF) | | |

## 3. Tecnologías y versiones

| Capa | Tecnología | Versión |
|---|---|---|
| Backend | Python · Django · Django REST Framework | 3.13 · 6.1.1 · 3.18.1 |
| Base de datos | SQLite | 3 (incluida en Python) |
| Frontend | React · React Router · Bootstrap · Vite | 19.2 · 7.18 · 5.3.8 · 8.3 |
| Tareas programadas | APScheduler | 3.11.0 |
| Correo | SMTP de Brevo | Plan gratuito |
| Escritorio | pywebview (con Microsoft Edge WebView2) | 6.2.1 |
| Empaquetado | PyInstaller | 6.22.3 |
| Pruebas | unittest de Django · Coverage.py · Ruff · oxlint | — · 7.17.2 · 0.17 · 1.81 |

## 4. Requisitos previos

**Para usar el programa (.exe):**

- Windows 10 u 11 de 64 bits, 4 GB de RAM y 200 MB libres.
- Microsoft Edge WebView2 (ya viene en Windows 10 y 11 actualizados).
- No se necesita Python, Node ni internet.

**Para correr el código fuente:**

- Python 3.13
- Node.js 22 y npm
- Git y Git Bash

## 5. Opción A: usar el ejecutable (recomendada)

1. Descargar **[Inventia.exe](empaquetado/salida/Inventia.exe)** (carpeta `empaquetado/salida/`, unos 36 MB).
2. Guardarlo en una carpeta, por ejemplo `C:\Inventia\`.
3. Abrir una terminal en esa carpeta y elegir la versión:

| Versión | Cómo abrirla | Qué trae |
|---|---|---|
| **Demo** (para revisar) | `Inventia.exe --demo` | Dulcería Los Querubines con 51 productos, ventas, compras y promociones |
| Vacía | `Inventia.exe --vacia` | Un negocio con sus usuarios, sin productos |
| Limpia | `Inventia.exe` (doble clic) | Nada: abre el asistente para crear el negocio (la que se instala en los clientes) |

> Si Windows muestra «Windows protegió su PC», elegir **Más información → Ejecutar de todas formas**. Aparece porque el ejecutable no tiene firma digital.

Otras opciones: `Inventia.exe --reiniciar --demo` (o `--vacia`) regresa esa versión a su estado inicial y borra sus datos; `--restablecer-propietario` es el comando de soporte para un propietario que perdió su contraseña y su código de recuperación.

Los datos de cada versión se guardan en `%APPDATA%\Inventia`.

## 6. Usuarios de prueba (ficticios)

| Versión | Rol | Correo | Contraseña |
|---|---|---|---|
| Demo | Propietaria | `ana@querubines.com` | `Char123` |
| Demo | Encargado | `luis@querubines.com` | `Luis2026` |
| Vacía | Propietaria | `rosa@lapaletafeliz.mx` | `Rosa2026` |
| Vacía | Encargado | `pedro@lapaletafeliz.mx` | `Pedro2026` |

Todos los nombres, correos y datos de estas bases son inventados.

## 7. Opción B: correr el código fuente

Los comandos son para **Git Bash** en Windows.

**Backend (terminal 1)**

```bash
# 1. Clonar el repositorio
git clone https://github.com/CarlosN225/Inventia-App-Escritorio.git
cd Inventia-App-Escritorio

# 2. Crear y activar el entorno virtual
python -m venv .venv
source .venv/Scripts/activate

# 3. Instalar dependencias
cd backend
pip install -r requirements.txt

# 4. (Opcional) Correo: copiar el ejemplo y escribir los 3 datos de Brevo
cp .env.example .env

# 5. Crear la base de datos
python manage.py migrate

# 6. (Opcional) Cargar datos de demostración
python manage.py cargar_datos_prueba --con-ventas

# 7. Arrancar el backend
python manage.py runserver 127.0.0.1:8000
```

**Frontend (terminal 2)**

```bash
# 8. Instalar dependencias
cd frontend
npm ci

# 9. Arrancar el frontend
npm run dev
```

10. Abrir **http://localhost:5173**. Con base vacía aparece el asistente; con datos de demostración, el inicio de sesión.

> Sin el archivo `.env` el sistema funciona completo, pero no envía correos. El `.env` **nunca se sube** al repositorio.

**Generar el ejecutable** (desde la raíz, con el entorno virtual activo):

```bash
cd frontend && npm ci && npm run build && cd ..
cd backend && python manage.py collectstatic --noinput && cd ..
pip install -r empaquetado/requirements-escritorio.txt
pyinstaller empaquetado/inventia.spec --noconfirm --distpath empaquetado/salida --workpath empaquetado/build
```

Tarda unos 4 minutos; no hay que tocar la terminal mientras compila.

## 8. Pruebas

```bash
cd backend
python manage.py test        # 139 pruebas automatizadas
pip install coverage ruff    # solo la primera vez
coverage run manage.py test
coverage report              # cobertura del backend
ruff check .                 # linter del backend

cd ../frontend
npm run lint                 # linter del frontend
```

| Resultado (versión 1.1.0) | Valor |
|---|---|
| Pruebas automatizadas | 139 de 139 sin fallas |
| Cobertura del backend | 93.2 % |
| Casos de prueba manuales | 43 de 43 aprobados |

El reporte de cobertura está en `tests/`. El detalle de cada caso está en el Documento de pruebas.

## 9. Estructura de carpetas

```
Inventia-App-Escritorio/
├── backend/
│   ├── inventia_backend/     Configuración de Django (settings, urls)
│   ├── inventario/           Productos, ventas, compras, mermas, alertas, respaldos
│   ├── usuarios/             Acceso, roles, recuperación de cuenta
│   ├── manage.py
│   ├── requirements.txt
│   └── .env.example          Nombres de las variables de correo (sin valores reales)
├── frontend/
│   ├── src/                  Pantallas en React y llamadas a la API
│   └── package.json
├── database/
│   └── scripts_sql/          Base de ejemplo con datos ficticios
├── empaquetado/
│   ├── launcher.py           Abre la ventana y arranca el backend
│   ├── inventia.spec         Receta de PyInstaller
│   ├── plantillas/           Base inicial de la versión Demo
│   └── salida/Inventia.exe   Ejecutable listo para usar
└── tests/                    Resultados de pruebas y cobertura
```

## 10. Limitaciones conocidas

- Funciona en **una sola computadora** por negocio: no hay versión para celular ni varias sucursales.
- Los avisos por **WhatsApp no se lograron conectar**; se cambiaron por avisos por correo.
- La **clave de activación de licencias** no está programada; la vigencia del plan se controla fuera del sistema.
- No emite facturas (CFDI) ni se conecta con terminales bancarias: el pago con tarjeta solo se registra.
- El correo necesita internet y las credenciales de Brevo en el `.env`.
- El ejecutable no tiene firma digital, por eso Windows lo advierte la primera vez.
- Hay mejoras de seguridad documentadas como pendientes en el Manual de sistema (hallazgos H-1 a H-9).

## 11. Documentación

Manual de usuario, Manual de sistema, Expediente técnico, Memoria del proyecto y Expediente comercial se entregan en la carpeta del proyecto (`Proyecto_Equipo05`).

## 12. Integrantes

| Integrante | Rol |
|---|---|
| Carlos Núñez Durán | Coordinador del proyecto, frontend y UI/UX |
| Santiago Sánchez Roa | Líder técnico y analista de requerimientos |
| Bryan Montoya Vargas | Backend, despliegue y empaquetado |
| Daniel Martínez Contreras | Base de datos y pruebas |
| Héctor Antonio Bermúdez Tapia | Requerimientos e integración de APIs |
| Liliana Hernández Cruz | Apoyo UI/UX y documentación técnica |
| Valeria Reyes Hernández | Documentación técnica y pruebas |

---

© 2026 Equipo 05 · Inventia. Todos los derechos reservados. El código se publica con fines académicos; su uso comercial requiere licencia de los autores.
