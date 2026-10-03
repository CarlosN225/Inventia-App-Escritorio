import { useNavigate } from 'react-router-dom'
import { Wrench, ArrowLeft } from 'lucide-react'

import '../styles/en-construccion.css'

// Pantalla temporal para las secciones que todavía no están hechas
export default function EnConstruccion({ titulo, descripcion }) {
  const navigate = useNavigate()

  return (
    <div className="obra">
      <div className="obra__tarjeta">
        <span className="obra__icono" aria-hidden="true">
          <Wrench size={26} strokeWidth={1.9} />
        </span>

        <span className="obra__etiqueta">En construcción</span>

        <h1 className="obra__titulo">{titulo}</h1>
        <p className="obra__texto">{descripcion}</p>

        <button type="button" className="obra__boton" onClick={() => navigate('/panel')}>
          <ArrowLeft size={15} aria-hidden="true" />
          Volver al panel
        </button>
      </div>
    </div>
  )
}