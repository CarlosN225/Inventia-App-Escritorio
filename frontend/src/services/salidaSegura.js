// Para no perder trabajo a medias (por ejemplo, una venta con productos en el ticket).
//
// La pantalla que tiene algo pendiente "pone una guardia". Mientras esté puesta:
//  - Los links del menú lateral (y cualquier <a> interno) preguntan antes de salir.
//  - Los botones que navegan con código (menú del usuario, ajustes) llaman a
//    intentarSalir(), que también pregunta.
//  - Si cierran la ventana o recargan, el navegador avisa (beforeunload).
//
// La guardia recibe una función "continuar": si el usuario confirma, se llama y listo.

let guardia = null

/** La pantalla pone su guardia. Devuelve la función para quitarla. */
export function ponerGuardia(alIntentarSalir) {
  guardia = alIntentarSalir
  return () => {
    if (guardia === alIntentarSalir) guardia = null
  }
}

export function hayGuardia() {
  return guardia !== null
}

/** Úsalo en lugar de navigate() directo: si hay algo pendiente, primero pregunta. */
export function intentarSalir(continuar) {
  if (guardia) guardia(continuar)
  else continuar()
}