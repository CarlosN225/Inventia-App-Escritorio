
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Store,
  SlidersHorizontal,
  Users,
  MessageCircle,
  Lock,
  CalendarDays,
  Boxes,
  Tag,
  Barcode,
  Bell,
  Info,
  RotateCcw,
  Save,
  UserPlus,
  KeyRound,
  Check,
  X,
  CheckCircle2,
  AlertCircle,
  Send,
  Clock,
  ShieldCheck,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react'

import ConfirmDialog from '../components/ConfirmDialog.jsx'
import {
  getUsuarioActual,
  listarUsuarios,
  registrarUsuario,
  cambiarEstadoUsuario,
  restablecerContrasena,
} from '../services/auth'
import '../styles/configuracion.css'

/* ============================================================
   ESTADO INICIAL
   ============================================================ */

const AJUSTES_INICIALES = {
  negocio: {
    nombre: '',
    direccion: '',
    telefono: '',
  },
  preferencias: {
    maneja_caducidad: true,
    vende_mayoreo: false,
    maneja_promociones: false,
    usa_codigo_barras: false,
    alertas_activas: false,
  },
  whatsapp: {
    numero: '',
    hora: '20:00',
    diasCaducidad: 30,
  },
}

const USUARIOS_INICIALES = []

const SECCIONES = [
  {
    id: 'negocio',
    titulo: 'Negocio',
    sub: 'Nombre y datos de contacto',
    icono: Store,
  },
  {
    id: 'preferencias',
    titulo: 'Preferencias del negocio',
    sub: 'Qué funciones usas',
    icono: SlidersHorizontal,
  },
  {
    id: 'usuarios',
    titulo: 'Usuarios',
    sub: 'Encargados y permisos',
    icono: Users,
  },
  {
    id: 'whatsapp',
    titulo: 'WhatsApp y alertas',
    sub: 'Número y horario',
    icono: MessageCircle,
  },
]

const PREFERENCIAS = [
  {
    id: 'maneja_caducidad',
    titulo: 'Fecha de caducidad',
    desc: (dias) =>
      `Muestra la caducidad en productos y compras, y te avisa ${dias} días antes.`,
    icono: CalendarDays,
    etiqueta: {
      texto: 'Recomendado',
      clase: 'azul',
    },
  },
  {
    id: 'vende_mayoreo',
    titulo: 'Venta a mayoreo',
    desc: () =>
      'Permite un precio especial a partir de cierta cantidad de piezas.',
    icono: Boxes,
  },
  {
    id: 'maneja_promociones',
    titulo: 'Promociones',
    desc: () =>
      'Descuentos por porcentaje o monto, con fecha de inicio y fin.',
    icono: Tag,
  },
  {
    id: 'usa_codigo_barras',
    titulo: 'Código de barras',
    desc: () =>
      'Muestra el campo para escanear productos con un lector.',
    icono: Barcode,
    etiqueta: {
      texto: 'La mayoría de las dulcerías no lo usa',
      clase: 'gris',
    },
  },
  {
    id: 'alertas_activas',
    titulo: 'Alertas por WhatsApp',
    desc: () =>
      'Un resumen diario con lo que se acaba y lo que está por caducar.',
    icono: Bell,
  },
]

const HORAS = [
  { valor: '18:00', texto: '6:00 p.m.' },
  { valor: '19:00', texto: '7:00 p.m.' },
  { valor: '20:00', texto: '8:00 p.m.' },
  { valor: '21:00', texto: '9:00 p.m.' },
  { valor: '22:00', texto: '10:00 p.m.' },
]

const PERMISOS = [
  {
    funcion: 'Registrar ventas',
    propietario: true,
    encargado: true,
  },
  {
    funcion: 'Registrar compras',
    propietario: true,
    encargado: true,
  },
  {
    funcion: 'Registrar mermas',
    propietario: true,
    encargado: true,
  },
  {
    funcion: 'Consultar catálogo e historial',
    propietario: true,
    encargado: true,
  },
  {
    funcion: 'Dar de alta productos y cambiar precios',
    propietario: true,
    encargado: false,
  },
  {
    funcion: 'Corregir inventario',
    propietario: true,
    encargado: false,
  },
  {
    funcion: 'Ver ganancias',
    propietario: true,
    encargado: false,
  },
  {
    funcion: 'Configuración y usuarios',
    propietario: true,
    encargado: false,
  },
]

/* ============ Utilidades ============ */

function soloDigitos(texto) {
  return texto.replace(/\D/g, '')
}

