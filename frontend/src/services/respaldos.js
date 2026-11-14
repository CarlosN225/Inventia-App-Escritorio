import axios from 'axios'

const API_URL = 'http://localhost:8000/api/respaldos'
const CON_SESION = { withCredentials: true }

// Estado: carpeta, sugeridas, lista de respaldos, USB conectadas, último automático y último correo
export async function estadoRespaldos() {
  const r = await axios.get(`${API_URL}/`, CON_SESION)
  return r.data
}

export async function cambiarCarpeta(carpeta) {
  const r = await axios.patch(`${API_URL}/carpeta/`, { carpeta }, CON_SESION)
  return r.data
}

// destino: 'carpeta' (por defecto) o 'usb' con su unidad (ej. 'E:')
export async function respaldarAhora(destino = 'carpeta', unidad = '') {
  const r = await axios.post(`${API_URL}/crear/`, { destino, unidad }, CON_SESION)
  return r.data
}

export async function respaldarPorCorreo() {
  const r = await axios.post(`${API_URL}/correo/`, {}, CON_SESION)
  return r.data
}

// Restaura uno de la carpeta (nombre) o un archivo elegido (archivo .zip)
export async function restaurarRespaldo({ nombre, archivo, contrasena }) {
  if (archivo) {
    const datos = new FormData()
    datos.append('archivo', archivo)
    if (contrasena) datos.append('contrasena', contrasena)
    const r = await axios.post(`${API_URL}/restaurar/`, datos, CON_SESION)
    return r.data
  }
  const r = await axios.post(`${API_URL}/restaurar/`, { nombre, contrasena }, CON_SESION)
  return r.data
}

export function mensajeRespaldo(e, porDefecto = 'No se pudo completar. Intenta de nuevo.') {
  if (!e?.response) return 'No se pudo conectar con Inventia.'
  return e.response.data?.error ?? porDefecto
}