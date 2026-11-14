import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  Check,
  WifiOff,
  Mail,
  ShieldCheck,
  Store,
  KeyRound,
  ArrowBigUp,
  ArrowLeft,
} from 'lucide-react'

import logoInventia from '../assets/logo-inventia-sf.png'
import { login, getUsuarioActual, recuperarContrasena } from '../services/auth'
import CodigoRecuperacion from '../components/CodigoRecuperacion'

const features = [
  { icon: WifiOff, text: 'Funciona sin conexión a internet' },
  { icon: Mail, text: 'Alertas automáticas por correo' },
  { icon: ShieldCheck, text: 'Control seguro de tu inventario' },
]

export default function Login({ nombreNegocio }) {  
  const navigate = useNavigate()

  const [errorMsg, setErrorMsg] = useState('')
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mantenerSesion, setMantenerSesion] = useState(() => { try { return localStorage.getItem('inventia_mantener_sesion') !== 'no' } catch { return true } })
  const [bloqMayus, setBloqMayus] = useState(false)
  const [ayudaAbierta, setAyudaAbierta] = useState(false)
  const [status, setStatus] = useState('idle')
  const [verificando, setVerificando] = useState(true)

  const ayudaRef = useRef(null)

  // Recuperar contraseña con el código (solo propietarios)
  const [modo, setModo] = useState('login') // login · recuperar · codigo-nuevo
  const [rec, setRec] = useState({ correo: '', codigo: '', nueva: '', confirmar: '' })
  const [recError, setRecError] = useState('')
  const [recGuardando, setRecGuardando] = useState(false)
  const [codigoNuevo, setCodigoNuevo] = useState('')
  const [verRec, setVerRec] = useState({ nueva: false, confirmar: false })

  function abrirRecuperar() {
    setAyudaAbierta(false)
    setRec({ correo: correo.trim(), codigo: '', nueva: '', confirmar: '' })
    setRecError('')
    setModo('recuperar')
  }

  async function enviarRecuperacion(event) {
    event.preventDefault()
    if (recGuardando) return

    if (!rec.correo.trim() || !rec.codigo.trim() || !rec.nueva) {
      setRecError('Llena tu correo, tu código y la contraseña nueva')
      return
    }
    if (rec.nueva.length < 8) {
      setRecError('La contraseña nueva debe tener al menos 8 caracteres')
      return
    }
    if (rec.nueva !== rec.confirmar) {
      setRecError('Las contraseñas no coinciden')
      return
    }

    setRecGuardando(true)
    setRecError('')
    try {
      const data = await recuperarContrasena(rec.correo, rec.codigo, rec.nueva)
      setCodigoNuevo(data.codigo_recuperacion)
      setModo('codigo-nuevo')
    } catch (e) {
      setRecError(e.response?.data?.error ?? 'No se pudo conectar. Intenta de nuevo.')
    } finally {
      setRecGuardando(false)
    }
  }

  function volverAlLogin() {
    setCorreo(rec.correo.trim())
    setPassword('')
    setCodigoNuevo('')
    setModo('login')
  }

  // Si ya hay sesión activa, se va directo al panel
  useEffect(() => {
    getUsuarioActual()
      .then(() => navigate('/panel', { replace: true }))
      .catch(() => setVerificando(false))
  }, [])

  // Cierra el globito de ayuda al dar clic fuera o presionar Esc
  useEffect(() => {
    if (!ayudaAbierta) return

    function alClicFuera(event) {
      if (ayudaRef.current && !ayudaRef.current.contains(event.target)) {
        setAyudaAbierta(false)
      }
    }

    function alPresionarEsc(event) {
      if (event.key === 'Escape') setAyudaAbierta(false)
    }

    document.addEventListener('mousedown', alClicFuera)
    document.addEventListener('keydown', alPresionarEsc)

    return () => {
      document.removeEventListener('mousedown', alClicFuera)
      document.removeEventListener('keydown', alPresionarEsc)
    }
  }, [ayudaAbierta])

  // Detecta si Bloq Mayús está activado mientras escribe
  function revisarBloqMayus(event) {
    if (event.getModifierState) {
      setBloqMayus(event.getModifierState('CapsLock'))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (status !== 'idle') return

    if (!correo.trim() || !password) {
      setErrorMsg('Ingresa tu correo y contraseña')
      return
    }

    setStatus('loading')
    setErrorMsg('')

    try {
      await login(correo, password, mantenerSesion)

      setStatus('success')

      setTimeout(() => {
        navigate('/panel')
      }, 900)
    } catch {
      setStatus('idle')
      setErrorMsg('Correo o contraseña incorrectos')
    }
  }

  if (verificando) {
    return <div style={{ padding: 40 }}>Cargando...</div>
  }

  return (
    <div className="login-screen">
      {/* ============ HERO IZQUIERDO ============ */}
      <section className="login-hero">
        <img src={logoInventia} alt="INVENTIA" className="login-hero__logo" />

        <h1 className="login-hero__title">
          El inventario de tu negocio,{' '}
          <span className="login-hero__title-accent">siempre bajo control.</span>
        </h1>

        <p className="login-hero__subtitle">
          Controla entradas y salidas, evita quedarte sin stock y recibe avisos
          por correo antes de que se agote lo que más vendes.
        </p>

        <ul className="login-hero__features">
          {features.map(({ icon: Icon, text }) => (
            <li className="login-hero__feature" key={text}>
              <span className="login-hero__feature-icon" aria-hidden="true">
                <Icon size={16} strokeWidth={2.2} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </section>

      {/* ============ FORM DERECHO ============ */}
      <section className="login-panel">
        {/* Nombre del negocio */}
        <div className="login-negocio">
          <Store size={16} strokeWidth={2.2} aria-hidden="true" />
          {nombreNegocio || 'Tu negocio'}
        </div>

        {modo === 'recuperar' && (
          <form className="login-form login-form--compacto" onSubmit={enviarRecuperacion} noValidate>
            <header className="login-form__header">
              <h2 className="login-recuperar__titulo">
                <KeyRound size={22} strokeWidth={2.2} aria-hidden="true" />
                Recuperar contraseña
              </h2>
              <p className="login-form__subtitle">
                Escribe tu correo de propietario, tu código de recuperación y una contraseña nueva.
              </p>
            </header>

            <div className="login-field">
              <label htmlFor="rec-correo">Correo</label>
              <div className="login-field__control">
                <input
                  id="rec-correo"
                  type="email"
                  autoComplete="email"
                  placeholder="nombre@negocio.com"
                  value={rec.correo}
                  onChange={(e) => setRec({ ...rec, correo: e.target.value })}
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="rec-codigo">Código de recuperación</label>
              <div className="login-field__control">
                <input
                  id="rec-codigo"
                  autoComplete="off"
                  placeholder="XXXX-XXXX-XXXX"
                  className="login-codigo"
                  value={rec.codigo}
                  onChange={(e) => setRec({ ...rec, codigo: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div className="login-fila-doble">
              {[
                { campo: 'nueva', id: 'rec-nueva', texto: 'Contraseña nueva', placeholder: 'Mínimo 8 caracteres' },
                { campo: 'confirmar', id: 'rec-confirmar', texto: 'Confírmala', placeholder: 'Repítela' },
              ].map((c) => (
                <div className="login-field login-field--password" key={c.campo}>
                  <label htmlFor={c.id}>{c.texto}</label>
                  <div className="login-field__control">
                    <input
                      id={c.id}
                      type={verRec[c.campo] ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder={c.placeholder}
                      value={rec[c.campo]}
                      onChange={(e) => setRec({ ...rec, [c.campo]: e.target.value })}
                    />
                    <button
                      type="button"
                      className="login-field__toggle"
                      onClick={() => setVerRec((v) => ({ ...v, [c.campo]: !v[c.campo] }))}
                      aria-label={verRec[c.campo] ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      aria-pressed={verRec[c.campo]}
                    >
                      {verRec[c.campo] ? <EyeOff size={19} strokeWidth={2} /> : <Eye size={19} strokeWidth={2} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {recError && <p className="login-error">{recError}</p>}

            <button type="submit" className="login-submit" disabled={recGuardando}>
              <span className="login-submit__content">
                {recGuardando ? 'Cambiando…' : 'Cambiar contraseña'}
              </span>
            </button>

            <button type="button" className="login-volver" onClick={() => setModo('login')}>
              <ArrowLeft size={16} aria-hidden="true" />
              Volver a iniciar sesión
            </button>
          </form>
        )}

        {modo === 'codigo-nuevo' && (
          <div className="login-form">
            <header className="login-form__header">
              <h2 className="login-form__brand">¡Listo!</h2>
              <p className="login-form__subtitle">
                Tu contraseña ya cambió. Tu código anterior ya no sirve: anota el nuevo.
              </p>
            </header>
            <CodigoRecuperacion codigo={codigoNuevo} onConfirmar={volverAlLogin} textoBoton="Iniciar sesión" />
          </div>
        )}

        {modo === 'login' && (
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <header className="login-form__header">
            <h2 className="login-form__brand">INVENTIA</h2>
            <p className="login-form__subtitle">
              Ingresa tus credenciales para continuar
            </p>
          </header>

          {/* Correo */}
          <div className="login-field">
            <label htmlFor="correo">Correo</label>
            <div className="login-field__control">
              <input
                id="correo"
                name="correo"
                type="email"
                autoComplete="email"
                placeholder="nombre@negocio.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                onKeyDown={revisarBloqMayus}
                onKeyUp={revisarBloqMayus}
                required
              />
            </div>
          </div>

          {/* Contraseña con toggle */}
          <div className="login-field login-field--password">
            <label htmlFor="password">Contraseña</label>
            <div className="login-field__control">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={revisarBloqMayus}
                onKeyUp={revisarBloqMayus}
                required
              />
              <button
                type="button"
                className="login-field__toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <EyeOff size={20} strokeWidth={2} />
                ) : (
                  <Eye size={20} strokeWidth={2} />
                )}
              </button>
            </div>

            {bloqMayus && (
              <p className="login-bloqmayus" role="status">
                <ArrowBigUp size={15} strokeWidth={2.4} aria-hidden="true" />
                Bloq Mayús está activado
              </p>
            )}
          </div>

          {/* Mantener sesión + ¿Olvidaste tu contraseña? */}
          <div className="login-opciones">
            <label className="login-recordar">
              <input
                type="checkbox"
                checked={mantenerSesion}
                onChange={(e) => { setMantenerSesion(e.target.checked); try { localStorage.setItem('inventia_mantener_sesion', e.target.checked ? 'si' : 'no') } catch { /* sin almacenamiento: solo esta vez */ } }}
                />
              Mantener sesión iniciada
            </label>

            <div className="login-ayuda" ref={ayudaRef}>
              <button
                type="button"
                className="login-ayuda__enlace"
                onClick={() => setAyudaAbierta((v) => !v)}
                aria-expanded={ayudaAbierta}
                aria-controls="ayuda-contrasena"
              >
                ¿Olvidaste tu contraseña?
              </button>

              {ayudaAbierta && (
                <div
                  id="ayuda-contrasena"
                  className="login-ayuda__globo"
                  role="dialog"
                  aria-label="Recuperar contraseña"
                >
                  <div className="login-ayuda__titulo">
                    <span className="login-ayuda__icono" aria-hidden="true">
                      <KeyRound size={16} strokeWidth={2.2} />
                    </span>
                    Recuperar contraseña
                  </div>

                  <p className="login-ayuda__texto">
                    <strong>¿Eres encargado?</strong> Pídele al propietario que la
                    restablezca desde <strong>Configuración › Usuarios</strong>.
                  </p>

                  <p className="login-ayuda__texto">
                    <strong>¿Eres el propietario?</strong> Cámbiala tú mismo con tu
                    código de recuperación.
                  </p>

                  <div className="login-ayuda__botones">
                    <button
                      type="button"
                      className="login-ayuda__ok"
                      onClick={() => setAyudaAbierta(false)}
                    >
                      Entendido
                    </button>
                    <button
                      type="button"
                      className="login-ayuda__ok login-ayuda__ok--principal"
                      onClick={abrirRecuperar}
                    >
                      Usar mi código
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {errorMsg && <p className="login-error">{errorMsg}</p>}

          {/* Botón principal */}
          <button
            type="submit"
            className={'login-submit' + (status === 'success' ? ' is-success' : '')}
            disabled={status !== 'idle'}
          >
            <span className="login-submit__content">
              {status === 'success' ? (
                <>
                  <Check size={22} strokeWidth={3} className="login-submit__check" />
                  ¡Bienvenido!
                </>
              ) : status === 'loading' ? (
                'Iniciando sesión…'
              ) : (
                'Iniciar sesión'
              )}
            </span>
          </button>
        </form>
        )}
      </section>
    </div>
  )
}
