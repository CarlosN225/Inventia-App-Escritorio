import axios from 'axios'

const API_URL = 'http://localhost:8000/api'
const CON_SESION = { withCredentials: true }

export const EVENTO_CONFIGURACION = 'inventia:configuracion-actualizada'

// Se pide una sola vez y la comparten todas las pantallas
let cache = null

export function obtenerConfiguracion(forzar = false) {
  if (!cache || forzar) {
    cache = axios
      .get(`${API_URL}/configuracion/`, CON_SESION)
      .then((r) => r.data)
      .catch((e) => {
        cache = null
        throw e
      })
  }
  return cache
}

/* cambios: { negocio: {...}, preferencias: {...}, whatsapp: {...} } (solo lo que cambió) */
export async function guardarConfiguracion(cambios) {
  const response = await axios.patch(`${API_URL}/configuracion/`, cambios, CON_SESION)
  cache = Promise.resolve(response.data)
  window.dispatchEvent(new Event(EVENTO_CONFIGURACION)) // avisa a la barra y a las demás pantallas
  return response.data
}

// "Dulcería Los Querubines" -> "Los Querubines" (la barra ya dice "Dulcería:")
export function nombreCorto(nombre) {
  return (nombre ?? '').replace(/^dulcer[ií]a\s+/i, '').trim()
}