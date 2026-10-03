import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  Check,
  WifiOff,
  MessageCircle,
  ShieldCheck,
  Store,
  KeyRound,
  ArrowBigUp,
} from 'lucide-react'

import logoInventia from '../assets/logo-inventia-sf.png'
import { login, getUsuarioActual } from '../services/auth'

// TODO: traerlo del backend cuando exista el modelo Negocio
const NOMBRE_NEGOCIO = 'Dulcería Los Querubines'

const features = [
  { icon: WifiOff, text: 'Funciona sin conexión a internet' },
  { icon: MessageCircle, text: 'Alertas automáticas por WhatsApp' },
  { icon: ShieldCheck, text: 'Control seguro de tu inventario' },
]

export default function Login() {
  const navigate = useNavigate()

  const [errorMsg, setErrorMsg] = useState('')
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mantenerSesion, setMantenerSesion] = useState(false)
  const [bloqMayus, setBloqMayus] = useState(false)
  const [ayudaAbierta, setAyudaAbierta] = useState(false)
  const [status, setStatus] = useState('idle')
  const [verificando, setVerificando] = useState(true)

  const ayudaRef = useRef(null)

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
    } catch (err) {
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
          por WhatsApp antes de que se agote lo que más vendes.
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
          {NOMBRE_NEGOCIO}
        </div>

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
                onChange={(e) => setMantenerSesion(e.target.checked)}
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
                    Pídele al <strong>propietario del negocio</strong> que la
                    restablezca desde <strong>Configuración › Usuarios</strong>.
                  </p>

                  <button
                    type="button"
                    className="login-ayuda__ok"
                    onClick={() => setAyudaAbierta(false)}
                  >
                    Entendido
                  </button>
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
      </section>
    </div>
  )
}