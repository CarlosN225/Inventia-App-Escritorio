import { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, AlertTriangle, X } from 'lucide-react'

import { EVENTO_NOTIFICAR } from '../services/notificar'
import '../styles/notificaciones.css'

const DURACION = 4000
const MAXIMO = 4
const ICONOS = { ok: CheckCircle2, error: AlertCircle, aviso: AlertTriangle }

/* Las tarjetitas flotantes de arriba a la derecha. Vive una sola vez, en el Layout. */
export default function Notificaciones() {
  const [lista, setLista] = useState([])

  function quitar(id) {
    setLista((actual) => actual.filter((n) => n.id !== id))
  }

  useEffect(() => {
    function alNotificar(evento) {
      const id = `${Date.now()}-${Math.random()}`
      setLista((actual) => [...actual, { id, ...evento.detail }].slice(-MAXIMO))
      setTimeout(() => quitar(id), DURACION)
    }

    window.addEventListener(EVENTO_NOTIFICAR, alNotificar)
    return () => window.removeEventListener(EVENTO_NOTIFICAR, alNotificar)
  }, [])

  return (
    <div className="notis" aria-live="polite">
      {lista.map((n) => {
        const Icono = ICONOS[n.tipo] ?? CheckCircle2

        return (
          <div key={n.id} className={`noti noti--${n.tipo ?? 'ok'}`} role={n.tipo === 'error' ? 'alert' : 'status'}>
            <Icono size={18} aria-hidden="true" />
            <span className="noti__texto">{n.texto}</span>
            <button type="button" aria-label="Cerrar notificación" onClick={() => quitar(n.id)}>
              <X size={15} />
            </button>
            <span className="noti__barra" style={{ animationDuration: `${DURACION}ms` }} aria-hidden="true" />
          </div>
        )
      })}
    </div>
  )
}