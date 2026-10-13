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
  const texto = (nombre ?? '').trim()
  return texto.replace(/^dulcer[ií]a\s+/i, '') || texto
}

// Si todavía no carga (o falla), la app se comporta como recién configurada
export const PREFERENCIAS_POR_DEFECTO = {
  maneja_caducidad: true,
  vende_mayoreo: true,
  maneja_promociones: true,
  usa_codigo_barras: false,
  alertas_activas: true,
}

/* Todo lo que las pantallas necesitan saber, en un solo objeto plano */
export function leerAjustes(config) {
  return {
    ...PREFERENCIAS_POR_DEFECTO,
    ...(config?.preferencias ?? {}),
    diasAviso: config?.whatsapp?.dias_aviso_caducidad ?? 30,
    horaResumen: config?.whatsapp?.hora_resumen ?? '20:00',
    telefonoAlertas: config?.whatsapp?.telefono_alertas ?? '',
    contactoAlertas: config?.whatsapp?.contacto_alertas ?? '',
    pinConfigurado: !!config?.seguridad?.pin_configurado,
  }
}


/* El propietario crea o cambia su PIN de 4 números */
export async function guardarPin({ pinActual, pinNuevo }) {
  const response = await axios.post(
    `${API_URL}/configuracion/pin/`,
    { pin_actual: pinActual || '', pin_nuevo: pinNuevo },
    CON_SESION
  )

  // Se vuelve a pedir la configuración, para que todas las pantallas sepan que ya hay PIN
  await obtenerConfiguracion(true)
  window.dispatchEvent(new Event(EVENTO_CONFIGURACION))

  return response.data
}
