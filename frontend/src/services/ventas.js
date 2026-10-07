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