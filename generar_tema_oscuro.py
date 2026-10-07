"""
Genera frontend/src/styles/tema-oscuro-pantallas.css a partir de los CSS de cada pantalla.

Lee los colores "claros" escritos a mano (fondos blancos, bordes grises, textos oscuros...)
y crea reglas equivalentes para el tema oscuro (:root[data-theme='dark']).

Uso (desde la carpeta del proyecto):   python generar_tema_oscuro.py
Se puede volver a correr cuando cambien los CSS: sobreescribe el archivo de salida.
"""
import colorsys
import re
from pathlib import Path

ESTILOS = Path("frontend/src/styles")
SALIDA = ESTILOS / "tema-oscuro-pantallas.css"

# Archivos que NO se procesan (ya tienen su tema oscuro a mano o son globales)
OMITIR = {
    "tokens.css", "base.css", "layout.css", "topbar.css", "catalogo.css",
    "tema-oscuro.css", "tema-oscuro-pantallas.css", "ajustes-menu.css",
}
PREFIJO = ":root[data-theme='dark'] "

# ---------- Colores ----------
RE_COLOR = re.compile(r"#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)|\bwhite\b", re.I)


def a_rgb(texto):
    t = texto.strip().lower()
    if t == "white":
        return (255, 255, 255, 1.0)
    if t.startswith("#"):
        h = t[1:]
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return (r, g, b, a)
    m = re.match(r"rgba?\(([^)]*)\)", t)
    if not m:
        return None
    partes = [p.strip() for p in re.split(r"[,\s/]+", m.group(1)) if p.strip()]
    try:
        r, g, b = (float(partes[0]), float(partes[1]), float(partes[2]))
        a = float(partes[3]) if len(partes) > 3 else 1.0
    except (ValueError, IndexError):
        return None
    return (r, g, b, a)


def luz(r, g, b):
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255


def familia(r, g, b):
    """neutro | rojo | ambar | verde | azul | cian | morado"""
    spread = max(r, g, b) - min(r, g, b)
    if spread < 8:
        return "neutro"
    h, _, _ = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    h *= 360
    if h < 20 or h >= 320:
        return "rojo"
    if h < 65:
        return "ambar"
    if h < 170:
        return "verde"
    if h < 200:
        return "cian"
    if h < 260:
        return "azul"
    return "morado"


# Fondos claros -> fondos oscuros
FONDO = {
    "rojo": "#3a1618", "ambar": "#33250e", "verde": "#0f2d25",
    "azul": "#14284d", "cian": "#12303f", "morado": "#241a42",
}
BORDE = {
    "rojo": "#5c2326", "ambar": "#5b3f12", "verde": "#14532d",
    "azul": "#2a4a85", "cian": "#1f4a63", "morado": "#3b2f6b",
}
# Textos oscuros -> textos claros (los semánticos conservan su significado)
TEXTO_FAMILIA = {
    "rojo": "#f87171", "ambar": "#fbbf24", "verde": "#34d399",
    "azul": "#5aa0ff", "cian": "#38bdf8", "morado": "#a78bfa",
}
TEXTO_EXACTO = {
    "#0b1220": "var(--color-text)", "#14181c": "var(--color-text)",
    "#0f172a": "var(--color-text)", "#111827": "var(--color-text)",
    "#1e293b": "var(--color-text)", "#1f2937": "var(--color-text)",
    "#334155": "#b6c2d6", "#475569": "#b6c2d6", "#4b5563": "#b6c2d6",
    "#64748b": "var(--color-text-muted)", "#6b7280": "var(--color-text-muted)",
    "#94a3b8": "var(--color-text-soft)", "#9ca3af": "var(--color-text-soft)",
    "#1668e3": "var(--color-brand)",
}


