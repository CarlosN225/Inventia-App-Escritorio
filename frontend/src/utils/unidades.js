// Cómo se escribe cada unidad: corto para tablas, largo para textos
const TEXTO_UNIDAD = {
  pieza: { uno: 'pza', varios: 'pzas', unoLargo: 'pieza', variosLargo: 'piezas' },
  bolsa: { uno: 'bolsa', varios: 'bolsas', unoLargo: 'bolsa', variosLargo: 'bolsas' },
  caja: { uno: 'caja', varios: 'cajas', unoLargo: 'caja', variosLargo: 'cajas' },
  paquete: { uno: 'paq.', varios: 'paqs.', unoLargo: 'paquete', variosLargo: 'paquetes' },
}

// textoUnidad('bolsa', 3) -> "bolsas" · textoUnidad('pieza', 1, true) -> "pieza"
export function textoUnidad(unidad, cantidad, largo = false) {
  const t = TEXTO_UNIDAD[unidad] ?? TEXTO_UNIDAD.pieza
  const uno = Math.abs(cantidad) === 1
  if (largo) return uno ? t.unoLargo : t.variosLargo
  return uno ? t.uno : t.varios
}