import { CalendarClock } from 'lucide-react'
import '../styles/caduca-pronto.css'

// En 7 días o menos se pinta en rojo (igual que en Alertas)
const DIAS_URGENTE = 7

/* Etiquetita "Caduca en 5 días" para saber qué vender primero.
   Solo aparece si el producto tiene piezas y caduca dentro de los días de aviso. */
export default function CaducaPronto({ producto, diasAviso = 30, corta = false }) {
  const dias = producto?.diasCaducar
  if (dias === null || dias === undefined || !(producto.stock > 0) || dias > diasAviso) return null

  const rojo = dias <= DIAS_URGENTE
  const texto =
    dias < 0 ? 'Caducado' : dias === 0 ? 'Caduca hoy' : corta ? `${dias} d` : `Caduca en ${dias} ${dias === 1 ? 'día' : 'días'}`

  return (
    <span
      className={'caduca-pronto' + (rojo ? ' is-rojo' : '')}
      title={`Caduca el ${producto.caducidad}. Véndelo primero.`}
    >
      <CalendarClock size={11} aria-hidden="true" />
      {texto}
    </span>
  )
}