def color_fondo(c, degradado=False):
    r, g, b, a = c
    if a < 0.3:
        return None
    if (r, g, b) == (255, 255, 255):
        # blanco translúcido -> velo claro muy suave; blanco sólido -> superficie
        return "rgba(255, 255, 255, 0.06)" if a < 0.99 else "var(--color-surface)"
    if luz(r, g, b) < 0.78:
        return None
    fam = familia(r, g, b)
    if fam == "neutro":
        return "var(--color-surface)" if luz(r, g, b) > 0.985 else "var(--color-surface-2)"
    if fam in ("azul", "cian") and (max(r, g, b) - min(r, g, b)) < 12:
        return "var(--color-surface-2)"
    return (BORDE if degradado else FONDO)[fam]


def color_borde(c):
    r, g, b, a = c
    if a < 0.3 or luz(r, g, b) < 0.68:
        return None
    if (r, g, b) == (255, 255, 255):
        return "var(--color-border)" if a >= 0.99 else None
    fam = familia(r, g, b)
    if fam in ("neutro", "azul", "cian") and (max(r, g, b) - min(r, g, b)) < 40:
        return "var(--color-border)" if luz(r, g, b) > 0.9 else "var(--color-border-2)"
    return BORDE.get(fam)


def color_texto(c, texto):
    r, g, b, a = c
    if a < 0.3 or luz(r, g, b) > 0.62:
        return None
    clave = texto.strip().lower()
    if len(clave) == 4 and clave.startswith("#"):
        clave = "#" + "".join(ch * 2 for ch in clave[1:])
    if clave in TEXTO_EXACTO:
        return TEXTO_EXACTO[clave]
    fam = familia(r, g, b)
    if fam == "neutro" or (max(r, g, b) - min(r, g, b)) < 30:
        return "var(--color-text)" if luz(r, g, b) < 0.3 else "#b6c2d6"
    return TEXTO_FAMILIA[fam]


def color_sombra(c, texto):
    r, g, b, a = c
    if (r, g, b) in ((11, 18, 32), (15, 23, 42), (0, 0, 0)):
        return f"rgba(0, 0, 0, {min(a * 3, 0.6):.2f})"
    return None


def rol_de_variable(nombre):
    n = nombre.lower()
    if any(k in n for k in ("borde", "border", "line", "linea")):
        return "borde"
    if any(k in n for k in ("fondo", "bg", "surface", "soft", "suave", "panel")):
        return "fondo"
    return "auto"


def mapear(valor, rol, nombre=""):
    """Devuelve el valor con los colores cambiados, o None si no hay nada que cambiar."""
    cambio = False
    es_gris_claro = rol == "auto" and "gris" in nombre.lower()

    def sub(m):
        nonlocal cambio
        original = m.group(0)
        c = a_rgb(original)
        if c is None:
            return original
        if rol == "fondo":
            nuevo = color_fondo(c, degradado="gradient" in valor.lower())
        elif rol == "borde":
            nuevo = color_borde(c)
        elif rol == "texto":
            nuevo = color_texto(c, original)
        elif rol == "sombra":
            nuevo = color_sombra(c, original)
        elif es_gris_claro and luz(*c[:3]) > 0.62:
            nuevo = "#41547a"
        else:  # auto (variables de paleta): según la luz del color
            if luz(*c[:3]) > 0.78:
                nuevo = color_fondo(c)
            elif luz(*c[:3]) > 0.62:
                nuevo = color_borde(c)
            else:
                nuevo = color_texto(c, original)
        if nuevo and nuevo != original:
            cambio = True
            return nuevo
        return original

    resultado = RE_COLOR.sub(sub, valor)
    return resultado if cambio else None


def rol_de_propiedad(prop, valor):
    p = prop.lower()
    if p.startswith("--"):
        r = rol_de_variable(p)
        return r
    if p.startswith("background"):
        return "fondo"
    if p.startswith("border") or p.startswith("outline") or p in ("column-rule", "stroke"):
        return "borde"
    if p in ("color", "fill", "caret-color", "text-decoration-color"):
        return "texto"
    if p == "box-shadow":
        return "sombra"
    return None


