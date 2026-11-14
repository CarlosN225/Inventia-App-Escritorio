import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Store,
  MapPin,
  Phone,
  User,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  Check,
  CalendarClock,
  Boxes,
  Tag,
  Barcode,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Loader2,
  Plus,
  LayoutGrid,
  Candy,
  Lock,
  ShieldCheck,
  Zap,
  Home,
  Sparkles,
  Clock,
  Send,
} from 'lucide-react'

import logo from '../assets/logo-inventia-sf.png'
import { estadoInicial, crearPrimerPropietario, login } from '../services/auth'
import CodigoRecuperacion from '../components/CodigoRecuperacion'
import RestaurarInicial from '../components/RestaurarInicial'
import { probarCorreo } from '../services/alertas'
import '../styles/asistente.css'

const PASOS = ['Tu negocio', 'Tu cuenta', 'Cómo trabajas', '¡Listo!']

// Las 5 preferencias, con sus respuestas por defecto (lo de las entrevistas)
const PREGUNTAS = [
  {
    id: 'maneja_caducidad',
    icono: CalendarClock,
    titulo: '¿Tus productos tienen fecha de caducidad?',
    ejemplo: 'Ej. chocolates, mazapanes, gomitas',
    activo: 'Fecha de caducidad',
  },
  {
    id: 'vende_mayoreo',
    icono: Boxes,
    titulo: '¿Vendes a mayoreo con otro precio?',
    ejemplo: 'Ej. paquetes cerrados a cooperativas escolares o tienditas',
    activo: 'Precios de mayoreo',
  },
  {
    id: 'maneja_promociones',
    icono: Tag,
    titulo: '¿Haces promociones o descuentos?',
    ejemplo: 'Ej. 10% de descuento en lo que está por caducar',
    activo: 'Promociones y descuentos',
  },
  {
    id: 'usa_codigo_barras',
    icono: Barcode,
    titulo: '¿Tienes lector de código de barras?',
    ejemplo: 'Si no sabes, elige No: lo puedes activar cuando quieras',
    activo: 'Código de barras',
  },
  {
    id: 'alertas_activas',
    icono: Mail,
    titulo: '¿Te avisamos por correo cuando haga falta?',
    ejemplo: 'Solo si algo se agota, se está acabando o va a caducar. Si no hay novedades, no te llega nada.',
    activo: 'Avisos por correo',
    recomendado: true,
  },
]

// Las mismas opciones que en Configuración → Correo y alertas
const HORAS = [
  { valor: '18:00', texto: '6:00 p.m.' },
  { valor: '19:00', texto: '7:00 p.m.' },
  { valor: '20:00', texto: '8:00 p.m.' },
  { valor: '21:00', texto: '9:00 p.m.' },
  { valor: '22:00', texto: '10:00 p.m.' },
]

const DIAS_CADUCIDAD = [15, 30, 45, 60]

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const DATOS_INICIALES = {
  negocio: { nombre: '', direccion: '', telefono: '' },
  propietario: { nombre_completo: '', correo: '', telefono_whatsapp: '', contrasena: '', confirmar: '' },
  preferencias: {
    maneja_caducidad: true,
    vende_mayoreo: true,
    maneja_promociones: true,
    usa_codigo_barras: false,
    alertas_activas: true,
    correo_alertas: null, // null = el mismo correo de su cuenta
    hora_resumen: '20:00',
    dias_aviso_caducidad: 30,
  },
}

const NIVELES = ['', 'Débil', 'Regular', 'Buena', 'Segura']

/* ============ Utilidades ============ */

function soloDigitos(texto) {
  return (texto ?? '').replace(/\D/g, '')
}

function primerNombre(nombre) {
  const partes = (nombre ?? '').trim().split(/\s+/)
  return partes.slice(0, 2).join(' ')
}

function textoHora(valor) {
  return HORAS.find((h) => h.valor === valor)?.texto ?? valor
}

// Si no lo cambió, los avisos llegan al correo de su cuenta
function correoDeAvisos(preferencias, propietario) {
  return (preferencias.correo_alertas ?? propietario.correo).trim().toLowerCase()
}

function reglasContrasena(contrasena) {
  return [
    { texto: 'Al menos 8 caracteres', ok: contrasena.length >= 8 },
    { texto: 'Al menos un número', ok: /\d/.test(contrasena) },
    { texto: 'Al menos una letra', ok: /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(contrasena) },
  ]
}

