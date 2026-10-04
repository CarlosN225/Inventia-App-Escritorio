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
} from 'lucide-react'

import { getUsuarioActual } from '../services/auth'
import '../styles/mi-perfil.css'

/* ============================================================
   ESTADO INICIAL — Todo vacío hasta conectar el backend
   ------------------------------------------------------------
   PRODUCTOS:   catálogo del negocio
   MOVIMIENTOS: historial de movimientos del negocio
   ============================================================ */
const PRODUCTOS = []
const MOVIMIENTOS = []

// TODO: cuando el backend esté listo, estas funciones vienen del backend
function unidadDe() { return 'pza' }
function textoUnidad(unidad, cantidad) {
  return cantidad === 1 ? unidad : `${unidad}s`
}

// TODO: compartir con Configuración (es la misma tabla de permisos)
const PERMISOS = [
  { funcion: 'Registrar ventas',                        propietario: true, encargado: true },
  { funcion: 'Registrar compras',                       propietario: true, encargado: true },
  { funcion: 'Registrar mermas',                        propietario: true, encargado: true },
  { funcion: 'Consultar catálogo e historial',          propietario: true, encargado: true },
  { funcion: 'Dar de alta productos y cambiar precios', propietario: true, encargado: false },
  { funcion: 'Corregir inventario',                     propietario: true, encargado: false },
  { funcion: 'Ver ganancias',                           propietario: true, encargado: false },
  { funcion: 'Configuración y usuarios',                propietario: true, encargado: false },
]

const TIPOS = { venta: 'Venta', compra: 'Compra', merma: 'Merma', correccion: 'Corrección' }
const NIVELES = ['', 'Débil', 'Regular', 'Buena', 'Segura']

const productosPorId = Object.fromEntries(PRODUCTOS.map((p) => [p.id, p]))
const formatoFecha = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' })
const formatoHora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })

/* ============ Utilidades ============ */

function iniciales(nombre) {
  const partes = (nombre ?? '').trim().split(/\s+/)
  if (!partes[0]) return '?'
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (partes[0][0] + ultima).toUpperCase()
}