# ---------- Lectura del CSS ----------
def partir(texto, separador):
    """Divide por un separador ignorando lo que esté dentro de (), [] o comillas."""
    partes, actual, nivel, comilla = [], "", 0, None
    for ch in texto:
        if comilla:
            actual += ch
            if ch == comilla:
                comilla = None
            continue
        if ch in "\"'":
            comilla = ch
        elif ch in "([":
            nivel += 1
        elif ch in ")]":
            nivel -= 1
        elif ch == separador and nivel == 0:
            partes.append(actual)
            actual = ""
            continue
        actual += ch
    partes.append(actual)
    return [p.strip() for p in partes if p.strip()]


def bloques(css):
    """Lista de (cabecera, cuerpo) del nivel superior."""
    res, i, n, buf = [], 0, len(css), ""
    while i < n:
        ch = css[i]
        if ch == "{":
            nivel, j = 1, i + 1
            while j < n and nivel:
                nivel += (css[j] == "{") - (css[j] == "}")
                j += 1
            res.append((buf.strip(), css[i + 1:j - 1]))
            buf, i = "", j
        elif ch == ";":
            buf, i = "", i + 1
        else:
            buf += ch
            i += 1
    return res


def procesar(css, sangria=""):
    salida = []
    for cabecera, cuerpo in bloques(css):
        if cabecera.startswith("@media") or cabecera.startswith("@supports"):
            interno = procesar(cuerpo, sangria + "  ")
            if interno:
                salida.append(f"{sangria}{cabecera} {{\n" + "\n".join(interno) + f"\n{sangria}}}")
            continue
        if cabecera.startswith("@") or not cabecera:
            continue

        selectores = []
        for s in partir(cabecera, ","):
            if ":root" in s or s.startswith(("html", "body", "*")):
                continue
            selectores.append(PREFIJO + s)
        if not selectores:
            continue

        decls = []
        for d in partir(cuerpo, ";"):
            if ":" not in d:
                continue
            prop, valor = d.split(":", 1)
            prop, valor = prop.strip(), valor.strip()
            importante = ""
            if valor.endswith("!important"):
                valor, importante = valor[:-10].strip(), " !important"
            rol = rol_de_propiedad(prop, valor)
            if not rol:
                continue
            nuevo = mapear(valor, rol, prop)
            if nuevo:
                decls.append(f"{sangria}  {prop}: {nuevo}{importante};")
        if decls:
            salida.append(f"{sangria}" + ",\n".join(f"{sangria}{s}" if k else s for k, s in enumerate(selectores)) + " {\n" + "\n".join(decls) + f"\n{sangria}}}")
    return salida


def main():
    if not ESTILOS.exists():
        raise SystemExit("No encuentro frontend/src/styles. Corre el script desde la carpeta raíz del proyecto.")
    trozos = [
        "/* ============================================================\n"
        "   TEMA OSCURO · pantallas (archivo GENERADO con generar_tema_oscuro.py)\n"
        "   No lo edites a mano: vuelve a correr el script. Los ajustes manuales\n"
        "   van en tema-oscuro.css.\n"
        "   ============================================================ */\n"
    ]
    total = 0
    for archivo in sorted(ESTILOS.glob("*.css")):
        if archivo.name in OMITIR:
            continue
        css = re.sub(r"/\*.*?\*/", "", archivo.read_text(encoding="utf-8"), flags=re.S)
        reglas = procesar(css)
        total += len(reglas)
        print(f"{archivo.name:34s} {len(reglas):4d} reglas")
        if reglas:
            trozos.append(f"\n/* ---------- {archivo.name} ---------- */\n" + "\n\n".join(reglas) + "\n")
    SALIDA.write_text("".join(trozos), encoding="utf-8")
    print(f"\nListo: {total} reglas escritas en {SALIDA}")


if __name__ == "__main__":
    main()