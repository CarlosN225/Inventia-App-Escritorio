import axios from 'axios'

const API_URL = 'http://localhost:8000/api'
const CON_SESION = { withCredentials: true }

export async function listarVentas() {
  const response = await axios.get(`${API_URL}/ventas/`, CON_SESION)
  return Array.isArray(response.data) ? response.data : response.data.results ?? []
}

/* renglones: [{ producto, cantidad, precio_unitario, tipo_precio }] */
export async function registrarVenta(renglones) {
  const response = await axios.post(`${API_URL}/ventas/`, { renglones }, CON_SESION)
  return response.data
}


/* Los motivos aceptados (los mismos que valida el backend) */
export const MOTIVOS_PRECIO = [
  'Descuento a cliente frecuente',
  'Producto con detalle',
  'Ajuste de precio',
  'Otro',
]

/* El propietario teclea su PIN y el backend devuelve una autorización firmada
   (válida solo para ese producto, a ese precio, por 10 minutos) */
export async function autorizarPrecio({ productoId, precio, motivo, pin }) {
  const response = await axios.post(
    `${API_URL}/autorizaciones/precio/`,
    { producto: productoId, precio: Number(precio).toFixed(2), motivo, pin },
    CON_SESION
  )

  return {
    autorizacion: response.data.autorizacion,
    autorizadoPor: response.data.autorizado_por,
  }
}