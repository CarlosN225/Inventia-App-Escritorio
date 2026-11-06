import axios from 'axios'

const API_URL = 'http://localhost:8000/api'
const CON_SESION = { withCredentials: true }

export async function enviarResumenCorreo() {
  const response = await axios.post(`${API_URL}/alertas/enviar-ahora/`, {}, CON_SESION)
  return response.data
}

export async function probarCorreo() {
  const response = await axios.post(`${API_URL}/alertas/prueba/`, {}, CON_SESION)
  return response.data
}
