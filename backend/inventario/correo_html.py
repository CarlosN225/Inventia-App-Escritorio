"""Cómo se ve el aviso por correo: asunto, versión HTML y versión de texto.

El HTML usa tablas y estilos en línea porque así lo pintan bien Gmail, Outlook
y los celulares. Aquí solo se arma el contenido; qué y cuándo se manda vive en
correo_alertas.py.
"""
from html import escape

MAX_POR_LISTA = 5

# Si no hay URL del logo, va pegado dentro del correo con este identificador
CID_LOGO = "logo-inventia"

# Ancho del correo y de cada columna (en celular las columnas se acomodan una abajo de otra)
ANCHO = 800
COLUMNA = 379  # 2 x 379 = 758, lo que cabe adentro (800 - 2 de borde - 40 de margen)

# Las mismas claves que guarda AlertaStock.motivo
NOVEDAD = "novedad"
RECORDATORIO = "recordatorio"
MANUAL = "manual"

MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

# Colores de INVENTIA
AZUL = "#1668e3"
MARINO = "#0b1220"
GRIS = "#64748b"
GRIS_2 = "#475569"
GRIS_3 = "#94a3b8"
BORDE = "#e6eaf0"
FONDO = "#f1f4f9"
ROJO = "#b91c1c"
ROJO_SUAVE = "#fdecec"
AMBAR = "#b45309"
AMBAR_SUAVE = "#fff7e6"
VERDE = "#047857"
VERDE_SUAVE = "#e7f6ef"

LETRA = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif"


# ---------------------------------------------------------------------------
# Textos
# ---------------------------------------------------------------------------

def plural(n, uno, varios):
    return f"{n} {uno if n == 1 else varios}"


def fecha_corta(fecha):
    return f"{fecha.day} {MESES[fecha.month - 1]}"


def texto_caducidad(dias):
    if dias < 0:
        return f"Caducó hace {plural(abs(dias), 'día', 'días')}"
    if dias == 0:
        return "Caduca hoy"
    return f"En {plural(dias, 'día', 'días')}"


def texto_stock(item):
    return "Agotado" if item["agotado"] else f"Quedan {item['stock']} de {item['minimo']}"


def asunto(resumen, motivo):
    """El asunto dice lo importante sin tener que abrir el correo."""
    total = resumen["total_productos"]

    if total == 0:
        return "INVENTIA · Todo en orden"

    if motivo == RECORDATORIO:
        return f"INVENTIA · Recordatorio: {plural(total, 'producto pendiente', 'productos pendientes')}"

    if motivo == NOVEDAD:
        nuevos = [i for i in resumen["stock"] + resumen["caducan"] if i["nuevo"]]
        if len(nuevos) == 1:
            item = nuevos[0]
            if "dias" in item:
                if item["dias"] < 0:
                    return f"INVENTIA · {item['nombre']} ya caducó"
                if item["dias"] == 0:
                    return f"INVENTIA · {item['nombre']} caduca hoy"
                return f"INVENTIA · {item['nombre']} caduca en {plural(item['dias'], 'día', 'días')}"
            if item["agotado"]:
                return f"INVENTIA · Se agotó {item['nombre']}"
            return f"INVENTIA · {item['nombre']} bajó de su mínimo"
        return f"INVENTIA · {plural(len(nuevos), 'novedad', 'novedades')} en tu inventario"

    return f"INVENTIA · {plural(total, 'producto necesita', 'productos necesitan')} atención"


def encabezado(resumen, motivo):
    """Título e introducción según por qué se manda el correo."""
    total = resumen["total_productos"]

    if total == 0:
        return "Todo en orden", "Ningún producto está debajo de su mínimo ni por caducar."

    if resumen.get("primero"):
        return (
            "Así está tu inventario hoy",
            "Es tu primer aviso. De aquí en adelante solo te escribimos cuando haya algo nuevo.",
        )

    if motivo == NOVEDAD:
        n = resumen["nuevos"]
        return (
            f"Hay {plural(n, 'novedad', 'novedades')} en tu inventario",
            "Desde el último aviso cambió lo que está marcado como NUEVO.",
        )

    if motivo == RECORDATORIO:
        return (
            "Tu recordatorio de los lunes",
            "Esto sigue pendiente. Te lo recordamos cada lunes mientras no se resuelva.",
        )

    return (
        f"{plural(total, 'producto necesita', 'productos necesitan')} atención",
        "Este es el estado de tu inventario en este momento.",
    )


