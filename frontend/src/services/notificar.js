export const EVENTO_NOTIFICAR = 'inventia:notificar'

/* Muestra una notificación flotante desde cualquier pantalla.
   tipo: 'ok' (verde, por defecto) · 'error' (rojo) · 'aviso' (ámbar) */
export function notificar({ texto, tipo = 'ok' }) {
  window.dispatchEvent(new CustomEvent(EVENTO_NOTIFICAR, { detail: { texto, tipo } }))
}