import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowRight, Clock, HelpCircle, Loader2, Lock, ShieldCheck, X } from 'lucide-react'

import { autorizarPrecio, MOTIVOS_PRECIO } from '../services/ventas'
import '../styles/modal-autorizacion.css'

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

/*
  Se abre al cambiar el precio de un producto en la venta.
  - Encargado: motivo + PIN del propietario → el backend firma la autorización.
  - Propietario: solo el motivo (él autoriza).
  - Si el PIN se bloquea, la venta sigue: el producto se queda en su precio normal.
*/
export default function ModalAutorizacion({
  producto,
  precioNormal,
  precioNuevo,
  esPropietario,
  pinConfigurado,
  onAutorizar,
  onCancelar,
}) {
  const [motivo, setMotivo] = useState('')
  const [otroTexto, setOtroTexto] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [bloqueado, setBloqueado] = useState(false)
  const [verAyuda, setVerAyuda] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const pinRef = useRef(null)
  const otroRef = useRef(null)

  const diferencia = precioNuevo - precioNormal
  const sinPin = !esPropietario && !pinConfigurado
  const esOtro = motivo === 'Otro'
  const motivoFinal = esOtro ? `Otro: ${otroTexto.trim()}` : motivo

  // Esc cancela
  useEffect(() => {
    const alPresionar = (e) => e.key === 'Escape' && !enviando && onCancelar()
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [enviando, onCancelar])

  // Tras un PIN incorrecto, el cursor regresa solo a la cajita (cuando ya se volvió a activar)
  useEffect(() => {
    if (!enviando && error && !bloqueado) pinRef.current?.focus()
  }, [enviando, error, bloqueado])

  function elegirMotivo(m) {
    setMotivo(m)
    setError('')
    setTimeout(() => {
      if (m === 'Otro') otroRef.current?.focus()
      else if (!esPropietario) pinRef.current?.focus()
    }, 0)
  }

  async function confirmar() {
    if (!motivo) return setError('Elige el motivo del cambio')
    if (esOtro && otroTexto.trim().length < 3) {
      setError('Escribe el motivo')
      return otroRef.current?.focus()
    }
    if (esPropietario) return onAutorizar({ motivo: motivoFinal, autorizacion: null, autorizadoPor: null })
    if (pin.length !== 4) {
      setError('Escribe el PIN de 4 números')
      return pinRef.current?.focus()
    }

    setEnviando(true)
    setError('')

    try {
      const { autorizacion, autorizadoPor } = await autorizarPrecio({
        productoId: producto.id,
        precio: precioNuevo,
        motivo: motivoFinal,
        pin,
      })
      onAutorizar({ motivo: motivoFinal, autorizacion, autorizadoPor })
    } catch (e) {
      const datos = e?.response?.data
      setError(datos?.pin ?? datos?.motivo ?? datos?.precio ?? 'No se pudo autorizar. Intenta de nuevo.')
      setBloqueado(!!datos?.bloqueado)
      setPin('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mz" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !enviando && onCancelar()}>
      <div className="mz-caja" role="dialog" aria-modal="true" aria-labelledby="mz-titulo">
        <button type="button" className="mz-cerrar" aria-label="Cancelar" onClick={onCancelar} disabled={enviando}>
          <X size={18} />
        </button>

        <span className={'mz-icono' + (sinPin || bloqueado ? ' is-ambar' : '')} aria-hidden="true">
          {bloqueado ? <Clock size={24} /> : esPropietario ? <ShieldCheck size={24} /> : <Lock size={24} />}
        </span>

        <h2 id="mz-titulo" className="mz-titulo">
          {bloqueado
            ? 'PIN bloqueado por seguridad'
            : esPropietario
            ? 'Cambiar el precio'
            : 'Este cambio necesita autorización'}
        </h2>
        <p className="mz-sub">
          {bloqueado
            ? 'La venta puede seguir con el precio normal.'
            : esPropietario
            ? 'Quedará registrado en el Historial con el motivo.'
            : 'El propietario debe teclear su PIN para aprobarlo.'}
        </p>

        {/* ---------- El cambio ---------- */}
        <div className="mz-cambio">
          <p className="mz-cambio__producto">
            {producto.nombre}
            {producto.gramaje && <span className="gramaje">{producto.gramaje}</span>}
          </p>
          <div className="mz-cambio__precios">
            <span className="mz-cambio__antes">{moneda.format(precioNormal)}</span>
            <ArrowRight size={16} aria-hidden="true" />
            <strong className="mz-cambio__despues">{moneda.format(precioNuevo)}</strong>
            <span className={'mz-cambio__dif ' + (diferencia > 0 ? 'is-sube' : 'is-baja')}>
              {diferencia > 0 ? '+' : '−'}
              {moneda.format(Math.abs(diferencia))} c/u
            </span>
          </div>
        </div>

        {sinPin ? (
          /* ---------- El dueño no tiene PIN ---------- */
          <>
            <p className="mz-aviso">
              <AlertCircle size={16} aria-hidden="true" />
              El dueño todavía no configura su PIN. Pídele que lo cree en Configuración › Seguridad.
            </p>
            <button type="button" className="mz-boton mz-boton--ancho" onClick={onCancelar}>
              Seguir con el precio normal
            </button>
          </>
        ) : bloqueado ? (
          /* ---------- Bloqueado: la venta sigue ---------- */
          <>
            <p className="mz-aviso">
              <Clock size={16} aria-hidden="true" />
              <span>
                {error}
                <br />
                Mientras tanto, <strong>{producto.nombre}</strong> se vende a{' '}
                <strong>{moneda.format(precioNormal)}</strong> y puedes terminar la venta.
              </span>
            </p>
            <button type="button" className="mz-boton mz-boton--primario mz-boton--ancho" onClick={onCancelar}>
              Seguir con el precio normal
            </button>
          </>
        ) : (
          <>
            {/* ---------- Motivo ---------- */}
            <p className="mz-etiqueta">
              Motivo <span className="mz-requerido">*</span>
            </p>
            <div className="mz-motivos" role="radiogroup" aria-label="Motivo del cambio">
              {MOTIVOS_PRECIO.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={motivo === m}
                  className={'mz-motivo' + (motivo === m ? ' is-activo' : '')}
                  onClick={() => elegirMotivo(m)}
                  disabled={enviando}
                >
                  {m}
                </button>
              ))}
            </div>

            {esOtro && (
              <div className="mz-otro">
                <textarea
                  ref={otroRef}
                  rows={2}
                  maxLength={110}
                  className="mz-otro__texto"
                  value={otroTexto}
                  onChange={(e) => {
                    setOtroTexto(e.target.value)
                    setError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      esPropietario ? confirmar() : pinRef.current?.focus()
                    }
                  }}
                  placeholder="Escribe el motivo… (ej. El cliente compró la caja completa)"
                  disabled={enviando}
                />
                <span className="mz-otro__conteo">{otroTexto.length}/110</span>
              </div>
            )}

            {/* ---------- PIN (solo encargado) ---------- */}
            {!esPropietario && (
              <>
                               <div className="mz-etiqueta mz-etiqueta--fila">
                  <label htmlFor="mz-pin">
                    PIN del propietario <span className="mz-requerido">*</span>
                  </label>

                  {/* El globito flota encima: no empuja nada hacia abajo */}
                  <span className="mz-ayuda-ancla" onMouseLeave={() => setVerAyuda(false)}>
                    <button
                      type="button"
                      className="mz-ayuda-boton"
                      onClick={() => setVerAyuda((v) => !v)}
                      onMouseEnter={() => setVerAyuda(true)}
                      onBlur={() => setVerAyuda(false)}
                      aria-expanded={verAyuda}
                      aria-describedby="mz-globo"
                    >
                      <HelpCircle size={14} aria-hidden="true" />
                      ¿No conoces el PIN?
                    </button>

                    {verAyuda && (
                      <span id="mz-globo" role="tooltip" className="mz-globo">
                        El PIN solo lo conoce el <strong>dueño</strong>: pídele que lo teclee él mismo en esta pantalla.
                        Si no está en la tienda, cancela y el producto se vende a su <strong>precio normal</strong>.
                      </span>
                    )}
                  </span>
                </div>

                <input
                  ref={pinRef}
                  id="mz-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  className={'mz-pin' + (error ? ' is-error' : '')}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                    setError('')
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && confirmar()}
                  placeholder="••••"
                  disabled={enviando}
                />
              </>
            )}

            {error && (
              <p className="mz-error" role="alert">
                <AlertCircle size={14} aria-hidden="true" />
                {error}
              </p>
            )}

            {/* ---------- Acciones ---------- */}
            <div className="mz-botones">
              <button type="button" className="mz-boton" onClick={onCancelar} disabled={enviando}>
                Cancelar
              </button>
              <button type="button" className="mz-boton mz-boton--primario" onClick={confirmar} disabled={enviando}>
                {enviando ? (
                  <Loader2 size={16} className="mz-girando" aria-hidden="true" />
                ) : (
                  <ShieldCheck size={16} aria-hidden="true" />
                )}
                {enviando ? 'Verificando…' : esPropietario ? 'Aplicar precio' : 'Autorizar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}