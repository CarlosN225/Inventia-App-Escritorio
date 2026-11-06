import axios from 'axios'

const API_URL = 'http://localhost:8000/api'
const CON_SESION = { withCredentials: true }

/* Cómo van los avisos: último envío, próxima revisión y si quedó alguno pendiente */
export async function obtenerEstadoAlertas() {
  const response = await axios.get(`${API_URL}/alertas/estado/`, CON_SESION)
  return response.data
}

/* Manda el resumen en este momento (aunque no haya nada nuevo) */
export async function enviarResumenCorreo() {
  const response = await axios.post(`${API_URL}/alertas/enviar-ahora/`, {}, CON_SESION)
  return response.data
}

export async function probarCorreo() {
  const response = await axios.post(`${API_URL}/alertas/prueba/`, {}, CON_SESION)
  return response.data
}