"""Lanzador de Inventia (escritorio): ventana pywebview + servidor local + Django.

Uso:
    Inventia.exe                              versión Limpia (negocio nuevo, con asistente)
    Inventia.exe --vacia                      versión Vacía
    Inventia.exe --demo                       versión Demostración
    Inventia.exe --reiniciar [--demo|--vacia] borra los datos de esa versión y la deja de plantilla
    Inventia.exe --restablecer-propietario [correo]   soporte: contraseña temporal del propietario
"""
import io
import os
import shutil
import socket
import sys
from pathlib import Path
from socketserver import ThreadingMixIn
from wsgiref.simple_server import WSGIRequestHandler, WSGIServer, make_server

FROZEN = getattr(sys, "frozen", False)
BASE = Path(sys._MEIPASS) if FROZEN else Path(__file__).resolve().parent.parent
BACKEND = BASE if FROZEN else BASE / "backend"
DIST = BASE / "dist" if FROZEN else BASE / "frontend" / "dist"
STATIC = BASE / "staticfiles" if FROZEN else BACKEND / "staticfiles"
PLANTILLAS = BASE / "plantillas" if FROZEN else BASE / "empaquetado" / "plantillas"

_appdata = os.environ.get("APPDATA") or os.environ.get("INVENTIA_DATOS_BASE") or str(Path.home() / ".local" / "share")
DATOS = Path(_appdata) / "Inventia"

# nombre de la base, título de la ventana, plantilla
MODOS = {
    "limpia": ("inventia.sqlite3", "INVENTIA", "inventia_limpia.sqlite3"),
    "vacia": ("inventia_vacia.sqlite3", "INVENTIA · Vacía", "inventia_vacia.sqlite3"),
    "demo": ("inventia_demo.sqlite3", "INVENTIA · Demostración", "inventia_demo.sqlite3"),
}
HOST, PUERTO = "127.0.0.1", 8000


def aviso(titulo, texto):
    """Mensaje al usuario: cuadro de Windows si se puede; si no, a la consola."""
    try:
        import ctypes
        ctypes.windll.user32.MessageBoxW(0, texto, titulo, 0x40)
    except Exception:
        print(f"{titulo}\n{texto}")


def puerto_ocupado():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((HOST, PUERTO)) == 0


def preparar_base(archivo, plantilla, reiniciar):
    DATOS.mkdir(parents=True, exist_ok=True)
    db = DATOS / archivo
    if reiniciar:
        for sufijo in ("", "-wal", "-shm", "-journal"):
            Path(str(db) + sufijo).unlink(missing_ok=True)
    if not db.exists():
        origen = PLANTILLAS / plantilla
        if origen.exists():
            shutil.copy2(origen, db)
        # si no hay plantilla, Django crea la base vacía con migrate
    return db


class _Silencioso(WSGIRequestHandler):
    def log_message(self, *a, **k):
        pass


class _ServidorHilos(ThreadingMixIn, WSGIServer):
    daemon_threads = True


def construir_app():
    from django.core.wsgi import get_wsgi_application
    from whitenoise import WhiteNoise

    django_app = get_wsgi_application()
    app = WhiteNoise(django_app, root=str(DIST), index_file=True)
    if STATIC.exists():
        app.add_files(str(STATIC), prefix="static/")
    prefijos = ("/api/", "/admin", "/static/", "/assets/")

    def con_spa(environ, start_response):
        ruta = environ.get("PATH_INFO", "/")
        if not ruta.startswith(prefijos) and "." not in ruta.rsplit("/", 1)[-1]:
            environ["PATH_INFO"] = "/"
        return app(environ, start_response)

    return con_spa


def main():
    args = sys.argv[1:]
    modo = "demo" if "--demo" in args else "vacia" if "--vacia" in args else "limpia"
    archivo, titulo, plantilla = MODOS[modo]
    soporte = "--restablecer-propietario" in args

    if FROZEN:
        # Sin consola (console=False) stdout/stderr son None
        if sys.stdout is None:
            sys.stdout = open(os.devnull, "w")
        if sys.stderr is None:
            sys.stderr = open(os.devnull, "w")
        from dotenv import load_dotenv
        load_dotenv(Path(sys.executable).resolve().parent / ".env")
    else:
        sys.path.insert(0, str(BACKEND))
        try:
            from dotenv import load_dotenv
            load_dotenv(BACKEND / ".env")
        except ImportError:
            pass

    if not soporte and puerto_ocupado():
        aviso("INVENTIA", "Inventia ya está abierta (el puerto 8000 está en uso).\n"
                          "Ciérrala o espera unos segundos y vuelve a abrirla.")
        return 1

    db = preparar_base(archivo, plantilla, reiniciar="--reiniciar" in args)
    os.environ["INVENTIA_DB"] = str(db)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "inventia_backend.settings")
    if soporte:
        os.environ["DISABLE_ALERTAS_SCHEDULER"] = "1"  # no mandar correos ni respaldos desde el modo soporte

    import django
    django.setup()
    from django.core.management import call_command

    call_command("migrate", interactive=False, verbosity=0)

    if soporte:
        i = args.index("--restablecer-propietario")
        correo = args[i + 1] if i + 1 < len(args) and not args[i + 1].startswith("--") else None
        salida = io.StringIO()
        try:
            # Se importa directo (no por nombre) para no depender de que el .exe encuentre el comando en disco
            from usuarios.management.commands.restablecer_propietario import Command as Restablecer
            call_command(Restablecer(), correo=correo, stdout=salida)
            texto = salida.getvalue().strip() or "Listo."
            # El comando de Django habla de --correo; en el .exe el correo va directo después de la opción
            texto = texto.replace("Vuelve a correrlo con --correo <correo>.",
                                  "Vuelve a ejecutar: Inventia.exe --restablecer-propietario correo@ejemplo.com")
        except Exception as e:  # CommandError: sin propietario, correo no encontrado…
            texto = f"No se pudo restablecer: {e}"
        aviso("INVENTIA · Soporte", texto)
        print(texto)
        return 0

    servidor = make_server(HOST, PUERTO, construir_app(), server_class=_ServidorHilos, handler_class=_Silencioso)
    import threading
    threading.Thread(target=servidor.serve_forever, daemon=True).start()

    import webview
    webview.settings["ALLOW_DOWNLOADS"] = True
    webview.create_window(titulo, f"http://localhost:{PUERTO}/", width=1280, height=800, min_size=(1024, 680))
    webview.start(private_mode=False, storage_path=str(DATOS / "webview"))
    servidor.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
