from PyInstaller.utils.hooks import collect_submodules, collect_data_files

hiddenimports = (
    collect_submodules("django")
    + collect_submodules("rest_framework")
    + collect_submodules("corsheaders")
    + collect_submodules("whitenoise")
    + collect_submodules("inventia_backend")
    + collect_submodules("usuarios")
    + collect_submodules("inventario")
)

datas = (
    collect_data_files("django")
    + collect_data_files("corsheaders")
    + collect_data_files("whitenoise")
    + [
        ("inventia_backend", "inventia_backend"),
        ("usuarios", "usuarios"),
        ("inventario", "inventario"),
        ("db.sqlite3", "."),
        ("staticfiles", "staticfiles"),
    ]
)
a = Analysis(
    ["servidor.py"],
    pathex=["."],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=["hooks"],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="servidor",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
)