function soloDigitos(texto) {
  return texto.replace(/\D/g, '')
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

/* ============ Pantalla ============ */

export default function MiPerfil() {
  const navigate = useNavigate()

  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [aviso, setAviso] = useState(null)

  const [datos, setDatos] = useState({ nombre: '', telefono: '' })
  const [datosGuardados, setDatosGuardados] = useState({ nombre: '', telefono: '' })

  const [pass, setPass] = useState({ actual: '', nueva: '', confirmar: '' })
  const [ver, setVer] = useState({ actual: false, nueva: false, confirmar: false })
  const [intentoPass, setIntentoPass] = useState(false)

  useEffect(() => {
    getUsuarioActual()
      .then((u) => {
        setUsuario(u)
        const iniciales = { nombre: u.nombre_completo ?? '', telefono: u.telefono_whatsapp ?? '' }
        setDatos(iniciales)
        setDatosGuardados(iniciales)
      })
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false))
  }, [])

  if (cargando || !usuario) return null

  const esPropietario = usuario.rol === 'propietario'

  /* ---------- Tus datos ---------- */

  const erroresDatos = {}
  if (!datos.nombre.trim()) erroresDatos.nombre = 'Escribe tu nombre'
  if (datos.telefono && soloDigitos(datos.telefono).length !== 10) erroresDatos.telefono = 'Deben ser 10 dígitos'

  const hayCambiosDatos = JSON.stringify(datos) !== JSON.stringify(datosGuardados)

  function guardarDatos() {
    if (Object.keys(erroresDatos).length > 0) return
    // TODO: mandar al backend
    setDatosGuardados(datos)
    setAviso('Tus datos se guardaron')
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

  function cambiarPass(campo, valor) {
    setPass((p) => ({ ...p, [campo]: valor }))
  }

  function alternarVer(campo) {
    setVer((v) => ({ ...v, [campo]: !v[campo] }))
  }

  function cambiarContrasena() {
    setIntentoPass(true)
    if (Object.keys(erroresPass).length > 0) return

    // TODO: el backend revisa que la actual sea correcta antes de cambiarla
    setPass({ actual: '', nueva: '', confirmar: '' })
    setVer({ actual: false, nueva: false, confirmar: false })
    setIntentoPass(false)
    setAviso('Tu contraseña se cambió. Úsala la próxima vez que entres.')
  }

  /* ---------- Actividad ---------- */

  const misMovimientos = MOVIMIENTOS.filter((m) =>
    usuario.nombre_completo?.startsWith(m.usuario ?? '')
  )
  const nombreEnHistorial = misMovimientos[0]?.usuario

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
        <div className="mp-aviso" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{aviso}</span>
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
                    value={datos.nombre}
                    onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
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
                    onChange={(e) => setDatos({ ...datos, telefono: e.target.value })}
                  />
                </div>
                {erroresDatos.telefono ? (
                  <p className="mp-error">
                    <AlertCircle size={13} aria-hidden="true" />
                    {erroresDatos.telefono}
                  </p>
                ) : (
                  <p className="mp-ayuda">Opcional</p>
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
                disabled={!hayCambiosDatos}
                onClick={() => setDatos(datosGuardados)}
              >
                Descartar
              </button>
              <button
                type="button"
                className="mp-boton mp-boton--primario"
                disabled={!hayCambiosDatos || Object.keys(erroresDatos).length > 0}
                onClick={guardarDatos}
              >
                <Save size={15} aria-hidden="true" />
                Guardar datos
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
                  error={intentoPass && erroresPass.actual}
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
                error={intentoPass && erroresPass.nueva}
              />

              <CampoContrasena
                id="mp-confirmar"
                etiqueta="Confirma la nueva"
                autoComplete="new-password"
                valor={pass.confirmar}
                onCambiar={(v) => cambiarPass('confirmar', v)}
                visible={ver.confirmar}
                onAlternar={() => alternarVer('confirmar')}
                error={intentoPass && erroresPass.confirmar}
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
              <button type="button" className="mp-boton mp-boton--primario" onClick={cambiarContrasena}>
                <KeyRound size={15} aria-hidden="true" />
                Cambiar contraseña
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
              {misMovimientos.length > 0 && (
                <span className="mp-cabecera__extra">{misMovimientos.length} movimientos</span>
              )}
            </header>

            {misMovimientos.length === 0 ? (
              <div className="mp-actividad-vacio-estado">
                <span className="mp-actividad-vacio-estado__icono" aria-hidden="true">
                  <History size={20} />
                </span>
                <p className="mp-actividad-vacio-estado__titulo">Sin actividad todavía</p>
                <p className="mp-actividad-vacio-estado__texto">
                  Cuando registres ventas, compras o mermas, aparecerán aquí.
                </p>
              </div>
            ) : (
              <ul className="mp-actividad">
                {misMovimientos.slice(0, 5).map((m) => {
                  const fecha = new Date(m.fecha)
                  const unidad = unidadDe(m.productoId)

                  return (
                    <li key={m.id}>
                      <div className="mp-actividad__info">
                        <span className="mp-actividad__producto">{productosPorId[m.productoId]?.nombre}</span>
                        <span className="mp-actividad__fecha">
                          {formatoFecha.format(fecha)} · {formatoHora.format(fecha)}
                        </span>
                      </div>
                      <div className="mp-actividad__lado">
                        <span className={`mp-tipo mp-tipo--${m.tipo}`}>{TIPOS[m.tipo]}</span>
                        <span
                          className={
                            'mp-cantidad ' + (m.cantidad > 0 ? 'mp-cantidad--entra' : 'mp-cantidad--sale')
                          }
                        >
                          {m.cantidad > 0 ? '+' : ''}
                          {m.cantidad} {textoUnidad(unidad, m.cantidad)}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {misMovimientos.length > 0 && (
              <div className="mp-ver-todo">
                <button
                  type="button"
                  className="mp-enlace"
                  onClick={() => navigate('/movimientos', { state: { usuario: nombreEnHistorial } })}
                >
                  Ver todo en Historial
                  <ArrowUpRight size={14} aria-hidden="true" />
                </button>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}