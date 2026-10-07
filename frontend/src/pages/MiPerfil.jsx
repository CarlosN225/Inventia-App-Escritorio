import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Check,
  X,
  CheckCircle2,
  AlertCircle,
  Save,
  History,
  ArrowUpRight,
  Lock,
  Loader2,
} from 'lucide-react'

import { getUsuarioActual, actualizarMiPerfil, cambiarMiContrasena } from '../services/auth'
import { listarProductos, mensajeDeError } from '../services/productos'
import { listarMovimientos } from '../services/movimientos'
import { textoUnidad } from '../utils/unidades'
import '../styles/mi-perfil.css'

// TODO: compartir con Configuración (es la misma tabla de permisos)
const PERMISOS = [
  { funcion: 'Registrar ventas', propietario: true, encargado: true },
  { funcion: 'Registrar compras', propietario: true, encargado: true },
  { funcion: 'Registrar mermas', propietario: true, encargado: true },
  { funcion: 'Consultar catálogo e historial', propietario: true, encargado: true },
  { funcion: 'Dar de alta productos y cambiar precios', propietario: true, encargado: false },
  { funcion: 'Corregir inventario', propietario: true, encargado: false },
  { funcion: 'Ver ganancias', propietario: true, encargado: false },
  { funcion: 'Configuración y usuarios', propietario: true, encargado: false },
]

const TIPOS = { entrada: 'Entrada', salida: 'Venta', merma: 'Merma', correccion: 'Corrección' }
const CLASES_TIPO = { entrada: 'compra', salida: 'venta', merma: 'merma', correccion: 'correccion' }
const NIVELES = ['', 'Débil', 'Regular', 'Buena', 'Segura']

const formatoFecha = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' })
const formatoHora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })

function iniciales(nombre) {
  const partes = nombre.trim().split(/\s+/)
  if (!partes[0]) return '?'
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (partes[0][0] + ultima).toUpperCase()
}

function soloDigitos(texto) {
  return texto.replace(/\D/g, '')
}

// Cuánto cambió el stock con el movimiento (con signo)
function cambioDeStock(m) {
  if (m.tipo === 'entrada' || m.tipo === 'correccion') return m.cantidad
  return -m.cantidad
}

// El primer mensaje que mandó el backend al rechazar algo
function primerMensaje(datos) {
  if (!datos || typeof datos !== 'object') return null
  if (datos.error) return String(datos.error)
  const primero = Object.values(datos)[0]
  return Array.isArray(primero) ? String(primero[0]) : String(primero)
}

