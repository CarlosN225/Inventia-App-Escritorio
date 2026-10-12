import { useEffect, useState } from 'react'
import { AlertCircle, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from 'lucide-react'

import { getUsuarioActual, cambiarContrasenaTemporal } from '../services/auth'
import { notificar } from '../services/notificar'
import '../styles/contrasena-obligatoria.css'

/*
  Si el usuario entró con una contraseña temporal (alta o restablecida),
  no puede usar la app hasta crear la suya. La ventanita no se puede cerrar.
*/
export default function ContrasenaObligatoria() {
  const [usuario, setUsuario] = useState(null)
  const [campos, setCampos] = useState({ actual: '', nueva: '', confirmar: '' })
  const [ver, setVer] = useState(false)
  const [intento, setIntento] = useState(false)
  const [errorServidor, setErrorServidor] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    getUsuarioActual()
      .then(setUsuario)
      .catch(() => setUsuario(null))
  }, [])

  if (!usuario?.debe_cambiar_contrasena) return null

  const errores = {}
  if (!campos.actual) errores.actual = 'Escribe la contraseña que te dieron'
  if (campos.nueva.length < 6) errores.nueva = 'Mínimo 6 caracteres'
  else if (campos.nueva === campos.actual) errores.nueva = 'Debe ser diferente a la temporal'
  if (campos.confirmar !== campos.nueva) errores.confirmar = 'Las contraseñas no coinciden'

  const error = (campo) => (intento ? errores[campo] : null)

  function cambiar(campo, valor) {
    setCampos((c) => ({ ...c, [campo]: valor }))
    setErrorServidor('')
  }

  async function guardar(e) {
    e.preventDefault()
    setIntento(true)
    if (Object.keys(errores).length > 0 || enviando) return

    setEnviando(true)

    try {
      await cambiarContrasenaTemporal(campos.actual, campos.nueva)
      notificar({ texto: 'Listo, ya tienes tu propia contraseña' })
      setUsuario({ ...usuario, debe_cambiar_contrasena: false })
    } catch (err) {
      const datos = err?.response?.data
      setErrorServidor(
        datos?.contrasena_actual ?? datos?.nueva_contrasena ?? datos?.error ?? datos?.detail ?? 'No se pudo cambiar. Intenta de nuevo.'
      )
    } finally {
      setEnviando(false)
    }
  }

  const nombre = (usuario.nombre_completo ?? '').trim().split(/\s+/)[0]

  return (
    <div className="co" role="presentation">
      <form className="co-caja" role="dialog" aria-modal="true" aria-labelledby="co-titulo" onSubmit={guardar} noValidate>
        <span className="co-icono" aria-hidden="true">
          <KeyRound size={26} />
        </span>

        <h2 id="co-titulo" className="co-titulo">
          Hola, {nombre}. Crea tu contraseña
        </h2>
        <p className="co-sub">
          Entraste con una contraseña <strong>temporal</strong>. Para que solo tú puedas entrar con tu usuario, cámbiala
          por una tuya antes de seguir.
        </p>

        {[
          { id: 'actual', etiqueta: 'Contraseña temporal', ayuda: 'La que te dio el dueño' },
          { id: 'nueva', etiqueta: 'Tu nueva contraseña', ayuda: 'Mínimo 6 caracteres' },
          { id: 'confirmar', etiqueta: 'Confírmala', ayuda: '' },
        ].map((c, i) => (
          <div key={c.id} className="co-campo">
            <label htmlFor={`co-${c.id}`}>{c.etiqueta}</label>
            <div className={'co-input' + (error(c.id) ? ' is-error' : '')}>
              <input
                id={`co-${c.id}`}
                type={ver ? 'text' : 'password'}
                autoComplete={c.id === 'actual' ? 'current-password' : 'new-password'}
                autoFocus={i === 0}
                value={campos[c.id]}
                onChange={(e) => cambiar(c.id, e.target.value)}
                disabled={enviando}
              />
              {i === 0 && (
                <button
                  type="button"
                  className="co-ver"
                  onClick={() => setVer((v) => !v)}
                  aria-label={ver ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
                >
                  {ver ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
            </div>
            {error(c.id) ? (
              <p className="co-error">
                <AlertCircle size={13} aria-hidden="true" />
                {error(c.id)}
              </p>
            ) : (
              c.ayuda && <p className="co-ayuda">{c.ayuda}</p>
            )}
          </div>
        ))}

        {errorServidor && (
          <p className="co-error co-error--general" role="alert">
            <AlertCircle size={14} aria-hidden="true" />
            {errorServidor}
          </p>
        )}

        <button type="submit" className="co-boton" disabled={enviando}>
          {enviando ? (
            <Loader2 size={16} className="co-girando" aria-hidden="true" />
          ) : (
            <ShieldCheck size={16} aria-hidden="true" />
          )}
          {enviando ? 'Guardando…' : 'Guardar y entrar'}
        </button>
      </form>
    </div>
  )
}