/* ============ Validaciones por paso ============ */

function erroresNegocio(n) {
  const e = {}
  if (!n.nombre.trim()) e.nombre = 'Escribe el nombre de tu dulcería'
  // Opcional: no todas las dulcerías tienen teléfono; si lo escriben, que tenga 10 dígitos
  const digitos = soloDigitos(n.telefono).length
  if (digitos > 0 && digitos !== 10) e.telefono = 'Le faltan números: son 10 dígitos'
  return e
}

function erroresCuenta(p) {
  const e = {}
  if (!p.nombre_completo.trim()) e.nombre_completo = 'Escribe tu nombre'
  if (!p.correo.trim()) e.correo = 'Escribe tu correo'
  else if (!CORREO_VALIDO.test(p.correo.trim())) e.correo = 'Revisa que el correo esté bien escrito'
  // El teléfono ya es opcional; si lo escribe, que tenga 10 dígitos
  const digitos = soloDigitos(p.telefono_whatsapp).length
  if (digitos > 0 && digitos !== 10) e.telefono_whatsapp = 'Le faltan números: son 10 dígitos'
  if (reglasContrasena(p.contrasena).some((r) => !r.ok)) e.contrasena = 'Cumple todas las reglas de abajo'
  if (!p.confirmar || p.confirmar !== p.contrasena) e.confirmar = 'Las contraseñas no coinciden'
  return e
}

function erroresPreferencias(pref, propietario) {
  const e = {}
  if (pref.alertas_activas) {
    const correo = correoDeAvisos(pref, propietario)
    if (!correo) e.correo_alertas = 'Escribe a qué correo te avisamos'
    else if (!CORREO_VALIDO.test(correo)) e.correo_alertas = 'Revisa que el correo esté bien escrito'
  }
  return e
}

/* ============ Piezas reutilizables ============ */

function Campo({ id, etiqueta, requerido, icono: Icono, error, ayuda, children }) {
  return (
    <div className="as-campo">
      <label className="as-etiqueta" htmlFor={id}>
        {etiqueta} {requerido && <span className="as-requerido">*</span>}
      </label>
      <div className={'as-input' + (error ? ' is-error' : '')}>
        <Icono size={16} aria-hidden="true" />
        {children}
      </div>
      {error ? (
        <p className="as-error">
          <AlertCircle size={13} aria-hidden="true" />
          {error}
        </p>
      ) : (
        ayuda && <p className="as-ayuda">{ayuda}</p>
      )}
    </div>
  )
}

function CampoContrasena({ id, etiqueta, valor, onCambiar, error, autoComplete }) {
  const [visible, setVisible] = useState(false)

  return (
    <Campo id={id} etiqueta={etiqueta} requerido icono={KeyRound} error={error}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
      />
      <button
        type="button"
        className="as-ojo"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </Campo>
  )
}

/* ============ Pantalla ============ */

