import { useState } from 'react'
import { Copy, Check, KeyRound, Printer } from 'lucide-react'
import '../styles/codigo-recuperacion.css'

/* Muestra el código de recuperación UNA vez, para que el propietario lo anote.
   Si se pasa onConfirmar, pide marcar "Ya lo anoté" antes de seguir. */
export default function CodigoRecuperacion({ codigo, onConfirmar, textoBoton = 'Continuar' }) {
  const [copiado, setCopiado] = useState(false)
  const [anotado, setAnotado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    } catch {
      setCopiado(false)
    }
  }

  function imprimir() {
    const ventana = window.open('', '_blank', 'width=480,height=360')
    if (!ventana) return
    ventana.document.write(
      `<html><head><title>Código de recuperación · Inventia</title></head>
       <body style="font-family:Arial,sans-serif;padding:32px">
       <h2 style="margin:0 0 8px">Inventia · Código de recuperación</h2>
       <p style="margin:0 0 16px;color:#475569">Guárdalo en un lugar seguro. Sirve para cambiar tu contraseña si la olvidas.</p>
       <p style="font-size:30px;font-weight:700;letter-spacing:4px;font-family:monospace">${codigo}</p>
       </body></html>`
    )
    ventana.document.close()
    ventana.focus()
    ventana.print()
  }

  return (
    <div className="cr">
      <div className="cr__cabecera">
        <span className="cr__icono" aria-hidden="true">
          <KeyRound size={18} />
        </span>
        <div>
          <p className="cr__titulo">Tu código de recuperación</p>
          <p className="cr__texto">
            Si un día olvidas tu contraseña, con este código la cambias tú mismo desde la pantalla de inicio.{' '}
            <strong>Solo se muestra esta vez</strong>: anótalo en tu acta de entrega o en un lugar seguro.
          </p>
        </div>
      </div>

      <div className="cr__codigo-fila">
        <code className="cr__codigo">{codigo}</code>
        <button type="button" className="cr__boton" onClick={copiar}>
          {copiado ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
        <button type="button" className="cr__boton" onClick={imprimir}>
          <Printer size={15} aria-hidden="true" />
          Imprimir
        </button>
      </div>

      {onConfirmar && (
        <div className="cr__confirmar">
          <label className="cr__check">
            <input type="checkbox" checked={anotado} onChange={(e) => setAnotado(e.target.checked)} />
            Ya lo anoté en un lugar seguro
          </label>
          <button type="button" className="cr__continuar" disabled={!anotado} onClick={onConfirmar}>
            {textoBoton}
          </button>
        </div>
      )}
    </div>
  )
}
