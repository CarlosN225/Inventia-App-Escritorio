import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'

import { guardarTema } from '../services/tema'
import '../styles/boton-tema.css'

const esOscuroAhora = () => document.documentElement.dataset.theme === 'dark'

/* Para el Login y el Asistente, que no tienen menú lateral.
   Usa la misma preferencia que Ajustes: lo que elijas aquí se queda en toda la app. */
export default function BotonTema() {
  const [oscuro, setOscuro] = useState(esOscuroAhora)

  function alternar() {
    guardarTema(oscuro ? 'claro' : 'oscuro')
    setOscuro(!oscuro)
  }

  return (
    <button
      type="button"
      className="boton-tema"
      onClick={alternar}
      aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {oscuro ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      <span>{oscuro ? 'Modo claro' : 'Modo oscuro'}</span>
    </button>
  )
}