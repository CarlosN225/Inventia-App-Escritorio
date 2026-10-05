"""Arma el contenido del resumen y el texto de WhatsApp."""

from datetime import timedelta

from django.utils import timezone

from inventario.models import Producto
from .config import obtener_config

MAX_POR_SECCION = 3
MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']


def _productos_activos():
    qs = Producto.objects.all()
    # TODO: el modelo actual no tiene `activo`; se filtra en cuanto exista
    if any(f.name == 'activo' for f in Producto._meta.get_fields()):
        qs = qs.filter(activo=True)
    return qs


def _stock(p):
    return p.cantidad  # TODO: renombrar a stock_actual si Santi cambia el modelo


def calcular(hoy=None):
    hoy = hoy or timezone.localdate()
    dias_aviso = obtener_config()['dias_aviso_caducidad']
    productos = list(_productos_activos())

    bajo = [p for p in productos if _stock(p) < p.stock_minimo]
    # Agotados primero; luego por qué tan lejos está del mínimo
    bajo.sort(key=lambda p: (_stock(p) != 0, _stock(p) / p.stock_minimo if p.stock_minimo else 0, p.nombre))
    stock_bajo = [{'id': p.id, 'nombre': p.nombre, 'stock': _stock(p), 'minimo': p.stock_minimo} for p in bajo]

    por_caducar = []
    limite = hoy + timedelta(days=dias_aviso)
    for p in productos:
        fecha = getattr(p, 'fecha_caducidad', None)  # TODO: campo aún no existe en el modelo
        if fecha and _stock(p) > 0 and fecha <= limite:
            por_caducar.append({
                'id': p.id, 'nombre': p.nombre, 'stock': _stock(p),
                'fecha_caducidad': fecha.isoformat(), 'dias': (fecha - hoy).days,
            })
    por_caducar.sort(key=lambda x: x['dias'])

    return {
        'fecha': hoy.isoformat(),
        'dias_aviso_caducidad': dias_aviso,
        'stock_bajo': stock_bajo,
        'por_caducar': por_caducar,
    }


def _mas(total):
    return [f"…y {total - MAX_POR_SECCION} más"] if total > MAX_POR_SECCION else []


def armar_mensaje(resumen):
    from datetime import date
    f = date.fromisoformat(resumen['fecha'])
    encabezado = f"*INVENTIA · Resumen del {f.day} {MESES[f.month - 1]}*"
    bajo, cad = resumen['stock_bajo'], resumen['por_caducar']

    if not bajo and not cad:
        return f"{encabezado}\n\nTodo en orden: no hay stock bajo ni productos por caducar."

    lineas = [encabezado, '', f"*Stock bajo ({len(bajo)}):*"]
    if bajo:
        for p in bajo[:MAX_POR_SECCION]:
            lineas.append(f"- {p['nombre']}: " + ("*agotado*" if p['stock'] == 0 else f"quedan {p['stock']}"))
        lineas += _mas(len(bajo))
    else:
        lineas.append("Todo surtido.")

    lineas += ['', f"*Por caducar ({len(cad)}):*"]
    if cad:
        for p in cad[:MAX_POR_SECCION]:
            dias = p['dias']
            lineas.append(f"- {p['nombre']}: {dias} {'día' if dias == 1 else 'días'} "
                          f"({p['stock']} {'pza' if p['stock'] == 1 else 'pzas'})")
        lineas += _mas(len(cad))
    else:
        lineas.append(f"Nada en los próximos {resumen['dias_aviso_caducidad']} días.")

    return "\n".join(lineas)
