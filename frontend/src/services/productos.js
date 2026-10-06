import axios from 'axios'

const API_URL = 'http://localhost:8000/api'
const CON_SESION = { withCredentials: true }

const formatoFecha = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })

// "2026-10-09" -> fecha local (sin que la zona horaria la mueva un día)
function aFechaLocal(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

function diasHasta(iso) {
  if (!iso) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return Math.round((aFechaLocal(iso) - hoy) / 86400000)
}

function aNumero(valor) {
  return valor === null || valor === undefined ? null : Number(valor)
}

/* Traduce un producto del backend (nombres del DER) a lo que usan las pantallas */
export function adaptarProducto(p) {
  return {
    id: p.id,
    nombre: p.nombre,
    marca: p.marca || '',
    descripcion: p.descripcion || '',
    codigoBarras: p.codigo_barras || '',
    categoriaId: p.categoria,
    categoria: p.categoria_nombre || 'Otros',
    unidad: p.unidad_medida || 'pieza',
    precio: Number(p.precio_venta),
    costo: aNumero(p.ultimo_costo), // null cuando entra un encargado
    precioMayoreo: aNumero(p.precio_mayoreo),
    minimoMayoreo: p.cantidad_minima_mayoreo,
    piezasEmpaque: p.piezas_por_empaque,
    empaque: p.tipo_empaque,
    fechaCaducidad: p.fecha_caducidad,
    caducidad: p.fecha_caducidad ? formatoFecha.format(aFechaLocal(p.fecha_caducidad)) : null,
    diasCaducar: diasHasta(p.fecha_caducidad),
    imagen: p.imagen,
    stock: p.stock_actual,
    minimo: p.stock_minimo,
    maximo: p.stock_maximo,
    activo: p.activo,
  }
}

export async function listarProductos() {
  const response = await axios.get(`${API_URL}/productos/`, CON_SESION)
  return response.data.map(adaptarProducto)
}

// Desactivar o reactivar (nunca se borra: el historial lo necesita)
export async function cambiarActivoProducto(id, activo) {
  const response = await axios.patch(`${API_URL}/productos/${id}/`, { activo }, CON_SESION)
  return adaptarProducto(response.data)
}

/* Mensaje entendible para el usuario según lo que falló */
export function mensajeDeError(error) {
  if (!error.response) {
    return 'No se pudo conectar con el servidor. Revisa que el backend esté encendido.'
  }
  if (error.response.status === 403) {
    return 'No tienes permiso para hacer esto o tu sesión terminó.'
  }
  return 'Ocurrió un error inesperado. Intenta de nuevo.'
}