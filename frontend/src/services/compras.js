import axios from 'axios'

const API_URL = 'http://localhost:8000/api'
const CON_SESION = { withCredentials: true }

export async function listarCompras() {
  const response = await axios.get(`${API_URL}/compras/`, CON_SESION)
  return Array.isArray(response.data) ? response.data : response.data.results ?? []
}

/* datos: { proveedor, nota, renglones: [{ producto, cantidad, costo_unitario, fecha_caducidad }] } */
export async function registrarCompra(datos) {
  const response = await axios.post(`${API_URL}/compras/`, datos, CON_SESION)
  return response.data
}