def resumen_corto(resumen):
    """Una línea para la vista previa del correo (lo que se lee junto al asunto)."""
    partes = []
    if resumen["agotados"]:
        partes.append(plural(resumen["agotados"], "agotado", "agotados"))
    bajos = len(resumen["stock"]) - resumen["agotados"]
    if bajos:
        partes.append(plural(bajos, "con stock bajo", "con stock bajo"))
    if resumen["caducan"]:
        partes.append(plural(len(resumen["caducan"]), "por caducar", "por caducar"))
    return " · ".join(partes) or "Todo surtido y nada por caducar"


# ---------------------------------------------------------------------------
# Versión de texto (para quien no ve HTML)
# ---------------------------------------------------------------------------

def armar_texto(resumen, motivo):
    titulo, intro = encabezado(resumen, motivo)
    lineas = [
        f"INVENTIA · Resumen del {fecha_corta(resumen['fecha'])}"
        + (f" · {resumen['negocio']}" if resumen["negocio"] else ""),
        "",
        titulo,
        intro,
    ]

    def lista(nombre, items, describir):
        if not items:
            return
        lineas.extend(["", f"{nombre} ({len(items)}):"])
        for item in items[:MAX_POR_LISTA]:
            marca = " [NUEVO]" if item["nuevo"] else ""
            lineas.append(f"- {item['nombre']}{marca}: {describir(item)}")
        if len(items) > MAX_POR_LISTA:
            lineas.append(f"…y {len(items) - MAX_POR_LISTA} más en INVENTIA")

    lista("Se está acabando", resumen["stock"], texto_stock)
    lista("Por caducar", resumen["caducan"], lambda i: texto_caducidad(i["dias"]))

    lineas.extend(["", "—", texto_pie()])
    return "\n".join(lineas)


def texto_pie():
    return (
        "Solo te escribimos cuando hay algo nuevo, y los lunes con un recordatorio de lo pendiente. "
        "Para dejar de recibir estos avisos, apágalos en Configuración › Correo y alertas."
    )


# ---------------------------------------------------------------------------
# Versión HTML
# ---------------------------------------------------------------------------

def _etiqueta_nuevo():
    return (
        f'<span style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:999px;'
        f'background:#e8f0fd;color:{AZUL};font-size:10px;font-weight:700;letter-spacing:0.5px;'
        f'vertical-align:middle;">NUEVO</span>'
    )


def _columna(lado, titulo, cifra, nota, color, fondo, items, describir, color_de, vacio):
    """Una lista con su número arriba: "7 Stock bajo" y abajo los productos."""
    if items:
        filas = []
        for item in items[:MAX_POR_LISTA]:
            nuevo = _etiqueta_nuevo() if item["nuevo"] else ""
            color_item, negritas = color_de(item)
            filas.append(f"""
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid {BORDE};font-size:14px;line-height:19px;color:{MARINO};">{escape(item['nombre'])}{nuevo}</td>
                  <td align="right" style="padding:8px 0 8px 10px;border-bottom:1px solid {BORDE};font-size:13px;white-space:nowrap;color:{color_item};font-weight:{700 if negritas else 400};">{describir(item)}</td>
                </tr>""")
        if len(items) > MAX_POR_LISTA:
            filas.append(f"""
                <tr>
                  <td colspan="2" style="padding:8px 0 0;font-size:12px;color:{GRIS};">…y {len(items) - MAX_POR_LISTA} más en INVENTIA</td>
                </tr>""")
        lista = "".join(filas)
    else:
        lista = f"""
                <tr>
                  <td style="padding:10px 0;font-size:13px;color:{VERDE};font-weight:700;">&#10003; {vacio}</td>
                </tr>"""

    # Izquierda: con la línea que separa · derecha: sin línea · sola: todo el ancho
    estilos = {
        "izq": f"max-width:{COLUMNA}px;padding:0 22px 18px 4px;border-right:1px solid {BORDE};",
        "der": f"max-width:{COLUMNA}px;padding:0 4px 18px 22px;",
        "sola": f"max-width:{COLUMNA * 2}px;padding:0 4px 18px;",
    }[lado]

    return f"""<div class="inv-col" style="display:inline-block;width:100%;box-sizing:border-box;vertical-align:top;{estilos}">
            <div style="font-family:{LETRA};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:{fondo};border-radius:10px;padding:10px 14px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td style="font-size:28px;line-height:30px;font-weight:700;color:{color};padding-right:12px;">{cifra}</td>
                      <td>
                        <div style="font-size:14px;font-weight:700;color:{color};">{titulo}</div>
                        <div style="font-size:12px;color:{GRIS};">{nota}</div>
                      </td>
                    </tr></table>
                  </td>
                </tr>
                <tr><td style="padding-top:4px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">{lista}
                  </table>
                </td></tr>
              </table>
            </div>
          </div>"""


