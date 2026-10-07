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
    // null si no lo ve (encargado) o si todavía no hay ninguna compra (costo 0)
    costo: Number(p.ultimo_costo) > 0 ? Number(p.ultimo_costo) : null,    
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
        promocion: p.promocion_vigente
      ? {
          id: p.promocion_vigente.id,
          tipo: p.promocion_vigente.tipo, // 'porcentaje' | 'monto'
          valor: Number(p.promocion_vigente.valor),
          fechaFin: p.promocion_vigente.fecha_fin,
        }
      : null,
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

/* ============ Formulario de producto ============ */

export async function obtenerProducto(id) {
  const response = await axios.get(`${API_URL}/productos/${id}/`, CON_SESION)
  return adaptarProducto(response.data)
}

export async function listarCategorias() {
  const response = await axios.get(`${API_URL}/categorias/`, CON_SESION)
  return response.data
    .filter((c) => c.activa !== false)
    .sort((a, b) => a.id - b.id)
    .map((c) => ({ id: c.id, nombre: c.nombre }))
}

function aNumeroONulo(texto) {
  return texto === '' || texto === null || texto === undefined ? null : Number(texto)
}

/* Traduce el formulario a los nombres del DER que espera el backend */
export function aDatosBackend(form, esNuevo) {
  const piezas = aNumeroONulo(form.piezasEmpaque)

  const datos = {
    nombre: form.nombre.trim(),
    marca: form.marca.trim(),
    descripcion: form.descripcion.trim() || null,
    categoria: Number(form.categoria),
    unidad_medida: form.unidad,
    precio_venta: Number(form.precio),
    precio_mayoreo: aNumeroONulo(form.precioMayoreo),
    cantidad_minima_mayoreo: aNumeroONulo(form.minimoMayoreo),
    piezas_por_empaque: piezas,
    tipo_empaque: piezas ? form.tipoEmpaque : null,
    stock_minimo: Number(form.minimo),
    stock_maximo: aNumeroONulo(form.maximo),
    fecha_caducidad: form.fechaCaducidad || null,
    codigo_barras: form.codigoBarras.trim() || null,
  }

  // El stock solo se captura al crear; después cambia con ventas, compras, mermas o correcciones
  if (esNuevo) datos.stock_actual = Number(form.stock)

  return datos
}

export async function crearProducto(datos) {
  const response = await axios.post(`${API_URL}/productos/`, datos, CON_SESION)
  return adaptarProducto(response.data)
}

export async function actualizarProducto(id, datos) {
  const response = await axios.patch(`${API_URL}/productos/${id}/`, datos, CON_SESION)
  return adaptarProducto(response.data)
}

// Nombre del campo en el backend -> nombre del campo en el formulario
const CAMPOS_FORMULARIO = {
  nombre: 'nombre',
  marca: 'marca',
  descripcion: 'descripcion',
  categoria: 'categoria',
  precio_venta: 'precio',
  precio_mayoreo: 'precioMayoreo',
  cantidad_minima_mayoreo: 'minimoMayoreo',
  unidad_medida: 'unidad',
  piezas_por_empaque: 'piezasEmpaque',
  stock_actual: 'stock',
  stock_minimo: 'minimo',
  stock_maximo: 'maximo',
  fecha_caducidad: 'fechaCaducidad',
  codigo_barras: 'codigoBarras',
}

/* Si el backend rechazó campos (error 400), los regresa listos para pintarlos en rojo */
export function erroresDeCampos(error) {
  if (error.response?.status !== 400 || typeof error.response.data !== 'object') return null

  const errores = {}

  Object.entries(error.response.data).forEach(([campo, mensajes]) => {
    const destino = CAMPOS_FORMULARIO[campo]
    if (!destino) return

    const texto = Array.isArray(mensajes) ? String(mensajes[0]) : String(mensajes)
    errores[destino] = /already exists|ya existe/i.test(texto)
      ? campo === 'codigo_barras'
        ? 'Ya hay otro producto con este código'
        : 'Ya existe un producto con este dato'
      : texto
  })

  return Object.keys(errores).length > 0 ? errores : null
}


/* ============ Promociones ============ */

const TIPOS_PROMO = { porcentaje: 'descuento_porcentaje', monto: 'descuento_monto' }

function adaptarPromocion(p) {
  return {
    id: p.id,
    tipo: p.tipo_promocion === 'descuento_monto' ? 'monto' : 'porcentaje',
    valor: Number(p.valor),
    inicio: p.fecha_inicio,
    fin: p.fecha_fin,
    activa: p.activa,
  }
}

export async function listarPromociones(productoId) {
  const response = await axios.get(`${API_URL}/promociones/`, { ...CON_SESION, params: { producto: productoId } })
  const datos = Array.isArray(response.data) ? response.data : response.data.results ?? []
  return datos.map(adaptarPromocion)
}

export async function crearPromocion(productoId, promo) {
  const response = await axios.post(
    `${API_URL}/promociones/`,
    {
      producto: productoId,
      tipo_promocion: TIPOS_PROMO[promo.tipo],
      valor: Number(promo.valor).toFixed(2),
      fecha_inicio: promo.inicio,
      fecha_fin: promo.fin,
      activa: promo.activa ?? true,
    },
    CON_SESION
  )
  return adaptarPromocion(response.data)
}

export async function cambiarActivaPromocion(id, activa) {
  const response = await axios.patch(`${API_URL}/promociones/${id}/`, { activa }, CON_SESION)
  return adaptarPromocion(response.data)
}

export async function borrarPromocion(id) {
  await axios.delete(`${API_URL}/promociones/${id}/`, CON_SESION)
}
