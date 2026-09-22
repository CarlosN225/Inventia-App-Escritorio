import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Check, WifiOff, MessageCircle, ShieldCheck } from 'lucide-react'
import logoInventia from '../assets/logo-inventia-sf.png'

const features = [
  { icon: WifiOff,       text: 'Funciona sin conexión a internet' },
  { icon: MessageCircle, text: 'Alertas automáticas por WhatsApp' },
  { icon: ShieldCheck,   text: 'Control seguro de tu inventario' },
]

export default function Login() {
  const navigate = useNavigate()
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'success'

  function handleSubmit(event) {
    event.preventDefault()
    if (status !== 'idle') return

    setStatus('loading')

    // Simulación — aquí va la llamada real al backend
    setTimeout(() => {
      setStatus('success')
      setTimeout(() => navigate('/panel'), 900)
    }, 700)
  }

  return (
    <div className="login-screen">
      {/* ============ HERO IZQUIERDO ============ */}
      <section className="login-hero">
        <img
          src={logoInventia}
          alt="INVENTIA"
          className="login-hero__logo"
        />

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
                required
              />
              <button
                type="button"
                className="login-field__toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={showPassword}
              >
                {showPassword
                  ? <EyeOff size={20} strokeWidth={2} />
                  : <Eye size={20} strokeWidth={2} />}
              </button>
            </div>
          </div>

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

          {/* Link inferior — solo "¿Olvidaste tu contraseña?" */}
          <div className="login-links">
            <a href="#recuperar">¿Olvidaste tu contraseña?</a>
          </div>
        </form>
      </section>
    </div>
  )
}