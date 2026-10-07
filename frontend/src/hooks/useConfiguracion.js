import { useEffect, useState } from 'react'

import { obtenerConfiguracion, EVENTO_CONFIGURACION } from '../services/configuracion'

/* Devuelve la configuración del negocio (null mientras carga) y se actualiza sola si alguien la cambia */
export default function useConfiguracion() {
  const [config, setConfig] = useState(null)

  useEffect(() => {
    let sigueMontado = true

    function cargar(forzar = false) {
      obtenerConfiguracion(forzar)
        .then((c) => sigueMontado && setConfig(c))
        .catch(() => {})
    }

    cargar()

    const alCambiar = () => cargar()
    window.addEventListener(EVENTO_CONFIGURACION, alCambiar)

    return () => {
      sigueMontado = false
      window.removeEventListener(EVENTO_CONFIGURACION, alCambiar)
    }
  }, [])

  return config
}