function iniciales(nombre) {
  const partes = (nombre ?? '').trim().split(/\s+/)
  const primera = partes[0]?.[0] ?? ''
  const ultima =
    partes.length > 1 ? partes[partes.length - 1][0] : ''

  return (primera + ultima).toUpperCase() || '?'
}

function horaActual() {
  return new Date().toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function generarContrasena() {
  const caracteres =
    'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

  return Array.from(
    { length: 8 },
    () =>
      caracteres[Math.floor(Math.random() * caracteres.length)]
  ).join('')
}

function correoValido(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
}

function Interruptor({
  encendido,
  onCambiar,
  etiqueta,
  deshabilitado,
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={encendido}
      aria-label={etiqueta}
      disabled={deshabilitado}
      className={'cf-switch' + (encendido ? ' is-on' : '')}
      onClick={onCambiar}
    />
  )
}

/* ============ Pantalla ============ */

export default function Configuracion() {
  console.log('CONFIGURACION.JSX SE ESTA EJECUTANDO')
  const navigate = useNavigate()

  const [usuarioActual, setUsuarioActual] = useState(null)
  const [cargando, setCargando] = useState(true)

  const [seccion, setSeccion] = useState('preferencias')

  const [ajustes, setAjustes] = useState(AJUSTES_INICIALES)
  const [guardados, setGuardados] = useState(AJUSTES_INICIALES)

  const [ultimoGuardado, setUltimoGuardado] = useState(null)
  const [aviso, setAviso] = useState(null)

  const [usuarios, setUsuarios] = useState(USUARIOS_INICIALES)

  const [nuevo, setNuevo] = useState(null)
  const [intentoNuevo, setIntentoNuevo] = useState(false)

  const [restablecer, setRestablecer] = useState(null)

  const [enLinea, setEnLinea] = useState(navigator.onLine)

  /* ---------- Usuario actual ---------- */

  useEffect(() => {
    getUsuarioActual()
      .then(setUsuarioActual)
      .catch(() => setUsuarioActual(null))
      .finally(() => setCargando(false))
  }, [])

  /* ---------- Cargar usuarios desde backend ---------- */

  useEffect(() => {
  console.log('SECCION:', seccion)
  console.log('USUARIO ACTUAL:', usuarioActual)
  console.log('ROL:', usuarioActual?.rol)

  if (
    seccion !== 'usuarios' ||
    usuarioActual?.rol !== 'propietario'
  ) {
    return
  }

  console.log('CARGANDO USUARIOS...')

  listarUsuarios()
    .then((data) => {
      console.log('USUARIOS RECIBIDOS:', data)

      const usuariosFormateados = data.map((u) => ({
        id: u.id,
        nombre: u.nombre_completo,
        correo: u.correo,
        rol: u.rol,
        activo: u.activo,
      }))

      setUsuarios(usuariosFormateados)
    })
    .catch((error) => {
      console.error(
        'ERROR AL CARGAR USUARIOS:',
        error
      )

      setAviso({
        texto: 'No se pudieron cargar los usuarios',
      })
    })
}, [seccion, usuarioActual])
  /* ---------- Estado de conexión ---------- */

  useEffect(() => {
    const conectado = () => setEnLinea(true)
    const desconectado = () => setEnLinea(false)

    window.addEventListener('online', conectado)
    window.addEventListener('offline', desconectado)

    return () => {
      window.removeEventListener('online', conectado)
      window.removeEventListener('offline', desconectado)
    }
  }, [])

  /* ---------- Ajustes ---------- */

  function cambiar(grupo, campo, valor) {
    setAjustes((a) => ({
      ...a,
      [grupo]: {
        ...a[grupo],
        [campo]: valor,
      },
    }))
  }

  const hayCambios =
    JSON.stringify(ajustes) !== JSON.stringify(guardados)

  const errores = {}

  if (!ajustes.negocio.nombre.trim()) {
    errores.nombre = 'Escribe el nombre de tu negocio'
  }

  if (
    ajustes.negocio.telefono &&
    soloDigitos(ajustes.negocio.telefono).length !== 10
  ) {
    errores.telefono = 'Deben ser 10 dígitos'
  }

  if (
    ajustes.preferencias.alertas_activas &&
    soloDigitos(ajustes.whatsapp.numero).length !== 10
  ) {
    errores.numero = 'Escribe un WhatsApp de 10 dígitos'
  }

  const hayErrores = Object.keys(errores).length > 0

  function guardar() {
    if (hayErrores) return

    // TODO: mandar los ajustes al backend
    setGuardados(ajustes)

    setUltimoGuardado({
      hora: horaActual(),
      nombre: usuarioActual?.nombre_completo ?? '',
    })

    setAviso({
      texto: 'Cambios guardados',
    })
  }

  function restablecerCambios() {
    setAjustes(guardados)
  }

  const activas = Object.values(
    ajustes.preferencias
  ).filter(Boolean).length

  /* ---------- Usuarios ---------- */

  function abrirNuevo() {
    setNuevo({
      nombre: '',
      correo: '',
      contrasena: generarContrasena(),
    })

    setIntentoNuevo(false)
  }

  const erroresNuevo = {}

  if (nuevo) {
    if (!nuevo.nombre.trim()) {
      erroresNuevo.nombre = 'Escribe su nombre'
    }

    if (!correoValido(nuevo.correo.trim())) {
      erroresNuevo.correo = 'Escribe un correo válido'
    } else if (
      usuarios.some(
        (u) =>
          u.correo ===
          nuevo.correo.trim().toLowerCase()
      )
    ) {
      erroresNuevo.correo =
        'Ese correo ya está registrado'
    }

    if (nuevo.contrasena.length < 6) {
      erroresNuevo.contrasena =
        'Mínimo 6 caracteres'
    }
  }

  async function agregarEncargado() {
    setIntentoNuevo(true)

    if (Object.keys(erroresNuevo).length > 0) {
      return
    }

    const correo =
      nuevo.correo.trim().toLowerCase()

    try {
      const data = await registrarUsuario({
        nombre_completo: nuevo.nombre.trim(),
        correo: correo,
        contrasena: nuevo.contrasena,
        telefono_whatsapp: '',
      })

      setUsuarios((lista) => [
        ...lista,
        {
          id: data.id,
          nombre: data.nombre_completo,
          correo: data.correo,
          rol: data.rol,
          activo: data.activo,
        },
      ])

      setAviso({
        texto: `${nuevo.nombre.trim()} ya puede entrar con ${correo} y la contraseña`,
        codigo: nuevo.contrasena,
      })

      setNuevo(null)
    } catch (error) {
      console.error(
        'Error al registrar usuario:',
        error
      )

      const mensaje =
        error.response?.data?.correo?.[0] ||
        error.response?.data?.detail ||
        'No se pudo registrar el usuario'

      setAviso({
        texto: mensaje,
      })
    }
  }

  async function alternarActivo(usuario) {
    try {
      const data = await cambiarEstadoUsuario(
        usuario.id,
        !usuario.activo
      )

      const usuarioActualizado =
        data.usuario

      setUsuarios((lista) =>
        lista.map((u) =>
          u.id === usuario.id
            ? {
                ...u,
                nombre:
                  usuarioActualizado.nombre_completo,
                correo:
                  usuarioActualizado.correo,
                rol:
                  usuarioActualizado.rol,
                activo:
                  usuarioActualizado.activo,
              }
            : u
        )
      )

      setAviso({
        texto: usuario.activo
          ? `${usuario.nombre} ya no podrá entrar a INVENTIA`
          : `${usuario.nombre} puede volver a entrar a INVENTIA`,
      })
    } catch (error) {
      console.error(
        'Error al cambiar estado:',
        error
      )

      setAviso({
        texto:
          'No se pudo cambiar el estado del usuario',
      })
    }
  }

  async function confirmarRestablecer() {
    if (!restablecer) return

    try {
      const data =
        await restablecerContrasena(
          restablecer.id
        )

      setAviso({
        texto: `Contraseña temporal de ${restablecer.nombre}:`,
        codigo: data.contrasena_temporal,
      })

      setRestablecer(null)
    } catch (error) {
      console.error(
        'Error al restablecer contraseña:',
        error
      )

      setAviso({
        texto:
          'No se pudo restablecer la contraseña',
      })
    }
  }

  /* ---------- Sin permiso ---------- */

  if (cargando) return null

  if (usuarioActual?.rol !== 'propietario') {
    return (
      <div className="cf">
        <div className="cf-panel cf-bloqueado">
          <span
            className="cf-bloqueado__icono"
            aria-hidden="true"
          >
            <Lock size={26} />
          </span>

          <h1>
            Solo el propietario puede cambiar la
            configuración
          </h1>

          <p>
            Si necesitas cambiar algo del negocio o
            de tu usuario, pídeselo al dueño.
          </p>

          <button
            type="button"
            className="cf-boton"
            onClick={() => navigate('/panel')}
          >
            <ArrowLeft
              size={16}
              aria-hidden="true"
            />
            Volver al panel
          </button>
        </div>
      </div>
    )
  }

  const correoActual = usuarioActual?.correo

  return (
    <div className="cf">
      {/* ============ ENCABEZADO ============ */}

      <header>
        <div className="cf-encabezado__fila">
          <h1 className="cf-titulo">
            Configuración
          </h1>

          <span className="cf-propietario">
            <Lock
              size={13}
              aria-hidden="true"
            />
            Solo propietario
          </span>
        </div>

        <p className="cf-subtitulo">
          Ajusta INVENTIA a la forma en que trabaja tu
          negocio
        </p>
      </header>

      {aviso && (
        <div
          className="cf-aviso"
          role="status"
        >
          <CheckCircle2
            size={18}
            aria-hidden="true"
          />

          <span>
            {aviso.texto}{' '}
            {aviso.codigo && (
              <code>{aviso.codigo}</code>
            )}
          </span>

          <button
            type="button"
            aria-label="Cerrar aviso"
            onClick={() => setAviso(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}

      <div className="cf-grid">
        {/* ============ MENÚ DE SECCIONES ============ */}

        <nav
          className="cf-menu"
          aria-label="Secciones de configuración"
        >
          {SECCIONES.map((s) => {
            const Icono = s.icono

            const badge =
              s.id === 'preferencias'
                ? `${activas} de 5`
                : s.id === 'usuarios'
                ? usuarios.length
                : null

            return (
              <button
                key={s.id}
                type="button"
                className={
                  'cf-menu__item' +
                  (seccion === s.id
                    ? ' is-activo'
                    : '')
                }
                onClick={() =>
                  setSeccion(s.id)
                }
                aria-current={
                  seccion === s.id
                    ? 'page'
                    : undefined
                }
              >
                <span
                  className="cf-menu__icono"
                  aria-hidden="true"
                >
                  <Icono size={17} />
                </span>

                <span className="cf-menu__textos">
                  <span className="cf-menu__titulo">
                    {s.titulo}
                  </span>

                  <span className="cf-menu__sub">
                    {s.sub}
                  </span>
                </span>

                {badge !== null && (
                  <span className="cf-menu__badge">
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="cf-seccion">
          {/* ============ NEGOCIO ============ */}

          {seccion === 'negocio' && (
            <section className="cf-panel cf-seccion">
              <header>
                <h2 className="cf-seccion__titulo">
                  Negocio
                </h2>

                <p className="cf-seccion__sub">
                  Así aparece tu negocio en el inicio de
                  sesión y en los mensajes.
                </p>
              </header>

              <div className="cf-campos">
                <div className="cf-campo cf-campo--ancho">
                  <label
                    className="cf-etiqueta"
                    htmlFor="cf-nombre"
                  >
                    Nombre del negocio{' '}
                    <span className="cf-requerido">
                      *
                    </span>
                  </label>

                  <input
                    id="cf-nombre"
                    className={
                      'cf-input' +
                      (errores.nombre
                        ? ' is-error'
                        : '')
                    }
                    value={ajustes.negocio.nombre}
                    onChange={(e) =>
                      cambiar(
                        'negocio',
                        'nombre',
                        e.target.value
                      )
                    }
                    placeholder="Ej. Dulcería Los Querubines"
                  />

                  {errores.nombre && (
                    <p className="cf-error">
                      <AlertCircle
                        size={13}
                        aria-hidden="true"
                      />
                      {errores.nombre}
                    </p>
                  )}
                </div>

                <div className="cf-campo">
                  <label
                    className="cf-etiqueta"
                    htmlFor="cf-direccion"
                  >
                    Dirección
                  </label>

                  <input
                    id="cf-direccion"
                    className="cf-input"
                    value={
                      ajustes.negocio.direccion
                    }
                    onChange={(e) =>
                      cambiar(
                        'negocio',
                        'direccion',
                        e.target.value
                      )
                    }
                    placeholder="Calle, número y colonia"
                  />
                </div>

                <div className="cf-campo">
                  <label
                    className="cf-etiqueta"
                    htmlFor="cf-telefono"
                  >
                    Teléfono del negocio
                  </label>

                  <input
                    id="cf-telefono"
                    inputMode="tel"
                    className={
                      'cf-input' +
                      (errores.telefono
                        ? ' is-error'
                        : '')
                    }
                    value={
                      ajustes.negocio.telefono
                    }
                    onChange={(e) =>
                      cambiar(
                        'negocio',
                        'telefono',
                        e.target.value
                      )
                    }
                    placeholder="10 dígitos"
                  />

                  {errores.telefono ? (
                    <p className="cf-error">
                      <AlertCircle
                        size={13}
                        aria-hidden="true"
                      />
                      {errores.telefono}
                    </p>
                  ) : (
                    <p className="cf-ayuda">
                      Opcional
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ============ PREFERENCIAS ============ */}

          {seccion === 'preferencias' && (
            <section className="cf-panel cf-seccion">
              <header className="cf-seccion__cabecera">
                <div>
                  <h2 className="cf-seccion__titulo">
                    Preferencias del negocio
                  </h2>

                  <p className="cf-seccion__sub">
                    Activa solo lo que usas. Puedes
                    cambiarlo cuando quieras.
                  </p>
                </div>

                <span className="cf-contador">
                  <Check
                    size={13}
                    aria-hidden="true"
                  />
                  {activas} de 5 activas
                </span>
              </header>

              <p className="cf-info">
                <Info
                  size={16}
                  aria-hidden="true"
                />

                <span>
                  Lo que apagues se esconde de las
                  pantallas para que todo se vea más
                  sencillo.{' '}
                  <strong>
                    No se borra ningún dato:
                  </strong>{' '}
                  si lo vuelves a prender, todo sigue
                  ahí.
                </span>
              </p>

              <ul className="cf-prefs">
                {PREFERENCIAS.map((p) => {
                  const Icono = p.icono
                  const encendido =
                    ajustes.preferencias[p.id]

                  return (
                    <li
                      key={p.id}
                      className={
                        'cf-pref' +
                        (encendido
                          ? ' is-on'
                          : '')
                      }
                    >
                      <span
                        className="cf-pref__icono"
                        aria-hidden="true"
                      >
                        <Icono size={19} />
                      </span>

                      <div className="cf-pref__textos">
                        <p className="cf-pref__titulo">
                          {p.titulo}

                          {p.etiqueta && (
                            <span
                              className={`cf-etiqueta-chip cf-etiqueta-chip--${p.etiqueta.clase}`}
                            >
                              {p.etiqueta.texto}
                            </span>
                          )}
                        </p>

                        <p className="cf-pref__desc">
                          {p.desc(
                            ajustes.whatsapp
                              .diasCaducidad
                          )}
                        </p>
                      </div>

                      <Interruptor
                        encendido={encendido}
                        etiqueta={p.titulo}
                        onCambiar={() =>
                          cambiar(
                            'preferencias',
                            p.id,
                            !encendido
                          )
                        }
                      />
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {/* ============ USUARIOS ============ */}

          {seccion === 'usuarios' && (
            <>
              <section className="cf-panel cf-seccion">
                <header className="cf-seccion__cabecera">
                  <div>
                    <h2 className="cf-seccion__titulo">
                      Usuarios
                    </h2>

                    <p className="cf-seccion__sub">
                      Cada quien entra con su propia
                      contraseña. Así el historial siempre
                      dice quién hizo cada cosa.
                    </p>
                  </div>

                  {!nuevo && (
                    <button
                      type="button"
                      className="cf-boton cf-boton--primario"
                      onClick={abrirNuevo}
                    >
                      <UserPlus
                        size={16}
                        aria-hidden="true"
                      />
                      Agregar encargado
                    </button>
                  )}
                </header>

                {nuevo && (
                  <div className="cf-nuevo">
                    <p className="cf-nuevo__titulo">
                      <UserPlus
                        size={17}
                        aria-hidden="true"
                      />
                      Nuevo encargado
                    </p>

                    <div className="cf-campos">
                      <div className="cf-campo">
                        <label
                          className="cf-etiqueta"
                          htmlFor="cf-nuevo-nombre"
                        >
                          Nombre completo{' '}
                          <span className="cf-requerido">
                            *
                          </span>
                        </label>

                        <input
                          id="cf-nuevo-nombre"
                          autoFocus
                          className={
                            'cf-input' +
                            (intentoNuevo &&
                            erroresNuevo.nombre
                              ? ' is-error'
                              : '')
                          }
                          value={nuevo.nombre}
                          onChange={(e) =>
                            setNuevo({
                              ...nuevo,
                              nombre:
                                e.target.value,
                            })
                          }
                          placeholder="Ej. Kenia Ramírez"
                        />

                        {intentoNuevo &&
                          erroresNuevo.nombre && (
                            <p className="cf-error">
                              <AlertCircle
                                size={13}
                                aria-hidden="true"
                              />
                              {
                                erroresNuevo.nombre
                              }
                            </p>
                          )}
                      </div>

                      <div className="cf-campo">
                        <label
                          className="cf-etiqueta"
                          htmlFor="cf-nuevo-correo"
                        >
                          Correo{' '}
                          <span className="cf-requerido">
                            *
                          </span>
                        </label>

                        <input
                          id="cf-nuevo-correo"
                          type="email"
                          className={
                            'cf-input' +
                            (intentoNuevo &&
                            erroresNuevo.correo
                              ? ' is-error'
                              : '')
                          }
                          value={nuevo.correo}
                          onChange={(e) =>
                            setNuevo({
                              ...nuevo,
                              correo:
                                e.target.value,
                            })
                          }
                          placeholder="nombre@negocio.com"
                        />

                        {intentoNuevo &&
                        erroresNuevo.correo ? (
                          <p className="cf-error">
                            <AlertCircle
                              size={13}
                              aria-hidden="true"
                            />
                            {
                              erroresNuevo.correo
                            }
                          </p>
                        ) : (
                          <p className="cf-ayuda">
                            Con este correo va a iniciar
                            sesión
                          </p>
                        )}
                      </div>

                      <div className="cf-campo cf-campo--ancho">
                        <label
                          className="cf-etiqueta"
                          htmlFor="cf-nuevo-contrasena"
                        >
                          Contraseña temporal{' '}
                          <span className="cf-requerido">
                            *
                          </span>
                        </label>

                        <div className="cf-input-grupo">
                          <input
                            id="cf-nuevo-contrasena"
                            className={
                              'cf-input' +
                              (intentoNuevo &&
                              erroresNuevo.contrasena
                                ? ' is-error'
                                : '')
                            }
                            value={
                              nuevo.contrasena
                            }
                            onChange={(e) =>
                              setNuevo({
                                ...nuevo,
                                contrasena:
                                  e.target.value,
                              })
                            }
                          />

                          <button
                            type="button"
                            className="cf-boton"
                            onClick={() =>
                              setNuevo({
                                ...nuevo,
                                contrasena:
                                  generarContrasena(),
                              })
                            }
                          >
                            <RefreshCw
                              size={14}
                              aria-hidden="true"
                            />
                            Generar otra
                          </button>
                        </div>

                        {intentoNuevo &&
                        erroresNuevo.contrasena ? (
                          <p className="cf-error">
                            <AlertCircle
                              size={13}
                              aria-hidden="true"
                            />
                            {
                              erroresNuevo.contrasena
                            }
                          </p>
                        ) : (
                          <p className="cf-ayuda">
                            Compártesela en persona. Podrá
                            cambiarla después.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="cf-nuevo__botones">
                      <button
                        type="button"
                        className="cf-boton"
                        onClick={() =>
                          setNuevo(null)
                        }
                      >
                        Cancelar
                      </button>

                      <button
                        type="button"
                        className="cf-boton cf-boton--primario"
                        onClick={
                          agregarEncargado
                        }
                      >
                        <Check
                          size={16}
                          aria-hidden="true"
                        />
                        Agregar
                      </button>
                    </div>
                  </div>
                )}

                {usuarios.length === 0 ? (
                  <div className="cf-vacio-usuarios">
                    <span
                      className="cf-vacio-usuarios__icono"
                      aria-hidden="true"
                    >
                      <Users size={22} />
                    </span>

                    <p className="cf-vacio-usuarios__titulo">
                      Aún no hay usuarios registrados
                    </p>

                    <p className="cf-vacio-usuarios__texto">
                      Agrega encargados para que cada
                      quien registre sus movimientos con su
                      propio usuario.
                    </p>
                  </div>
                ) : (
                  <div className="cf-tabla-contenedor">
                    <table className="cf-tabla">
                      <thead>
                        <tr>
                          <th>Usuario</th>
                          <th>Rol</th>
                          <th>Estado</th>
                          <th className="is-centro">
                            Acceso
                          </th>
                          <th aria-label="Acciones" />
                        </tr>
                      </thead>

                      <tbody>
                        {usuarios.map((u) => {
                          const esPropietario =
                            u.rol === 'propietario'

                          const esYo =
                            u.correo === correoActual

                          return (
                            <tr key={u.id}>
                              <td>
                                <div
                                  className={
                                    'cf-usuario' +
                                    (u.activo
                                      ? ''
                                      : ' is-inactivo')
                                  }
                                >
                                  <span
                                    className="cf-avatar"
                                    aria-hidden="true"
                                  >
                                    {iniciales(
                                      u.nombre
                                    )}
                                  </span>

                                  <div>
                                    <p className="cf-usuario__nombre">
                                      {u.nombre}

                                      {esYo && (
                                        <span className="cf-tu">
                                          Tú
                                        </span>
                                      )}
                                    </p>

                                    <p className="cf-usuario__correo">
                                      {u.correo}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td>
                                <span
                                  className={`cf-rol cf-rol--${u.rol}`}
                                >
                                  {esPropietario && (
                                    <ShieldCheck
                                      size={12}
                                      aria-hidden="true"
                                    />
                                  )}

                                  {esPropietario
                                    ? 'Propietario'
                                    : 'Encargado'}
                                </span>
                              </td>

                              <td>
                                <span
                                  className={
                                    'cf-estado ' +
                                    (u.activo
                                      ? 'cf-estado--activo'
                                      : 'cf-estado--inactivo')
                                  }
                                >
                                  {u.activo
                                    ? 'Activo'
                                    : 'Inactivo'}
                                </span>
                              </td>

                              <td className="is-centro">
                                <Interruptor
                                  encendido={
                                    u.activo
                                  }
                                  etiqueta={`Acceso de ${u.nombre}`}
                                  deshabilitado={
                                    esPropietario
                                  }
                                  onCambiar={() =>
                                    alternarActivo(
                                      u
                                    )
                                  }
                                />
                              </td>

                              <td>
                                <div className="cf-acciones">
                                  {!esPropietario && (
                                    <button
                                      type="button"
                                      className="cf-boton cf-boton--chico"
                                      onClick={() =>
                                        setRestablecer(
                                          u
                                        )
                                      }
                                    >
                                      <KeyRound
                                        size={13}
                                        aria-hidden="true"
                                      />
                                      Restablecer
                                      contraseña
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="cf-panel">
                <h3 className="cf-permisos__titulo">
                  <ShieldCheck
                    size={17}
                    aria-hidden="true"
                  />
                  Qué puede hacer cada rol
                </h3>

                <div className="cf-tabla-contenedor">
                  <table className="cf-tabla">
                    <thead>
                      <tr>
                        <th>Función</th>
                        <th className="is-centro">
                          Propietario
                        </th>
                        <th className="is-centro">
                          Encargado
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {PERMISOS.map((p) => (
                        <tr key={p.funcion}>
                          <td>{p.funcion}</td>

                          {[
                            'propietario',
                            'encargado',
                          ].map((rol) => (
                            <td
                              key={rol}
                              className="is-centro"
                            >
                              {p[rol] ? (
                                <span
                                  className="cf-si"
                                  aria-label="Sí"
                                >
                                  <Check
                                    size={13}
                                    strokeWidth={3}
                                  />
                                </span>
                              ) : (
                                <span
                                  className="cf-no"
                                  aria-label="No"
                                >
                                  <X
                                    size={13}
                                    strokeWidth={3}
                                  />
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* ============ WHATSAPP ============ */}

          {seccion === 'whatsapp' && (
            <section className="cf-panel cf-seccion">
              <header className="cf-seccion__cabecera">
                <div>
                  <h2 className="cf-seccion__titulo">
                    WhatsApp y alertas
                  </h2>

                  <p className="cf-seccion__sub">
                    Un solo mensaje al día con lo que se
                    acaba y lo que caduca.
                  </p>
                </div>

                <Interruptor
                  encendido={
                    ajustes.preferencias
                      .alertas_activas
                  }
                  etiqueta="Alertas por WhatsApp"
                  onCambiar={() =>
                    cambiar(
                      'preferencias',
                      'alertas_activas',
                      !ajustes.preferencias
                        .alertas_activas
                    )
                  }
                />
              </header>

              {!ajustes.preferencias
                .alertas_activas && (
                <p className="cf-info">
                  <Info
                    size={16}
                    aria-hidden="true"
                  />

                  <span>
                    Las alertas están apagadas. Préndelas
                    con el interruptor de arriba para
                    recibir el resumen.
                  </span>
                </p>
              )}

              <div className="cf-campos">
                <div className="cf-campo">
                  <label
                    className="cf-etiqueta"
                    htmlFor="cf-whatsapp"
                  >
                    Número de WhatsApp{' '}
                    <span className="cf-requerido">
                      *
                    </span>
                  </label>

                  <input
                    id="cf-whatsapp"
                    inputMode="tel"
                    className={
                      'cf-input' +
                      (errores.numero
                        ? ' is-error'
                        : '')
                    }
                    value={
                      ajustes.whatsapp.numero
                    }
                    disabled={
                      !ajustes.preferencias
                        .alertas_activas
                    }
                    onChange={(e) =>
                      cambiar(
                        'whatsapp',
                        'numero',
                        e.target.value
                      )
                    }
                    placeholder="10 dígitos"
                  />

                  {errores.numero ? (
                    <p className="cf-error">
                      <AlertCircle
                        size={13}
                        aria-hidden="true"
                      />
                      {errores.numero}
                    </p>
                  ) : (
                    <p className="cf-ayuda">
                      Normalmente el del dueño
                    </p>
                  )}
                </div>

                <div className="cf-campo">
                  <label
                    className="cf-etiqueta"
                    htmlFor="cf-hora"
                  >
                    Hora del resumen
                  </label>

                  <select
                    id="cf-hora"
                    className="cf-input"
                    value={
                      ajustes.whatsapp.hora
                    }
                    disabled={
                      !ajustes.preferencias
                        .alertas_activas
                    }
                    onChange={(e) =>
                      cambiar(
                        'whatsapp',
                        'hora',
                        e.target.value
                      )
                    }
                  >
                    {HORAS.map((h) => (
                      <option
                        key={h.valor}
                        value={h.valor}
                      >
                        {h.texto}
                      </option>
                    ))}
                  </select>

                  <p className="cf-ayuda">
                    Recomendado: al cerrar, para planear el
                    surtido del día siguiente
                  </p>
                </div>

                <div className="cf-campo">
                  <label
                    className="cf-etiqueta"
                    htmlFor="cf-dias"
                  >
                    Avisar de caducidad con
                  </label>

                  <select
                    id="cf-dias"
                    className="cf-input"
                    value={
                      ajustes.whatsapp
                        .diasCaducidad
                    }
                    disabled={
                      !ajustes.preferencias
                        .maneja_caducidad
                    }
                    onChange={(e) =>
                      cambiar(
                        'whatsapp',
                        'diasCaducidad',
                        Number(e.target.value)
                      )
                    }
                  >
                    {[15, 30, 45, 60].map(
                      (d) => (
                        <option
                          key={d}
                          value={d}
                        >
                          {d} días de anticipación
                        </option>
                      )
                    )}
                  </select>

                  {!ajustes.preferencias
                    .maneja_caducidad && (
                    <p className="cf-ayuda">
                      Activa "Fecha de caducidad" en
                      Preferencias para usarlo
                    </p>
                  )}
                </div>

                <div className="cf-campo">
                  <span className="cf-etiqueta">
                    Probar
                  </span>

                  <button
                    type="button"
                    className="cf-boton"
                    disabled={
                      !enLinea ||
                      !ajustes.preferencias
                        .alertas_activas ||
                      !!errores.numero
                    }
                    onClick={() =>
                      setAviso({
                        texto: `Mensaje de prueba enviado al ${ajustes.whatsapp.numero}`,
                      })
                    }
                  >
                    <Send
                      size={14}
                      aria-hidden="true"
                    />
                    Enviar mensaje de prueba
                  </button>

                  <p className="cf-ayuda">
                    {enLinea
                      ? 'Revisa que te llegue al WhatsApp'
                      : 'Necesitas internet para enviarlo'}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* ============ BARRA DE GUARDAR ============ */}

          {seccion !== 'usuarios' && (
            <footer className="cf-barra">
              {hayCambios ? (
                <span className="cf-barra__estado is-pendiente">
                  <AlertCircle
                    size={15}
                    aria-hidden="true"
                  />
                  Tienes cambios sin guardar
                </span>
              ) : ultimoGuardado ? (
                <span className="cf-barra__estado">
                  <Clock
                    size={15}
                    aria-hidden="true"
                  />
                  Último cambio guardado: hoy a las{' '}
                  <strong>
                    {ultimoGuardado.hora}
                  </strong>{' '}
                  por{' '}
                  <strong>
                    {ultimoGuardado.nombre}
                  </strong>
                </span>
              ) : (
                <span className="cf-barra__estado">
                  <Info
                    size={15}
                    aria-hidden="true"
                  />
                  Ajusta lo que necesites y guarda los
                  cambios
                </span>
              )}

              <div className="cf-barra__botones">
                <button
                  type="button"
                  className="cf-boton"
                  disabled={!hayCambios}
                  onClick={
                    restablecerCambios
                  }
                >
                  <RotateCcw
                    size={15}
                    aria-hidden="true"
                  />
                  Restablecer
                </button>

                <button
                  type="button"
                  className="cf-boton cf-boton--primario"
                  disabled={
                    !hayCambios || hayErrores
                  }
                  onClick={guardar}
                >
                  <Save
                    size={15}
                    aria-hidden="true"
                  />
                  Guardar cambios
                </button>
              </div>
            </footer>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={restablecer !== null}
        title="¿Restablecer la contraseña?"
        message={
          restablecer
            ? `Se generará una contraseña temporal para ${restablecer.nombre}. Su contraseña actual dejará de funcionar.`
            : ''
        }
        confirmText="Sí, restablecer"
        cancelText="Cancelar"
        tone="danger"
        onConfirm={
          confirmarRestablecer
        }
        onCancel={() =>
          setRestablecer(null)
        }
      />
    </div>
  )
}