def armar_html(resumen, motivo, logo_url=None):
    titulo, intro = encabezado(resumen, motivo)
    subtitulo = f"Resumen del {fecha_corta(resumen['fecha'])}"
    if resumen["negocio"]:
        subtitulo += f" · {escape(resumen['negocio'])}"

    con_caducidad = resumen["maneja_caducidad"]
    logo = escape(logo_url) if logo_url else f"cid:{CID_LOGO}"

    columna_stock = _columna(
        "izq" if con_caducidad else "sola",
        "Stock bajo",
        len(resumen["stock"]),
        plural(resumen["agotados"], "agotado", "agotados") if resumen["agotados"] else "ninguno agotado",
        AMBAR,
        AMBAR_SUAVE,
        resumen["stock"],
        lambda i: "Agotado" if i["agotado"] else f"{i['stock']} de {i['minimo']}",
        lambda i: (ROJO, True) if i["agotado"] else (GRIS_2, False),
        "Todo surtido",
    )

    if con_caducidad:
        columna_caducidad = _columna(
            "der",
            "Por caducar",
            len(resumen["caducan"]),
            f"próximos {resumen['dias_aviso']} días",
            ROJO,
            ROJO_SUAVE,
            resumen["caducan"],
            lambda i: texto_caducidad(i["dias"]),
            lambda i: (ROJO, True) if i["urgente"] else (AMBAR, True),
            "Nada por caducar",
        )
        # Dos columnas; Outlook de escritorio necesita la tabla "fantasma" de los comentarios
        columnas = f"""<!--[if mso]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="50%" valign="top"><![endif]-->
          {columna_stock}
          <!--[if mso]></td><td width="50%" valign="top"><![endif]-->
          {columna_caducidad}
          <!--[if mso]></td></tr></table><![endif]-->"""
    else:
        columnas = columna_stock

    consejo = ""
    if resumen["total_productos"]:
        consejo = "Abre INVENTIA para registrar la compra de lo que falta o la merma de lo que ya no se puede vender. "

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>{escape(asunto(resumen, motivo))}</title>
  <style>
    /* En celular: una columna abajo de la otra y sin la línea de en medio */
    @media only screen and (max-width: 620px) {{
      .inv-col {{ max-width: 100% !important; padding: 0 0 18px !important; border-right: 0 !important; }}
    }}
  </style>
</head>
<body style="margin:0;padding:0;background:{FONDO};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{escape(resumen_corto(resumen))}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{FONDO};">
    <tr>
      <td align="center" style="padding:20px 10px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:{ANCHO}px;background:#ffffff;border:1px solid {BORDE};border-radius:14px;overflow:hidden;font-family:{LETRA};color:{MARINO};">

          <!-- Encabezado con logo -->
          <tr>
            <td style="background:{AZUL};padding:16px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="padding-right:14px;">
                  <img src="{logo}" width="48" height="48" alt="INVENTIA"
                       style="display:block;width:48px;height:48px;border:0;">
                </td>
                <td>
                  <div style="font-size:17px;font-weight:800;letter-spacing:3px;color:#ffffff;">INVENTIA</div>
                  <div style="font-size:13px;color:#dbe7fb;margin-top:2px;">{subtitulo}</div>
                </td>
              </tr></table>
            </td>
          </tr>

          <!-- Qué pasó -->
          <tr>
            <td style="padding:20px 24px 16px;">
              <div style="font-size:19px;line-height:25px;font-weight:700;color:{MARINO};">{escape(titulo)}</div>
              <div style="font-size:14px;line-height:21px;color:{GRIS_2};margin-top:2px;">{escape(intro)}</div>
            </td>
          </tr>

          <!-- Las dos listas lado a lado -->
          <tr>
            <td style="padding:0 20px;font-size:0;">
          {columnas}
            </td>
          </tr>

          <!-- Pie -->
          <tr>
            <td style="padding:0 24px 20px;">
              <div style="border-top:1px solid {BORDE};padding-top:12px;font-size:12px;line-height:18px;color:{GRIS_3};">
                {escape(consejo + texto_pie())}
              </div>
            </td>
          </tr>
        </table>

        <div style="font-family:{LETRA};font-size:11px;color:{GRIS_3};margin-top:10px;">
          INVENTIA · Control de inventario para tu dulcería
        </div>

      </td>
    </tr>
  </table>
</body>
</html>"""
