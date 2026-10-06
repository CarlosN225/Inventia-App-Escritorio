import axios from 'axios'

const API_URL = 'http://localhost:8000/api'
const CON_SESION = { withCredentials: true }

/* Traduce un movimiento del backend a lo que usan las pantallas.
   Acepta los nombres del DER y los viejos, por si el serializer todavía cambia. */
export function adaptarMovimiento(m) {
  const id = (valor) => (valor && typeof valor === 'object' ? valor.id : valor)

  return {
    id: m.id,
    tipo: (m.tipo_movimiento ?? m.tipo ?? '').toLowerCase(),    
    productoId: id(m.producto),
    productoNombre: m.producto_nombre ?? null,
    usuarioId: id(m.usuario),
    usuarioNombre: m.usuario_nombre ?? null,
    cantidad: Number(m.cantidad),
    stockResultante: m.stock_resultante ?? null,
    fecha: m.fecha_movimiento ?? m.fecha ?? null,
    motivo: m.motivo ?? m.observaciones ?? '',    
    ventaId: id(m.venta) ?? null,
    compraId: id(m.compra) ?? null,
  }
}

export async function listarMovimientos() {
  const response = await axios.get(`${API_URL}/movimientos/`, CON_SESION)
  const datos = Array.isArray(response.data) ? response.data : response.data.results ?? []
  return datos.map(adaptarMovimiento)
}