export default function AsistenteInicial() {
  const navigate = useNavigate()
  const location = useLocation()
  const demo = new URLSearchParams(location.search).has('demo')

  const [paso, setPaso] = useState(1)
  const [datos, setDatos] = useState(DATOS_INICIALES)
  const [intentos, setIntentos] = useState({}) // { 1: true } cuando ya intentó avanzar en ese paso
  const [erroresServidor, setErroresServidor] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState(null) // { texto, yaConfigurada }
  const [prueba, setPrueba] = useState({ estado: 'nada', texto: '' }) // correo de prueba del paso 4
  const [codigo, setCodigo] = useState('') // código de recuperación (se muestra una sola vez)
  const [codigoAnotado, setCodigoAnotado] = useState(false)
  const [restaurando, setRestaurando] = useState(false) // compu nueva: recuperar desde un respaldo

  // Si la app ya tiene dueño, no se puede volver a configurar (salvo en modo demo)
  useEffect(() => {
    if (demo) return
    estadoInicial()
      .then((r) => {
        if (r?.necesita_configuracion === false) navigate('/', { replace: true })
      })
      .catch(() => {}) // TODO: mientras Bryan sube el endpoint, se deja pasar
  }, [demo, navigate])

  const { negocio, propietario, preferencias } = datos

  function cambiar(seccion, campo, valor) {
    setDatos((d) => ({ ...d, [seccion]: { ...d[seccion], [campo]: valor } }))
    setErroresServidor((e) => {
      const copia = { ...e }
      delete copia[campo]
      return copia
    })
  }

  /* ---------- Errores del paso actual ---------- */

  const erroresPorPaso = {
    1: erroresNegocio(negocio),
    2: erroresCuenta(propietario),
    3: erroresPreferencias(preferencias, propietario),
  }

  // Se muestran los del servidor siempre; los locales, cuando ya intentó avanzar
  function errorDe(numeroPaso, campo) {
    return erroresServidor[campo] ?? (intentos[numeroPaso] ? erroresPorPaso[numeroPaso]?.[campo] : null)
  }

  /* ---------- Navegación ---------- */

  function irA(numero) {
    setErrorGeneral(null)
    setPaso(numero)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function continuar() {
    setIntentos((i) => ({ ...i, [paso]: true }))
    if (Object.keys(erroresPorPaso[paso] ?? {}).length > 0) return

    if (paso < 3) {
      irA(paso + 1)
      return
    }

    await guardar()
  }

  /* ---------- Guardar (al pasar del paso 3 al 4) ---------- */

  async function guardar() {
    setErrorGeneral(null)

    if (demo) {
      setCodigo('K7P2-M9QX-4TRW')
      irA(4)
      return
    }

    setGuardando(true)

    const cuenta = {
      nombre_completo: propietario.nombre_completo.trim(),
      correo: propietario.correo.trim().toLowerCase(),
      contrasena: propietario.contrasena,
      telefono_whatsapp: soloDigitos(propietario.telefono_whatsapp),
    }

    try {
      // Va de las dos formas: suelto (como lo lee hoy el endpoint) y agrupado (como lo leerá con el cambio de Bryan)
      const creado = await crearPrimerPropietario({
        ...cuenta,
        propietario: cuenta,
        negocio: {
          nombre: negocio.nombre.trim(),
          direccion: negocio.direccion.trim(),
          telefono: soloDigitos(negocio.telefono),
        },
        preferencias: {
          ...preferencias,
          correo_alertas: correoDeAvisos(preferencias, propietario),
        },
      })

      setCodigo(creado?.codigo_recuperacion ?? '')

      // Entra solito, para que no tenga que volver a escribir su contraseña
      await login(cuenta.correo, cuenta.contrasena)

      irA(4)
    } catch (e) {
      const mensaje = e.response?.data?.error ?? null

      if (e.response?.status === 403) {
        setErrorGeneral({ texto: 'Esta app ya tiene un propietario. Entra con tu cuenta.', yaConfigurada: true })
      } else if (mensaje && /avisos/i.test(mensaje)) {
        setErroresServidor({ correo_alertas: mensaje })
        irA(3)
      } else if (mensaje && /teléfono de la dulcería/i.test(mensaje)) {
        setErroresServidor({ telefono: mensaje })
        irA(1)
      } else if (mensaje && /teléfono de contacto/i.test(mensaje)) {
        setErroresServidor({ telefono_whatsapp: mensaje })
        irA(2)
      } else if (mensaje && /correo/i.test(mensaje)) {
        setErroresServidor({ correo: mensaje })
        irA(2)
      } else if (mensaje && /contrase/i.test(mensaje)) {
        setErroresServidor({ contrasena: mensaje })
        irA(2)
      } else {
        setErrorGeneral({
          texto: mensaje ?? (e.response ? 'Ocurrió un error inesperado. Intenta de nuevo.' : 'No se pudo conectar con el servidor.'),
        })
      }
    } finally {
      setGuardando(false)
    }
  }

  /* ---------- Correo de prueba (paso 4) ---------- */

  async function mandarPrueba() {
    setPrueba({ estado: 'enviando', texto: '' })

    if (demo) {
      setTimeout(() => setPrueba({ estado: 'ok', texto: '' }), 700)
      return
    }

    try {
      await probarCorreo()
      setPrueba({ estado: 'ok', texto: '' })
    } catch (e) {
      const sinInternet = !e.response
      setPrueba({
        estado: 'error',
        texto: sinInternet
          ? 'Sin conexión. Revisa tu internet y vuelve a intentar.'
          : 'No se pudo enviar. Revísalo luego en Configuración.',
      })
    }
  }

  /* ---------- Contraseña ---------- */

  const reglas = reglasContrasena(propietario.contrasena)
  const nivel = propietario.contrasena ? reglas.filter((r) => r.ok).length + (propietario.contrasena.length >= 12 ? 1 : 0) : 0

  return (
    <div className="as">
      {/* ============ MARCA ============ */}
      <header className="as-marca">
        <img src={logo} alt="" className="as-marca__logo" />
        <div>
          <p className="as-marca__nombre">INVENTIA</p>
          <p className="as-marca__sub">Control dulcero · Asistente de inicio</p>
        </div>
        {demo && <span className="as-demo">Vista previa</span>}
      </header>

      {/* ============ PASOS ============ */}
      <ol className="as-pasos" aria-label="Pasos">
        {PASOS.map((nombre, i) => {
          const numero = i + 1
          const estado = numero < paso || paso === 4 ? 'hecho' : numero === paso ? 'actual' : 'pendiente'
          const clicable = numero < paso && paso < 4 && !guardando

          return (
            <li key={nombre} className={`as-paso as-paso--${estado}`}>
              <button type="button" disabled={!clicable} onClick={() => irA(numero)} aria-current={numero === paso ? 'step' : undefined}>
                <span className="as-paso__circulo">{estado === 'hecho' ? <Check size={16} strokeWidth={3} /> : numero}</span>
                <span className="as-paso__nombre">
                  {numero}. {nombre}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {/* ============ TARJETA ============ */}
      <main className="as-tarjeta">
        {errorGeneral && (
          <div className="as-aviso" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{errorGeneral.texto}</span>
            {errorGeneral.yaConfigurada && (
              <button type="button" className="as-boton as-boton--secundario as-boton--chico" onClick={() => navigate('/')}>
                Ir a iniciar sesión
              </button>
            )}
          </div>
        )}

        {/* ---------- Paso 1 ---------- */}
        {paso === 1 && (
          <section className="as-seccion">
            <header className="as-seccion__cabecera">
              <div>
                <h1 className="as-titulo">1. Cuéntanos de tu dulcería</h1>
                <p className="as-subtitulo">Así aparecerá en la barra de arriba y en tus avisos por correo.</p>
                {!demo && (
                  <button type="button" className="as-restaurar" onClick={() => setRestaurando(true)}>
                    <span>¿Ya usabas Inventia en otra computadora?</span>
                    Restaurar un respaldo
                  </button>
                )}
              </div>
              <span className="as-insignia">
                <Zap size={13} aria-hidden="true" />
                Toma 3 minutos en total
              </span>
            </header>

            <div className="as-campos">
              <div className="as-campos__ancho">
                <Campo id="as-negocio" etiqueta="Nombre del negocio" requerido icono={Store} error={errorDe(1, 'nombre')}>
                  <input
                    id="as-negocio"
                    autoFocus
                    maxLength={120}
                    placeholder="Ej. Dulcería La Esperanza"
                    value={negocio.nombre}
                    onChange={(e) => cambiar('negocio', 'nombre', e.target.value)}
                  />
                </Campo>
              </div>

              <Campo id="as-direccion" etiqueta="Dirección (opcional)" icono={MapPin} ayuda="Calle, número y colonia">
                <input
                  id="as-direccion"
                  maxLength={200}
                  placeholder="Ej. Calle Morelos 12, Col. Centro"
                  value={negocio.direccion}
                  onChange={(e) => cambiar('negocio', 'direccion', e.target.value)}
                />
              </Campo>

              <Campo
                id="as-tel-negocio"
                etiqueta="Teléfono de la dulcería (opcional)"
                icono={Phone}
                error={errorDe(1, 'telefono')}
                ayuda="Para que te localicen clientes y proveedores · 10 dígitos"
              >
                <input
                  id="as-tel-negocio"
                  inputMode="tel"
                  placeholder="55 1234 5678"
                  value={negocio.telefono}
                  onChange={(e) => cambiar('negocio', 'telefono', e.target.value)}
                />
              </Campo>
            </div>
          </section>
        )}

        {/* ---------- Paso 2 ---------- */}
        {paso === 2 && (
          <section className="as-seccion">
            <header className="as-seccion__cabecera">
              <div>
                <h1 className="as-titulo">2. Crea tu cuenta de propietario</h1>
                <p className="as-subtitulo">Con este correo y contraseña vas a entrar a Inventia. Tú tendrás acceso a todo.</p>
              </div>
              <span className="as-insignia as-insignia--morada">
                <ShieldCheck size={13} aria-hidden="true" />
                Propietario
              </span>
            </header>

            <div className="as-campos">
              <Campo id="as-nombre" etiqueta="Tu nombre completo" requerido icono={User} error={errorDe(2, 'nombre_completo')}>
                <input
                  id="as-nombre"
                  autoFocus
                  maxLength={120}
                  placeholder="Ej. Ana Luisa Reyes Martínez"
                  value={propietario.nombre_completo}
                  onChange={(e) => cambiar('propietario', 'nombre_completo', e.target.value)}
                />
              </Campo>

              <Campo
                id="as-telefono"
                etiqueta="Tu teléfono (opcional)"
                icono={Phone}
                error={errorDe(2, 'telefono_whatsapp')}
                ayuda="Por si tus encargados necesitan localizarte · 10 dígitos"
              >
                <input
                  id="as-telefono"
                  inputMode="tel"
                  placeholder="55 1234 5678"
                  value={propietario.telefono_whatsapp}
                  onChange={(e) => cambiar('propietario', 'telefono_whatsapp', e.target.value)}
                />
              </Campo>

              <div className="as-campos__ancho">
                <Campo id="as-correo" etiqueta="Correo" requerido icono={Mail} error={errorDe(2, 'correo')}>
                  <input
                    id="as-correo"
                    type="email"
                    autoComplete="email"
                    placeholder="Ej. nombre@micorreo.com"
                    value={propietario.correo}
                    onChange={(e) => cambiar('propietario', 'correo', e.target.value)}
                  />
                </Campo>
              </div>

              <CampoContrasena
                id="as-contrasena"
                etiqueta="Contraseña"
                autoComplete="new-password"
                valor={propietario.contrasena}
                onCambiar={(v) => cambiar('propietario', 'contrasena', v)}
                error={errorDe(2, 'contrasena')}
              />

              <CampoContrasena
                id="as-confirmar"
                etiqueta="Confírmala"
                autoComplete="new-password"
                valor={propietario.confirmar}
                onCambiar={(v) => cambiar('propietario', 'confirmar', v)}
                error={errorDe(2, 'confirmar')}
              />

              <div className="as-campos__ancho">
                <div className={`as-medidor as-medidor--${nivel}`}>
                  <div className="as-medidor__barras" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="as-medidor__texto">{NIVELES[nivel] || '—'}</span>
                </div>

                <ul className="as-reglas">
                  {reglas.map((r) => (
                    <li key={r.texto} className={r.ok ? 'is-ok' : ''}>
                      <span className="as-reglas__icono" aria-hidden="true">
                        {r.ok && <Check size={11} strokeWidth={3} />}
                      </span>
                      {r.texto}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* ---------- Paso 3 ---------- */}
        {paso === 3 && (
          <section className="as-seccion">
            <header className="as-seccion__cabecera">
              <div>
                <h1 className="as-titulo">3. ¿Cómo trabaja tu dulcería?</h1>
                <p className="as-subtitulo">
                  Responde y te mostramos solo lo que necesitas. Puedes cambiarlo después en Configuración.
                </p>
              </div>
              <span className="as-insignia">
                <Zap size={13} aria-hidden="true" />
                Toma menos de 1 min
              </span>
            </header>

            <ul className="as-preguntas">
              {PREGUNTAS.map((q) => {
                const Icono = q.icono
                const valor = preferencias[q.id]
                const conCorreo = q.id === 'alertas_activas' && valor
                const errorCorreo = conCorreo ? errorDe(3, 'correo_alertas') : null

                return (
                  <li key={q.id} className={'as-pregunta' + (conCorreo ? ' con-extra' : '') + (errorCorreo ? ' is-error' : '')}>
                    <span className={'as-pregunta__icono' + (q.id === 'alertas_activas' ? ' is-email' : '')} aria-hidden="true">
                      <Icono size={18} />
                    </span>

                    <div className="as-pregunta__texto">
                      <p className="as-pregunta__titulo">
                        {q.titulo}
                        {q.recomendado && <span className="as-recomendado">Recomendado</span>}
                      </p>
                      <p className="as-pregunta__ejemplo">{q.ejemplo}</p>
                    </div>

                    {/* Con caducidad: con cuántos días de anticipación avisar */}
                    {q.id === 'maneja_caducidad' && valor && (
                      <label className="as-mini">
                        Avisar
                        <select
                          value={preferencias.dias_aviso_caducidad}
                          onChange={(e) => cambiar('preferencias', 'dias_aviso_caducidad', Number(e.target.value))}
                          aria-label="Con cuántos días de anticipación avisar de la caducidad"
                        >
                          {DIAS_CADUCIDAD.map((d) => (
                            <option key={d} value={d}>
                              {d} días antes
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <div className="as-sino" role="radiogroup" aria-label={q.titulo}>
                      {[true, false].map((opcion) => (
                        <button
                          key={String(opcion)}
                          type="button"
                          role="radio"
                          aria-checked={valor === opcion}
                          className={valor === opcion ? 'is-activo' : ''}
                          onClick={() => cambiar('preferencias', q.id, opcion)}
                        >
                          {valor === opcion && <Check size={13} strokeWidth={3} aria-hidden="true" />}
                          {opcion ? 'Sí' : 'No'}
                        </button>
                      ))}
                    </div>

                    {/* Con avisos: a qué correo y a qué hora revisamos */}
                    {conCorreo && (
                      <div className="as-pregunta__extra">
                        <label className={'as-mini as-mini--correo' + (errorCorreo ? ' is-error' : '')}>
                          <Mail size={14} aria-hidden="true" />
                          Enviar a
                          <input
                            type="email"
                            autoComplete="email"
                            placeholder="nombre@micorreo.com"
                            value={preferencias.correo_alertas ?? propietario.correo}
                            onChange={(e) => cambiar('preferencias', 'correo_alertas', e.target.value)}
                            aria-label="Correo para los avisos"
                          />
                        </label>

                        <label className="as-mini">
                          <Clock size={14} aria-hidden="true" />
                          Revisar a las
                          <select
                            value={preferencias.hora_resumen}
                            onChange={(e) => cambiar('preferencias', 'hora_resumen', e.target.value)}
                            aria-label="Hora en que se revisa el inventario"
                          >
                            {HORAS.map((h) => (
                              <option key={h.valor} value={h.valor}>
                                {h.texto}
                              </option>
                            ))}
                          </select>
                        </label>

                        {errorCorreo && (
                          <p className="as-error">
                            <AlertCircle size={13} aria-hidden="true" />
                            {errorCorreo}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* ---------- Paso 4 ---------- */}
        {paso === 4 && (
          <section className="as-seccion as-listo">
            <div className="as-listo__icono" aria-hidden="true">
              <Sparkles size={16} className="as-listo__chispa as-listo__chispa--1" />
              <Sparkles size={12} className="as-listo__chispa as-listo__chispa--2" />
              <span className="as-listo__dulce">
                <Candy size={34} />
              </span>
              <span className="as-listo__check">
                <Check size={16} strokeWidth={3.5} />
              </span>
            </div>

            <h1 className="as-listo__titulo">¡Todo listo, {primerNombre(propietario.nombre_completo) || 'bienvenido'}!</h1>
            <p className="as-listo__texto">Inventia ya está configurado a la medida de tu mostrador.</p>

            {codigo && !codigoAnotado && (
              <CodigoRecuperacion codigo={codigo} onConfirmar={() => setCodigoAnotado(true)} />
            )}

            {(!codigo || codigoAnotado) && (
            <>
            <div className="as-resumen">
              <div className="as-resumen__cabecera">
                <span className="as-resumen__icono" aria-hidden="true">
                  <Home size={18} />
                </span>
                <div>
                  <p className="as-resumen__etiqueta">Tu establecimiento</p>
                  <p className="as-resumen__negocio">{negocio.nombre.trim()}</p>
                </div>
                <span className="as-chip as-chip--morado">
                  <span className="as-chip__punto" aria-hidden="true" />
                  {propietario.nombre_completo.trim()} (Propietario)
                </span>
              </div>

              <div className="as-resumen__fila">
                <p className="as-resumen__etiqueta">Lo que activaste</p>

                {/* Para que vea que sí le llegan los avisos */}
                {preferencias.alertas_activas && (
                  <div className="as-prueba">
                    {prueba.estado === 'ok' && (
                      <span className="as-prueba__ok">
                        <Check size={13} strokeWidth={3} aria-hidden="true" />
                        Enviado. Revisa tu bandeja (y la carpeta de spam).
                      </span>
                    )}
                    {prueba.estado === 'error' && (
                      <span className="as-prueba__error">
                        <AlertCircle size={13} aria-hidden="true" />
                        {prueba.texto}
                      </span>
                    )}
                    <button
                      type="button"
                      className="as-boton as-boton--secundario as-boton--chico"
                      onClick={mandarPrueba}
                      disabled={prueba.estado === 'enviando'}
                    >
                      {prueba.estado === 'enviando' ? (
                        <Loader2 size={14} className="as-girando" aria-hidden="true" />
                      ) : (
                        <Send size={14} aria-hidden="true" />
                      )}
                      {prueba.estado === 'ok' ? 'Mandar otro' : 'Mándame un correo de prueba'}
                    </button>
                  </div>
                )}
              </div>

              <ul className="as-chips">
                {PREGUNTAS.map((q) =>
                  preferencias[q.id] ? (
                    <li key={q.id} className="as-chip as-chip--verde">
                      <Check size={13} strokeWidth={3} aria-hidden="true" />
                      {q.activo}
                      {q.id === 'maneja_caducidad' && <> · aviso {preferencias.dias_aviso_caducidad} días antes</>}
                      {q.id === 'alertas_activas' && (
                        <>
                          {' '}a <strong>{correoDeAvisos(preferencias, propietario)}</strong> · revisión{' '}
                          {textoHora(preferencias.hora_resumen)}
                        </>
                      )}
                    </li>
                  ) : (
                    <li key={q.id} className="as-chip as-chip--gris">
                      <span className="as-chip__punto" aria-hidden="true" />
                      {q.activo} desactivado
                    </li>
                  )
                )}
              </ul>
            </div>

            <div className="as-opciones">
              <article className="as-opcion as-opcion--recomendada">
                <span className="as-opcion__etiqueta">Recomendado</span>
                <span className="as-opcion__icono" aria-hidden="true">
                  <Plus size={18} />
                </span>
                <h2 className="as-opcion__titulo">Agregar mis productos ahora</h2>
                <p className="as-opcion__texto">
                  Empieza con tus dulces más vendidos para poder cobrar hoy mismo y ver tu ganancia en vivo.
                </p>
                <button type="button" className="as-boton as-boton--primario" onClick={() => navigate('/catalogo/nuevo')}>
                  <Plus size={16} aria-hidden="true" />
                  Registrar primer producto
                </button>
              </article>

              <article className="as-opcion">
                <span className="as-opcion__icono as-opcion__icono--gris" aria-hidden="true">
                  <LayoutGrid size={18} />
                </span>
                <h2 className="as-opcion__titulo">Lo hago después</h2>
                <p className="as-opcion__texto">Conoce el panel y explora la aplicación. Puedes agregar productos cuando quieras.</p>
                <button type="button" className="as-boton as-boton--secundario" onClick={() => navigate('/panel')}>
                  Ir al panel principal
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </article>
            </div>

            <p className="as-recuerda">
              <Lock size={14} aria-hidden="true" />
              <span>
                <strong>Recuerda:</strong> puedes dar de alta a tus encargados y cambiar cualquier preferencia en{' '}
                <strong>Configuración</strong> cuando quieras.
              </span>
            </p>
            </>
            )}
          </section>
        )}

        {/* ---------- Botones ---------- */}
        {paso < 4 && (
          <footer className="as-acciones">
            {paso > 1 ? (
              <button type="button" className="as-boton as-boton--secundario" onClick={() => irA(paso - 1)} disabled={guardando}>
                <ArrowLeft size={16} aria-hidden="true" />
                Atrás
              </button>
            ) : (
              <span />
            )}

            <button type="button" className="as-boton as-boton--primario" onClick={continuar} disabled={guardando}>
              {guardando ? (
                <>
                  <Loader2 size={16} className="as-girando" aria-hidden="true" />
                  Configurando tu dulcería…
                </>
              ) : (
                <>
                  {paso === 3 ? 'Terminar configuración' : 'Continuar'}
                  <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </footer>
        )}
      </main>

      {restaurando && (
        <RestaurarInicial onCerrar={() => setRestaurando(false)} onListo={() => navigate('/', { replace: true })} />
      )}

      <p className="as-pie">
        <ShieldCheck size={14} aria-hidden="true" />
        Tus datos se guardan en esta computadora · Solo tú y tus encargados pueden verlos
      </p>
    </div>
  )
}
