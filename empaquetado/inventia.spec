from pathlib import Path
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

RAIZ = Path(SPECPATH).parent
BACK = RAIZ / "backend"
ICONO = RAIZ / "empaquetado" / "inventia.ico"

hiddenimports = (
    collect_submodules("django")
    + collect_submodules("rest_framework")
    + collect_submodules("corsheaders")
    + collect_submodules("whitenoise")
    + collect_submodules("inventia_backend")
    + collect_submodules("usuarios")
    + collect_submodules("inventario")
    + collect_submodules("apscheduler")
    + collect_submodules("dotenv")
)

datas = (
    collect_data_files("django")
    + collect_data_files("corsheaders")
    + collect_data_files("whitenoise")
    + [
        (str(BACK / "inventia_backend"), "inventia_backend"),
        (str(BACK / "usuarios"), "usuarios"),
        (str(BACK / "inventario"), "inventario"),
        (str(BACK / "staticfiles"), "staticfiles"),
        (str(RAIZ / "frontend" / "dist"), "dist"),
        (str(RAIZ / "empaquetado" / "plantillas"), "plantillas"),
    ]
)

a = Analysis(
    [str(RAIZ / "empaquetado" / "launcher.py")],
    pathex=[str(BACK)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[str(BACK / "hooks")],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts, a.binaries, a.datas, [],
    name="Inventia",
    debug=False,
    upx=False,
    console=False,
    icon=str(ICONO) if ICONO.exists() else None,
)
