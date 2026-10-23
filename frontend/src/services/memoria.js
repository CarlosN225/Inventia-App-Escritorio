/* Datos que se guardan mientras la app está abierta, para no volver a cargarlos
   cada vez que regresas a una pantalla. Se borran al cerrar sesión. */
const memoria = new Map()

export function leerMemoria(clave) {
  return memoria.get(clave) ?? null
}

export function guardarMemoria(clave, valor) {
  memoria.set(clave, valor)
}

export function limpiarMemoria() {
  memoria.clear()
}