function CampoContrasena({ id, etiqueta, valor, onCambiar, visible, onAlternar, error, autoComplete }) {
  return (
    <div className="mp-campo">
      <label className="mp-etiqueta" htmlFor={id}>
        {etiqueta} <span className="mp-requerido">*</span>
      </label>
      <div className={'mp-input-grupo' + (error ? ' is-error' : '')}>
        <KeyRound size={16} aria-hidden="true" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
        />
        <button
          type="button"
          className="mp-ojo"
          onClick={onAlternar}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && (
        <p className="mp-error">
          <AlertCircle size={13} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}

export default function MiPerfil() {
  const navigate = useNavigate()

  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [aviso, setAviso] = useState(null) // { tipo: 'ok' | 'error', texto }

  const [datos, setDatos] = useState({ nombre: '', telefono: '' })
  const [datosGuardados, setDatosGuardados] = useState({ nombre: '', telefono: '' })
  const [guardandoDatos, setGuardandoDatos] = useState(false)
  const [erroresServidorDatos, setErroresServidorDatos] = useState({})

  const [pass, setPass] = useState({ actual: '', nueva: '', confirmar: '' })
  const [ver, setVer] = useState({ actual: false, nueva: false, confirmar: false })
  const [intentoPass, setIntentoPass] = useState(false)
  const [guardandoPass, setGuardandoPass] = useState(false)
  const [erroresServidorPass, setErroresServidorPass] = useState({})

  const [actividad, setActividad] = useState([]) // mis movimientos
  const [unidades, setUnidades] = useState(new Map()) // idProducto -> unidad

  useEffect(() => {
    getUsuarioActual()
      .then((u) => {
        setUsuario(u)
        const iniciales = { nombre: u.nombre_completo ?? '', telefono: u.telefono_whatsapp ?? '' }
        setDatos(iniciales)
        setDatosGuardados(iniciales)

        // Mis movimientos reales (y las unidades de los productos para mostrarlos bien)
        Promise.allSettled([listarMovimientos(), listarProductos()]).then(([movs, prods]) => {
          if (prods.status === 'fulfilled') {
            setUnidades(new Map(prods.value.map((p) => [p.id, p.unidad])))
          }
          if (movs.status === 'fulfilled') {
            setActividad(
              movs.value
                .filter((m) => m.usuarioId === u.id)
                .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            )
          }
        })
      })
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false))
  }, [])

  if (cargando || !usuario) return null

  const esPropietario = usuario.rol === 'propietario'

  /* ---------- Tus datos ---------- */

  const erroresDatos = { ...erroresServidorDatos }
  if (!datos.nombre.trim()) erroresDatos.nombre = 'Escribe tu nombre'
  if (datos.telefono && soloDigitos(datos.telefono).length !== 10) erroresDatos.telefono = 'Deben ser 10 dígitos'

  const hayCambiosDatos = JSON.stringify(datos) !== JSON.stringify(datosGuardados)

  function cambiarDato(campo, valor) {
    setDatos((d) => ({ ...d, [campo]: valor }))
    setErroresServidorDatos((e) => {
      const copia = { ...e }
      delete copia[campo]
      return copia
    })
  }

  async function guardarDatos() {
    if (Object.keys(erroresDatos).length > 0) return

    setGuardandoDatos(true)

    try {
      const respuesta = await actualizarMiPerfil({
        nombre_completo: datos.nombre.trim(),
        telefono_whatsapp: soloDigitos(datos.telefono),
      })

      const actualizado = respuesta.usuario ?? {}
      const nuevos = {
        nombre: actualizado.nombre_completo ?? datos.nombre.trim(),
        telefono: actualizado.telefono_whatsapp ?? soloDigitos(datos.telefono),
      }

      setDatos(nuevos)
      setDatosGuardados(nuevos)
      setUsuario((u) => ({ ...u, nombre_completo: nuevos.nombre, telefono_whatsapp: nuevos.telefono }))
      setAviso({ tipo: 'ok', texto: 'Tus datos se guardaron' })

      // Avisa a la barra de arriba para que muestre el nombre nuevo
      window.dispatchEvent(new Event('inventia:usuario-actualizado'))
    } catch (e) {
      const errores = e.response?.status === 400 ? e.response.data : null

      if (errores?.nombre_completo || errores?.telefono_whatsapp) {
        setErroresServidorDatos({
          ...(errores.nombre_completo && { nombre: String([].concat(errores.nombre_completo)[0]) }),
          ...(errores.telefono_whatsapp && { telefono: String([].concat(errores.telefono_whatsapp)[0]) }),
        })
      } else {
        setAviso({ tipo: 'error', texto: primerMensaje(e.response?.data) ?? mensajeDeError(e) })
      }
    } finally {
      setGuardandoDatos(false)
    }
  }

  /* ---------- Contraseña ---------- */

  const reglas = [
    { texto: 'Al menos 8 caracteres', ok: pass.nueva.length >= 8 },
    { texto: 'Al menos un número', ok: /\d/.test(pass.nueva) },
    { texto: 'Al menos una letra', ok: /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(pass.nueva) },
    { texto: 'Diferente a la actual', ok: pass.nueva !== '' && pass.nueva !== pass.actual },
  ]
  const nivel = pass.nueva ? reglas.filter((r) => r.ok).length : 0

  const erroresPass = {}
  if (!pass.actual) erroresPass.actual = 'Escribe tu contraseña actual'
  if (reglas.some((r) => !r.ok)) erroresPass.nueva = 'Cumple todas las reglas de abajo'
  if (pass.confirmar !== pass.nueva || !pass.confirmar) erroresPass.confirmar = 'Las contraseñas no coinciden'

  // Los del servidor se muestran siempre; los locales, al intentar guardar
  const errorVisible = (campo) => erroresServidorPass[campo] ?? (intentoPass ? erroresPass[campo] : null)

  function cambiarPass(campo, valor) {
    setPass((p) => ({ ...p, [campo]: valor }))
    setErroresServidorPass((e) => {
      const copia = { ...e }
      delete copia[campo]
      return copia
    })
  }

  function alternarVer(campo) {
    setVer((v) => ({ ...v, [campo]: !v[campo] }))
  }

  async function cambiarContrasena() {
    setIntentoPass(true)
    setErroresServidorPass({})
    if (Object.keys(erroresPass).length > 0) return

    setGuardandoPass(true)

    try {
      await cambiarMiContrasena(pass.actual, pass.nueva)

      setPass({ actual: '', nueva: '', confirmar: '' })
      setVer({ actual: false, nueva: false, confirmar: false })
      setIntentoPass(false)
      setAviso({ tipo: 'ok', texto: 'Tu contraseña se cambió. Úsala la próxima vez que entres.' })
    } catch (e) {
      const errores = e.response?.status === 400 ? e.response.data : null

      if (errores?.error && /actual/i.test(errores.error)) {
        setErroresServidorPass({ actual: errores.error })
      } else if (errores?.contrasena_actual || errores?.nueva_contrasena) {
        setErroresServidorPass({
          ...(errores.contrasena_actual && { actual: String([].concat(errores.contrasena_actual)[0]) }),
          ...(errores.nueva_contrasena && { nueva: String([].concat(errores.nueva_contrasena)[0]) }),
        })
      } else {
        setAviso({ tipo: 'error', texto: primerMensaje(e.response?.data) ?? mensajeDeError(e) })
      }
    } finally {
      setGuardandoPass(false)
    }
  }

  return (
    <div className="mp">
      {/* ============ TARJETA ============ */}
      <section className="mp-tarjeta">
        <span className="mp-avatar" aria-hidden="true">
          {iniciales(datosGuardados.nombre || usuario.nombre_completo)}
        </span>
        <div className="mp-tarjeta__info">
          <h1 className="mp-tarjeta__nombre">{datosGuardados.nombre || usuario.nombre_completo}</h1>
          <div className="mp-tarjeta__fila">
            <span>
              <Mail size={14} aria-hidden="true" />
              {usuario.correo}
            </span>
            <span className={'mp-rol ' + (esPropietario ? 'mp-rol--propietario' : 'mp-rol--encargado')}>
              {esPropietario && <ShieldCheck size={12} aria-hidden="true" />}
              {esPropietario ? 'Propietario' : 'Encargado'}
            </span>
          </div>
        </div>
      </section>

      {aviso && (
        <div className={'mp-aviso' + (aviso.tipo === 'error' ? ' is-error' : '')} role="status">
          {aviso.tipo === 'error' ? (
            <AlertCircle size={18} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={18} aria-hidden="true" />
          )}
          <span>{aviso.texto}</span>
          <button type="button" aria-label="Cerrar aviso" onClick={() => setAviso(null)}>
            <X size={15} />
          </button>
        </div>
      )}

      <div className="mp-grid">
        {/* ============ IZQUIERDA ============ */}
        <div className="mp-columna">
          {/* Tus datos */}
          <section className="mp-panel">
            <header className="mp-cabecera">
              <span className="mp-cabecera__icono" aria-hidden="true">
                <User size={16} />
              </span>
              <h2 className="mp-cabecera__titulo">Tus datos</h2>
            </header>

            <div className="mp-campos">
              <div className="mp-campo">
                <label className="mp-etiqueta" htmlFor="mp-nombre">
                  Nombre completo <span className="mp-requerido">*</span>
                </label>
                <div className={'mp-input-grupo' + (erroresDatos.nombre ? ' is-error' : '')}>
                  <User size={16} aria-hidden="true" />
                  <input
                    id="mp-nombre"
                    maxLength={120}
                    value={datos.nombre}
                    onChange={(e) => cambiarDato('nombre', e.target.value)}
                  />
                </div>
                {erroresDatos.nombre && (
                  <p className="mp-error">
                    <AlertCircle size={13} aria-hidden="true" />
                    {erroresDatos.nombre}
                  </p>
                )}
              </div>

              <div className="mp-campo">
                <label className="mp-etiqueta" htmlFor="mp-telefono">
                  WhatsApp
                </label>
                <div className={'mp-input-grupo' + (erroresDatos.telefono ? ' is-error' : '')}>
                  <Phone size={16} aria-hidden="true" />
                  <input
                    id="mp-telefono"
                    inputMode="tel"
                    placeholder="55 1234 5678"
                    value={datos.telefono}
                    onChange={(e) => cambiarDato('telefono', e.target.value)}
                  />
                </div>
                {erroresDatos.telefono ? (
                  <p className="mp-error">
                    <AlertCircle size={13} aria-hidden="true" />
                    {erroresDatos.telefono}
                  </p>
                ) : (
                  <p className="mp-ayuda">10 dígitos, sin lada internacional</p>
                )}
              </div>

              <div className="mp-campo">
                <span className="mp-etiqueta">Correo</span>
                <div className="mp-input-grupo is-bloqueado">
                  <Mail size={16} aria-hidden="true" />
                  <input value={usuario.correo} readOnly aria-label="Correo" />
                  <Lock size={14} aria-hidden="true" />
                </div>
                {esPropietario ? (
                  <button type="button" className="mp-enlace" onClick={() => navigate('/configuracion')}>
                    Se cambia en Configuración › Usuarios
                  </button>
                ) : (
                  <p className="mp-ayuda">Solo el propietario puede cambiarlo</p>
                )}
              </div>

              <div className="mp-campo">
                <span className="mp-etiqueta">Rol</span>
                <div className="mp-input-grupo is-bloqueado">
                  <ShieldCheck size={16} aria-hidden="true" />
                  <input value={esPropietario ? 'Propietario' : 'Encargado'} readOnly aria-label="Rol" />
                  <Lock size={14} aria-hidden="true" />
                </div>
                <p className="mp-ayuda">Lo asigna el propietario</p>
              </div>
            </div>

            <div className="mp-acciones">
              <button
                type="button"
                className="mp-boton"
                disabled={!hayCambiosDatos || guardandoDatos}
                onClick={() => {
                  setDatos(datosGuardados)
                  setErroresServidorDatos({})
                }}
              >
                Descartar
              </button>
              <button
                type="button"
                className="mp-boton mp-boton--primario"
                disabled={!hayCambiosDatos || Object.keys(erroresDatos).length > 0 || guardandoDatos}
                onClick={guardarDatos}
              >
                {guardandoDatos ? (
                  <Loader2 size={15} className="mp-girando" aria-hidden="true" />
                ) : (
                  <Save size={15} aria-hidden="true" />
                )}
                {guardandoDatos ? 'Guardando…' : 'Guardar datos'}
              </button>
            </div>
          </section>

          {/* Cambiar contraseña */}
          <section className="mp-panel">
            <header className="mp-cabecera">
              <span className="mp-cabecera__icono" aria-hidden="true">
                <KeyRound size={16} />
              </span>
              <h2 className="mp-cabecera__titulo">Cambiar contraseña</h2>
              <span className="mp-cabecera__extra">Si te dieron una temporal, cámbiala aquí</span>
            </header>

            <div className="mp-campos">
              <div className="mp-campo--ancho">
                <CampoContrasena
                  id="mp-actual"
                  etiqueta="Contraseña actual"
                  autoComplete="current-password"
                  valor={pass.actual}
                  onCambiar={(v) => cambiarPass('actual', v)}
                  visible={ver.actual}
                  onAlternar={() => alternarVer('actual')}
                  error={errorVisible('actual')}
                />
              </div>

              <CampoContrasena
                id="mp-nueva"
                etiqueta="Contraseña nueva"
                autoComplete="new-password"
                valor={pass.nueva}
                onCambiar={(v) => cambiarPass('nueva', v)}
                visible={ver.nueva}
                onAlternar={() => alternarVer('nueva')}
                error={errorVisible('nueva')}
              />

              <CampoContrasena
                id="mp-confirmar"
                etiqueta="Confirma la nueva"
                autoComplete="new-password"
                valor={pass.confirmar}
                onCambiar={(v) => cambiarPass('confirmar', v)}
                visible={ver.confirmar}
                onAlternar={() => alternarVer('confirmar')}
                error={errorVisible('confirmar')}
              />

              <div className="mp-campo mp-campo--ancho">
                <div className={`mp-medidor mp-medidor--${nivel}`}>
                  <div className="mp-medidor__barras" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="mp-medidor__texto">{NIVELES[nivel] || '—'}</span>
                </div>

                <ul className="mp-reglas">
                  {reglas.map((r) => (
                    <li key={r.texto} className={r.ok ? 'is-ok' : ''}>
                      <span className="mp-reglas__icono" aria-hidden="true">
                        {r.ok ? <Check size={11} strokeWidth={3} /> : null}
                      </span>
                      {r.texto}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mp-acciones">
              <button
                type="button"
                className="mp-boton mp-boton--primario"
                onClick={cambiarContrasena}
                disabled={guardandoPass}
              >
                {guardandoPass ? (
                  <Loader2 size={15} className="mp-girando" aria-hidden="true" />
                ) : (
                  <KeyRound size={15} aria-hidden="true" />
                )}
                {guardandoPass ? 'Cambiando…' : 'Cambiar contraseña'}
              </button>
            </div>
          </section>
        </div>

        {/* ============ DERECHA ============ */}
        <aside className="mp-columna">
          {/* Lo que puedes hacer */}
          <section className="mp-panel">
            <header className="mp-cabecera">
              <span className="mp-cabecera__icono" aria-hidden="true">
                <ShieldCheck size={16} />
              </span>
              <h2 className="mp-cabecera__titulo">Lo que puedes hacer</h2>
            </header>

            <ul className="mp-permisos">
              {PERMISOS.map((p) => {
                const puede = p[usuario.rol]

                return (
                  <li key={p.funcion} className={puede ? '' : 'is-no'}>
                    {puede ? (
                      <span className="mp-si" aria-label="Sí">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="mp-no" aria-label="No">
                        <X size={12} strokeWidth={3} />
                      </span>
                    )}
                    {p.funcion}
                  </li>
                )
              })}
            </ul>
          </section>

          {/* Actividad reciente */}
          <section className="mp-panel">
            <header className="mp-cabecera">
              <span className="mp-cabecera__icono" aria-hidden="true">
                <History size={16} />
              </span>
              <h2 className="mp-cabecera__titulo">Tu actividad reciente</h2>
              <span className="mp-cabecera__extra">{actividad.length} movimientos</span>
            </header>

            {actividad.length === 0 ? (
              <p className="mp-actividad-vacio">Todavía no has registrado movimientos.</p>
            ) : (
              <ul className="mp-actividad">
                {actividad.slice(0, 5).map((m) => {
                  const fecha = new Date(m.fecha)
                  const unidad = unidades.get(m.productoId) ?? 'pieza'
                  const cambio = cambioDeStock(m)

                  return (
                    <li key={m.id}>
                      <div className="mp-actividad__info">
                        <span className="mp-actividad__producto">{m.productoNombre ?? `Producto #${m.productoId}`}</span>
                        <span className="mp-actividad__fecha">
                          {formatoFecha.format(fecha)} · {formatoHora.format(fecha)}
                        </span>
                      </div>
                      <div className="mp-actividad__lado">
                        <span className={`mp-tipo mp-tipo--${CLASES_TIPO[m.tipo] ?? 'correccion'}`}>
                          {TIPOS[m.tipo] ?? m.tipo}
                        </span>
                        <span className={'mp-cantidad ' + (cambio > 0 ? 'mp-cantidad--entra' : 'mp-cantidad--sale')}>
                          {cambio > 0 ? '+' : ''}
                          {cambio} {textoUnidad(unidad, cambio)}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="mp-ver-todo">
              <button
                type="button"
                className="mp-enlace"
                onClick={() => navigate('/movimientos', { state: { usuario: usuario.nombre_completo } })}
              >
                Ver todo en Historial
                <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}