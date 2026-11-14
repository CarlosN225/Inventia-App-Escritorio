import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  Candy,
  CheckCircle2,
  ChevronDown,
  Clock,
  History,
  Info,
  Lightbulb,
  Loader2,
  Mail,
  PackageMinus,
  PackageOpen,
  PackageX,
  Plus,
  RotateCcw,
  Send,
  Settings,
  ShieldCheck,
  Tag,
  Truck,
  WifiOff,
  X,
} from 'lucide-react'

import useConfiguracion from '../hooks/useConfiguracion'
import { leerAjustes, nombreCorto } from '../services/configuracion'
import { listarProductos, mensajeDeError } from '../services/productos'
import { enviarResumenCorreo, obtenerEstadoAlertas } from '../services/alertas'
import { notificar } from '../services/notificar'
import { textoUnidad } from '../utils/unidades'
import logoInventia from '../assets/logo-inventia-sf.png'
import '../styles/alertas.css'

// Cuántos productos de cada lista caben en el correo (igual que en el backend)
const MAX_EN_CORREO = 5

// A partir de cuántos días se considera urgente una caducidad
const DIAS_URGENTE = 7

const formatoDiaMes = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' })
const formatoHora = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true })

/* ---------- Ayudantes de fechas y textos ---------- */

function mismoDia(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function diaRelativo(fecha) {
  const hoy = new Date()
  const ayer = new Date(hoy)
  ayer.setDate(hoy.getDate() - 1)
  const manana = new Date(hoy)
  manana.setDate(hoy.getDate() + 1)

  if (mismoDia(fecha, hoy)) return 'hoy'
  if (mismoDia(fecha, ayer)) return 'ayer'
  if (mismoDia(fecha, manana)) return 'mañana'
  return formatoDiaMes.format(fecha)
}

// "2026-11-04T20:01:00-06:00" -> "ayer, 8:01 p.m."
function cuandoFue(iso) {
  if (!iso) return 'Todavía ninguno'
  const fecha = new Date(iso)
  return `${diaRelativo(fecha)}, ${formatoHora.format(fecha)}`
}

// "20:00" -> la siguiente vez que toca revisar (hoy o mañana)
function proximaRevisionLocal(hhmm) {
  const [h, m] = (hhmm || '20:00').split(':').map(Number)
  const fecha = new Date()
  fecha.setHours(h, m, 0, 0)
  if (fecha <= new Date()) fecha.setDate(fecha.getDate() + 1)
  return fecha
}

function cuandoSera(fecha) {
  return `${diaRelativo(fecha)} a las ${formatoHora.format(fecha)}`
}

function textoCaducidad(dias) {
  if (dias < 0) {
    const pasaron = Math.abs(dias)
    return `Caducó hace ${pasaron} ${pasaron === 1 ? 'día' : 'días'}`
  }
  if (dias === 0) return 'Caduca hoy'
  return `En ${dias} ${dias === 1 ? 'día' : 'días'}`
}

function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`
}

// Por caducar: se agrupa por qué tan pronto caduca (lo que caduca antes, arriba) para vender primero lo más antiguo
function agruparPorCaducidad(lista) {
  const grupos = [
    { nombre: 'Ya caducaron', items: [] },
    { nombre: `Vende primero · ${DIAS_URGENTE} días o menos`, items: [] },
    { nombre: 'En las próximas semanas', items: [] },
  ]
  lista.forEach((p) => {
    if (p.diasCaducar < 0) grupos[0].items.push(p)
    else if (p.diasCaducar <= DIAS_URGENTE) grupos[1].items.push(p)
    else grupos[2].items.push(p)
  })
  return grupos.filter((g) => g.items.length > 0)
}

// Agrupa por categoría respetando el orden de la lista (la más urgente primero)
function agruparPorCategoria(lista) {
  const grupos = new Map()

  lista.forEach((p) => {
    const nombre = p.categoria || 'Sin categoría'
    if (!grupos.has(nombre)) grupos.set(nombre, { nombre, items: [] })
    grupos.get(nombre).items.push(p)
  })

  return [...grupos.values()]
}

/* ---------- Tarjeta de número (arriba) ---------- */

function Indicador({ tono, icono: Icono, etiqueta, valor, nota, activo, onClick }) {
  const enCero = valor === 0

  return (
    <button
      type="button"
      className={`alv-kpi alv-kpi--${enCero ? 'ok' : tono}` + (activo ? ' is-activo' : '')}
      onClick={onClick}
      aria-pressed={activo}
    >
      <span className="alv-kpi__icono" aria-hidden="true">
        {enCero ? <CheckCircle2 size={17} /> : <Icono size={17} />}
      </span>
      <span className="alv-kpi__texto">
        <span className="alv-kpi__etiqueta">{etiqueta}</span>
        <span className="alv-kpi__linea">
          <span className="alv-kpi__valor">{valor}</span>
          <span className="alv-kpi__nota">{nota}</span>
        </span>
      </span>
    </button>
  )
}

/* ---------- Encabezado de un grupo (se pliega con un clic) ---------- */

function CabeceraGrupo({ grupo, plegado, onAlternar, extra }) {
  return (
    <button type="button" className="alv-g__cabecera" onClick={onAlternar} aria-expanded={!plegado}>
      <ChevronDown size={15} className={'alv-g__chevron' + (plegado ? ' is-plegado' : '')} aria-hidden="true" />
      <span className="alv-g__nombre">{grupo.nombre}</span>
      <span className="alv-g__conteo">{grupo.items.length}</span>
      {extra}
    </button>
  )
}

/* ---------- Ventanita: avisos por correo ---------- */

function ModalAvisos({ abierto, onCerrar, conCorreo, correo, estado, proximaRevision, enLinea, enviando, onEnviar, onConfigurar }) {
  const cerrarRef = useRef(null)

  // Esc para cerrar y el foco al botón de cerrar al abrir
  useEffect(() => {
    if (!abierto) return undefined
    cerrarRef.current?.focus()
    const alPresionar = (e) => e.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', alPresionar)
    return () => document.removeEventListener('keydown', alPresionar)
  }, [abierto, onCerrar])

  if (!abierto) return null

  const pendientes = estado?.pendientes ?? 0

  return createPortal(
    <div className="alv-capa" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <section className="alv-modal" role="dialog" aria-modal="true" aria-labelledby="alv-modal-titulo">
        <header className="alv-modal__cabecera">
          <span className="alv-modal__icono" aria-hidden="true">
            <BellRing size={17} />
          </span>
          <div className="alv-modal__titulos">
            <h2 id="alv-modal-titulo">Avisos por correo</h2>
            <p>{conCorreo ? correo || 'Sin correo configurado' : 'Están apagados'}</p>
          </div>
          <button type="button" className="alv-modal__cerrar" onClick={onCerrar} ref={cerrarRef} aria-label="Cerrar">
            <X size={16} />
          </button>
        </header>

        {conCorreo ? (
          <>
            <dl className="alv-modal__datos">
              <div>
                <dt>
                  <History size={13} aria-hidden="true" />
                  Último aviso
                </dt>
                <dd>{cuandoFue(estado?.ultimo_envio)}</dd>
              </div>
              <div>
                <dt>
                  <Clock size={13} aria-hidden="true" />
                  Próxima revisión
                </dt>
                <dd>{cuandoSera(proximaRevision)}</dd>
              </div>
              {estado?.revision_hoy === 'sin_novedad' && (
                <div>
                  <dt>
                    <CheckCircle2 size={13} aria-hidden="true" />
                    Hoy
                  </dt>
                  <dd>Sin novedades, no se envió</dd>
                </div>
              )}
            </dl>

            {(!enLinea || pendientes > 0) && (
              <p className="alv-modal__pendiente">
                <WifiOff size={13} aria-hidden="true" />
                {!enLinea ? 'Sin internet: se enviará al volver la conexión.' : 'Un aviso quedó pendiente; se reintenta solo.'}
              </p>
            )}

            <p className="alv-modal__regla">
              <ShieldCheck size={15} aria-hidden="true" />
              <span>
                Solo te escribimos si algo <strong>se agota, baja de su mínimo o está por caducar</strong>. Si nada
                cambia, no llega correo. Los lunes, un recordatorio.
              </span>
            </p>

            <div className="alv-modal__acciones">
              <button type="button" className="alv-enlace" onClick={onConfigurar}>
                <Settings size={13} aria-hidden="true" />
                Cambiar horario o correo
              </button>
              <button
                type="button"
                className="alv-boton alv-boton--primario"
                onClick={onEnviar}
                disabled={!enLinea || enviando}
                title={enLinea ? 'Manda el resumen en este momento' : 'Necesitas internet para enviarlo'}
              >
                {enviando ? <Loader2 size={14} className="alv-girando" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
                {enviando ? 'Enviando…' : 'Enviar ahora'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="alv-modal__regla">
              <Info size={15} aria-hidden="true" />
              <span>Actívalos para recibir un correo cuando algo se agote o esté por caducar.</span>
            </p>
            <div className="alv-modal__acciones">
              <span />
              <button type="button" className="alv-boton alv-boton--primario" onClick={onConfigurar}>
                <Settings size={14} aria-hidden="true" />
                Activarlos
              </button>
            </div>
          </>
        )}
      </section>
    </div>,
    document.body
  )
}

/* ---------- Encoge lo de adentro para que quepa completo, sin scroll ---------- */

function AjustarAlAlto({ children }) {
  const cajaRef = useRef(null)
  const contenidoRef = useRef(null)
  const [escala, setEscala] = useState(1)

  useLayoutEffect(() => {
    const caja = cajaRef.current
    const contenido = contenidoRef.current
    if (!caja || !contenido) return undefined

    function medir() {
      const disponible = caja.clientHeight
      const natural = contenido.offsetHeight // no le afecta el transform
      if (!disponible || !natural) return
      const nueva = Math.min(1, disponible / natural)
      setEscala((actual) => (Math.abs(actual - nueva) > 0.01 ? nueva : actual))
    }

    const observador = new ResizeObserver(medir)
    observador.observe(caja)
    observador.observe(contenido)
    medir()
    return () => observador.disconnect()
  }, [])

  return (
    <div className="alv-ajuste" ref={cajaRef}>
      <div
        ref={contenidoRef}
        style={{ width: `${100 / escala}%`, transform: `scale(${escala})`, transformOrigin: 'top left' }}
      >
        {children}
      </div>
    </div>
  )
}

/* ---------- Muestra del correo (igual que el que llega a Gmail / Outlook) ---------- */

function ListaCorreo({ titulo, cifra, nota, tono, items, describir, colorDe, vacio }) {
  return (
    <div className="alv-correo__columna">
      <div className={`alv-correo__cifra alv-correo__cifra--${tono}`}>
        <strong>{cifra}</strong>
        <span>
          {titulo}
          <em>{nota}</em>
        </span>
      </div>

      {items.length === 0 ? (
        <p className="alv-correo__vacio">✓ {vacio}</p>
      ) : (
        <ul className="alv-correo__lista">
          {items.slice(0, MAX_EN_CORREO).map((p) => (
            <li key={p.id}>
              <span>{p.nombre}</span>
              <span className={colorDe(p)}>{describir(p)}</span>
            </li>
          ))}
        </ul>
      )}
      {items.length > MAX_EN_CORREO && <p className="alv-correo__mas">…y {items.length - MAX_EN_CORREO} más</p>}
    </div>
  )
}

function VistaCorreo({ negocio, correo, stockBajo, agotados, porCaducar, conCaducidad, diasAviso }) {
  const total = new Set([...stockBajo, ...(conCaducidad ? porCaducar : [])].map((p) => p.id)).size
  const hoy = new Date()

  if (total === 0) {
    return (
      <div className="alv-correo alv-correo--vacio">
        <CheckCircle2 size={22} aria-hidden="true" />
        <p>
          <strong>Hoy no te llegaría correo.</strong>
          Todo está surtido y nada está por caducar.
        </p>
      </div>
    )
  }

  const asunto = `INVENTIA · ${plural(total, 'producto necesita', 'productos necesitan')} atención`

  return (
    <div className="alv-correo">
      <div className="alv-correo__sobre">
        <p className="alv-correo__asunto">{asunto}</p>
        <p>Para {correo || 'tu correo'}</p>
      </div>

      <div className="alv-correo__hoja">
        <div className="alv-correo__banda">
          <img src={logoInventia} alt="" className="alv-correo__logo" />
          <div>
            <span className="alv-correo__marca">INVENTIA</span>
            <span className="alv-correo__fecha">
              Resumen del {formatoDiaMes.format(hoy)}
              {negocio && ` · ${negocio}`}
            </span>
          </div>
        </div>

        <div className="alv-correo__cuerpo">
          <p className="alv-correo__titulo">{plural(total, 'producto necesita', 'productos necesitan')} atención</p>

          <div className="alv-correo__columnas">
            <ListaCorreo
              titulo="Stock bajo"
              cifra={stockBajo.length}
              nota={agotados > 0 ? plural(agotados, 'agotado', 'agotados') : 'ninguno agotado'}
              tono="ambar"
              items={stockBajo}
              describir={(p) => (p.stock === 0 ? 'Agotado' : `${p.stock} de ${p.minimo}`)}
              colorDe={(p) => (p.stock === 0 ? 'is-rojo' : '')}
              vacio="Todo surtido"
            />
            {conCaducidad && (
              <ListaCorreo
                titulo="Por caducar"
                cifra={porCaducar.length}
                nota={`próximos ${diasAviso} días`}
                tono="rojo"
                items={porCaducar}
                describir={(p) => textoCaducidad(p.diasCaducar)}
                colorDe={(p) => (p.urgente ? 'is-rojo' : 'is-ambar')}
                vacio="Nada por caducar"
              />
            )}
          </div>
        </div>

        <p className="alv-correo__pie">Solo te escribimos cuando hay algo nuevo y los lunes con un recordatorio.</p>
      </div>
    </div>
  )
}

/* ============================================================
   PANTALLA
   ============================================================ */

export default function Alertas() {
  const navigate = useNavigate()

  // Lo que el propietario configuró: caducidad, días de aviso y correo
  const configuracion = useConfiguracion()
  const ajustes = leerAjustes(configuracion)
  const negocio = nombreCorto(configuracion?.negocio?.nombre)
  const diasAviso = ajustes.diasAviso
  const conCaducidad = ajustes.maneja_caducidad
  const conCorreo = ajustes.alertas_activas

  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [pestana, setPestana] = useState('stock')
  const [filtro, setFiltro] = useState('todos')
  const [plegados, setPlegados] = useState(() => new Set())

  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const [estado, setEstado] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const cerrarModal = useCallback(() => setModalAbierto(false), [])

  async function cargarProductos() {
    setCargando(true)
    setError(null)

    try {
      setProductos(await listarProductos())
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setCargando(false)
    }
  }

  async function cargarEstado() {
    try {
      setEstado(await obtenerEstadoAlertas())
    } catch {
      setEstado(null) // Si falla, se calcula la próxima revisión con la hora de Ajustes
    }
  }

  useEffect(() => {
    cargarProductos()
  }, [])

  useEffect(() => {
    if (conCorreo) cargarEstado()
  }, [conCorreo])

  // Si apagan la caducidad estando en esa pestaña, regresa a "Stock bajo"
  useEffect(() => {
    if (!conCaducidad && pestana === 'caducar') setPestana('stock')
  }, [conCaducidad, pestana])

  // Detecta si hay internet, para el estado del correo
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

  const activos = useMemo(() => productos.filter((p) => p.activo), [productos])

  // Negocio recién creado: sin productos no hay nada que revisar todavía
  const sinProductos = !cargando && !error && activos.length === 0

  /* ---------- Stock bajo ---------- */

  const stockBajo = useMemo(
    () =>
      activos
        .filter((p) => p.stock < p.minimo)
        .map((p) => {
          const objetivo = p.maximo ?? p.minimo * 2
          const sugerido = Math.max(objetivo - p.stock, 1)
          const empaques = p.piezasEmpaque ? Math.ceil(sugerido / p.piezasEmpaque) : null

          return {
            ...p,
            faltan: p.minimo - p.stock,
            porcentaje: p.minimo > 0 ? Math.round((p.stock / p.minimo) * 100) : 0,
            sugerido,
            empaques,
            empaqueNombre: p.empaque ?? 'caja',
            aComprar: empaques ? empaques * p.piezasEmpaque : sugerido,
          }
        })
        .sort((a, b) => a.porcentaje - b.porcentaje),
    [activos]
  )

  /* ---------- Por caducar ---------- */

  const porCaducar = useMemo(
    () =>
      activos
        .filter((p) => conCaducidad && p.diasCaducar !== null && p.diasCaducar <= diasAviso && p.stock > 0)
        .map((p) => ({ ...p, urgente: p.diasCaducar <= DIAS_URGENTE }))
        .sort((a, b) => a.diasCaducar - b.diasCaducar),
    [activos, conCaducidad, diasAviso]
  )

  const agotados = stockBajo.filter((p) => p.stock === 0).length
  const urgentes = porCaducar.filter((p) => p.urgente).length

  /* ---------- Lo que se ve en la lista (pestaña + filtro) ---------- */

  const listaVisible = useMemo(() => {
    if (pestana === 'stock') return filtro === 'agotados' ? stockBajo.filter((p) => p.stock === 0) : stockBajo
    return filtro === 'urgentes' ? porCaducar.filter((p) => p.urgente) : porCaducar
  }, [pestana, filtro, stockBajo, porCaducar])

  const gruposVisibles = useMemo(
    () => (pestana === 'caducar' ? agruparPorCaducidad(listaVisible) : agruparPorCategoria(listaVisible)),
    [pestana, listaVisible]
  )

  function verLista(nuevaPestana, nuevoFiltro = 'todos') {
    setPestana(nuevaPestana)
    setFiltro(nuevoFiltro)
  }

  /* ---------- Plegar / desplegar ---------- */

  const clave = (nombre) => `${pestana}:${nombre}`
  const todoPlegado = gruposVisibles.length > 0 && gruposVisibles.every((g) => plegados.has(clave(g.nombre)))

  function alternarGrupo(nombre) {
    setPlegados((actual) => {
      const copia = new Set(actual)
      const k = clave(nombre)
      if (copia.has(k)) copia.delete(k)
      else copia.add(k)
      return copia
    })
  }

  function alternarTodo() {
    setPlegados((actual) => {
      const copia = new Set(actual)
      gruposVisibles.forEach((g) => (todoPlegado ? copia.delete(clave(g.nombre)) : copia.add(clave(g.nombre))))
      return copia
    })
  }

  /* ---------- Acciones ---------- */

  function irACompra(producto) {
    navigate('/registrar-compra', { state: { agregar: { id: producto.id, piezas: producto.aComprar } } })
  }

  function irAMerma(producto) {
    navigate('/registrar-merma', { state: { productoId: producto.id } })
  }

  async function enviarAhora() {
    if (enviando) return
    setEnviando(true)

    try {
      const resultado = await enviarResumenCorreo()
      setModalAbierto(false) // Se cierra: así queda claro que ya se mandó
      notificar({
        tipo: resultado.enviada ? 'ok' : 'aviso',
        texto: resultado.enviada
          ? 'Resumen enviado a tu correo.'
          : 'El resumen quedó pendiente y se enviará cuando vuelva la conexión.',
      })
    } catch (e) {
      const codigo = e.response?.data?.error
      const textos = {
        correo_no_enviado: 'El correo quedó guardado para reintento. Revisa tu conexión y la configuración de Brevo.',
        brevo_no_configurado: 'Faltan las credenciales SMTP de Brevo en backend/.env.',
        brevo_remitente_no_configurado: 'Configura un remitente verificado de Brevo en backend/.env.',
        correo_no_configurado: 'Configura primero el correo en Ajustes.',
        alertas_desactivadas: 'Activa las alertas por correo en Ajustes.',
        configuracion_no_encontrada: 'Completa la configuración del negocio antes de enviar alertas.',
      }
      notificar({
        tipo: 'error',
        texto:
          textos[codigo] ||
          (e.response?.status === 403
            ? 'Solo el propietario puede enviar el resumen por correo.'
            : 'No se pudo enviar el resumen. Inténtalo de nuevo.'),
      })
    } finally {
      setEnviando(false)
      cargarEstado()
    }
  }

  /* ---------- Estado del correo ---------- */

  const proximaRevision = estado?.proximo_envio
    ? new Date(estado.proximo_envio)
    : proximaRevisionLocal(ajustes.horaResumen)

  // Puntito del botón: verde = activos · ámbar = algo pendiente · gris = apagados
  const tonoAvisos = !conCorreo ? 'apagado' : !enLinea || (estado?.pendientes ?? 0) > 0 ? 'pendiente' : 'activo'

  return (
    <div className="alv">
      {/* ============ ENCABEZADO ============ */}
      <header className="alv-encabezado">
        <div>
          <h1 className="alv-titulo">Alertas</h1>
          <p className="alv-subtitulo">
            {conCaducidad ? 'Lo que se está acabando y lo que está por caducar' : 'Lo que se está acabando'}
          </p>
        </div>

        <div className="alv-encabezado__acciones">
          <button
            type="button"
            className="alv-boton alv-boton--avisos"
            onClick={() => setModalAbierto(true)}
            title="Cómo funcionan los avisos por correo"
          >
            <Info size={15} aria-hidden="true" />
            <span className="alv-ocultable">Avisos por correo</span>
            <span className={`alv-punto alv-punto--${tonoAvisos}`} aria-hidden="true" />
          </button>

          <button
            type="button"
            className="alv-boton"
            onClick={cargarProductos}
            disabled={cargando}
            title="Volver a revisar el inventario"
          >
            <RotateCcw size={14} className={cargando ? 'alv-girando' : ''} aria-hidden="true" />
            <span className="alv-ocultable">Actualizar</span>
          </button>
        </div>
      </header>

      {/* ============ NÚMEROS ============ */}
      {!cargando && !error && !sinProductos && (
        <section className={'alv-kpis' + (conCaducidad ? '' : ' alv-kpis--dos')} aria-label="Resumen de alertas">
          <Indicador
            tono="rojo"
            icono={PackageX}
            etiqueta="Agotados"
            valor={agotados}
            nota={agotados > 0 ? 'ya no hay en tienda' : 'ninguno agotado'}
            activo={pestana === 'stock' && filtro === 'agotados'}
            onClick={() => verLista('stock', 'agotados')}
          />
          <Indicador
            tono="ambar"
            icono={AlertTriangle}
            etiqueta="Stock bajo"
            valor={stockBajo.length}
            nota={stockBajo.length > 0 ? `${stockBajo.length - agotados} debajo del mínimo` : 'todo surtido'}
            activo={pestana === 'stock' && filtro === 'todos'}
            onClick={() => verLista('stock')}
          />
          {conCaducidad && (
            <Indicador
              tono="rojo"
              icono={CalendarClock}
              etiqueta="Por caducar"
              valor={porCaducar.length}
              nota={porCaducar.length > 0 ? `${urgentes} en ${DIAS_URGENTE} días o menos` : `nada en ${diasAviso} días`}
              activo={pestana === 'caducar'}
              onClick={() => verLista('caducar')}
            />
          )}
        </section>
      )}

      {/* ============ SIN PRODUCTOS ============ */}
      {sinProductos ? (
        <div className="alv-grid alv-grid--sola">
          <section className="alv-tarjeta alv-sin-productos">
            <span className="alv-sin-productos__icono" aria-hidden="true">
              <PackageOpen size={28} />
            </span>
            <h2 className="alv-sin-productos__titulo">Aún no tienes productos</h2>
            <p className="alv-sin-productos__texto">
              Cuando registres tus productos, aquí verás lo que se está acabando
              {conCaducidad ? ' y lo que está por caducar' : ''}.
              {conCorreo && ' Y si algo hace falta, te avisamos por correo.'}
            </p>
            <button type="button" className="alv-boton alv-boton--primario alv-sin-productos__boton" onClick={() => navigate('/catalogo/nuevo')}>
              <Plus size={16} aria-hidden="true" />
              Nuevo producto
            </button>
          </section>
        </div>
      ) : (
      <div className={'alv-grid' + (conCorreo ? '' : ' alv-grid--sola')}>
        {/* ============ LISTAS ============ */}
        <section className="alv-tarjeta alv-listas">
          {cargando ? (
            <div className="alv-vacio">
              <Loader2 size={26} className="alv-girando" aria-hidden="true" />
              Revisando tu inventario…
            </div>
          ) : error ? (
            <div className="alv-vacio alv-vacio--error">
              <WifiOff size={26} aria-hidden="true" />
              {error}
              <button type="button" className="alv-boton" onClick={cargarProductos}>
                <RotateCcw size={14} aria-hidden="true" />
                Reintentar
              </button>
            </div>
          ) : (
            <>
              <div className="alv-herramientas">
                <div className="alv-pestanas" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={pestana === 'stock'}
                    className={pestana === 'stock' ? 'is-activo' : ''}
                    onClick={() => verLista('stock')}
                  >
                    <AlertTriangle size={14} aria-hidden="true" />
                    Stock bajo
                    <span className="alv-contador alv-contador--ambar">{stockBajo.length}</span>
                  </button>
                  {conCaducidad && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={pestana === 'caducar'}
                      className={pestana === 'caducar' ? 'is-activo' : ''}
                      onClick={() => verLista('caducar')}
                    >
                      <CalendarClock size={14} aria-hidden="true" />
                      Por caducar
                      <span className="alv-contador alv-contador--rojo">{porCaducar.length}</span>
                    </button>
                  )}
                </div>

                <div className="alv-herramientas__derecha">
                  {/* Filtro rápido: solo lo más grave */}
                  {pestana === 'stock' && agotados > 0 && (
                    <div className="alv-filtros">
                      <button type="button" className={filtro === 'todos' ? 'is-activo' : ''} onClick={() => setFiltro('todos')}>
                        Todos
                      </button>
                      <button
                        type="button"
                        className={filtro === 'agotados' ? 'is-activo' : ''}
                        onClick={() => setFiltro('agotados')}
                      >
                        Agotados ({agotados})
                      </button>
                    </div>
                  )}
                  {pestana === 'caducar' && urgentes > 0 && (
                    <div className="alv-filtros">
                      <button type="button" className={filtro === 'todos' ? 'is-activo' : ''} onClick={() => setFiltro('todos')}>
                        Todos
                      </button>
                      <button
                        type="button"
                        className={filtro === 'urgentes' ? 'is-activo' : ''}
                        onClick={() => setFiltro('urgentes')}
                      >
                        ≤ {DIAS_URGENTE} días ({urgentes})
                      </button>
                    </div>
                  )}

                  {gruposVisibles.length > 1 && (
                    <button type="button" className="alv-enlace" onClick={alternarTodo}>
                      {todoPlegado ? 'Expandir todo' : 'Contraer todo'}
                    </button>
                  )}
                </div>
              </div>

              <div className="alv-desplazable">
                {/* ---------- Sin pendientes ---------- */}
                {listaVisible.length === 0 && (
                  <div className="alv-vacio alv-vacio--ok">
                    <CheckCircle2 size={28} aria-hidden="true" />
                    <strong>{pestana === 'stock' ? 'Todo surtido' : 'Nada por caducar'}</strong>
                    {pestana === 'stock'
                      ? 'Todos tus productos están arriba de su mínimo.'
                      : `Ningún producto caduca en los próximos ${diasAviso} días.`}
                  </div>
                )}

                {/* ---------- Stock bajo ---------- */}
                {pestana === 'stock' && listaVisible.length > 0 && (
                  <div className="alv-grupos">
                    {gruposVisibles.map((grupo) => {
                      const plegado = plegados.has(clave(grupo.nombre))
                      const agotadosGrupo = grupo.items.filter((p) => p.stock === 0).length

                      return (
                        <section className="alv-g" key={grupo.nombre}>
                          <CabeceraGrupo
                            grupo={grupo}
                            plegado={plegado}
                            onAlternar={() => alternarGrupo(grupo.nombre)}
                            extra={
                              agotadosGrupo > 0 &&
                              filtro !== 'agotados' && (
                                <span className="alv-chip alv-chip--rojo">
                                  {plural(agotadosGrupo, 'agotado', 'agotados')}
                                </span>
                              )
                            }
                          />

                          {!plegado && (
                            <ul className="alv-filas">
                              {grupo.items.map((p) => {
                                const agotado = p.stock === 0
                                const sugerencia = p.empaques
                                  ? `${p.empaques} ${textoUnidad(p.empaqueNombre, p.empaques, true)}`
                                  : `${p.sugerido} ${textoUnidad(p.unidad, p.sugerido)}`

                                return (
                                  <li
                                    key={p.id}
                                    className={'alv-fila alv-fila--stock ' + (agotado ? 'is-rojo' : 'is-ambar')}
                                  >
                                    <div className="alv-fila__producto">
                                      <span className="alv-fila__icono" aria-hidden="true">
                                        <Candy size={14} />
                                      </span>
                                      <p className="alv-fila__nombre">
                                        {p.nombre}
                                        {p.gramaje && <span className="gramaje">{p.gramaje}</span>}
                                      </p>
                                    </div>

                                    <div className="alv-fila__nivel" title={`${p.porcentaje}% del stock mínimo`}>
                                      <span className="alv-fila__cantidad">
                                        <strong>{p.stock}</strong> de {p.minimo} {textoUnidad(p.unidad, p.minimo)}
                                      </span>
                                      <span className="alv-barra" aria-hidden="true">
                                        <span style={{ width: `${Math.max(Math.min(p.porcentaje, 100), 3)}%` }} />
                                      </span>
                                    </div>

                                    <span className="alv-fila__faltan">
                                      Faltan {p.faltan} {textoUnidad(p.unidad, p.faltan)}
                                    </span>

                                    <button
                                      type="button"
                                      className={'alv-boton alv-boton--chico' + (agotado ? ' alv-boton--primario' : '')}
                                      onClick={() => irACompra(p)}
                                      title={`Sugerido para llegar a tu máximo: ${sugerencia} (${p.aComprar} ${textoUnidad(p.unidad, p.aComprar)})`}
                                    >
                                      <Truck size={14} aria-hidden="true" />
                                      Comprar
                                      <span className="alv-boton__extra">{sugerencia}</span>
                                    </button>
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </section>
                      )
                    })}
                  </div>
                )}

                {/* ---------- Por caducar ---------- */}
                {conCaducidad && pestana === 'caducar' && listaVisible.length > 0 && (
                  <div className="alv-grupos">
                    {gruposVisibles.map((grupo) => {
                      const plegado = plegados.has(clave(grupo.nombre))

                      return (
                        <section className="alv-g" key={grupo.nombre}>
                          <CabeceraGrupo
                            grupo={grupo}
                            plegado={plegado}
                            onAlternar={() => alternarGrupo(grupo.nombre)}
                          />

                          {!plegado && (
                            <ul className="alv-filas">
                              {grupo.items.map((p) => {
                                const rojo = p.urgente || p.diasCaducar < 0

                                return (
                                  <li
                                    key={p.id}
                                    className={'alv-fila alv-fila--caducar ' + (rojo ? 'is-rojo' : 'is-ambar')}
                                  >
                                    <div className="alv-fila__producto">
                                      <span className="alv-fila__icono" aria-hidden="true">
                                        <Candy size={14} />
                                      </span>
                                      <p className="alv-fila__nombre">
                                        {p.nombre}
                                        {p.gramaje && <span className="gramaje">{p.gramaje}</span>}
                                      </p>
                                    </div>

                                    <span className="alv-fila__cantidad">
                                      <strong>{p.stock}</strong> {textoUnidad(p.unidad, p.stock)}
                                    </span>

                                    <span className={'alv-caduca' + (rojo ? ' is-urgente' : '')} title={p.caducidad}>
                                      <CalendarClock size={13} aria-hidden="true" />
                                      {textoCaducidad(p.diasCaducar)}
                                    </span>

                                    <div className="alv-fila__acciones">
                                      <button
                                        type="button"
                                        className="alv-boton alv-boton--chico"
                                        onClick={() => irAMerma(p)}
                                        title="Registrar merma"
                                      >
                                        <PackageMinus size={14} aria-hidden="true" />
                                        Merma
                                      </button>
                                      <button
                                        type="button"
                                        className="alv-boton alv-boton--chico alv-boton--primario"
                                        onClick={() => navigate(`/catalogo/${p.id}/editar`)}
                                        title="Crear promoción"
                                      >
                                        <Tag size={14} aria-hidden="true" />
                                        Promoción
                                      </button>
                                    </div>
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </section>
                      )
                    })}

                    <p className="alv-consejo">
                      <Lightbulb size={14} aria-hidden="true" />
                      <span>
                        Vende primero lo que caduca antes: acomódalo <strong>al frente del anaquel</strong> y, si le
                        quedan {DIAS_URGENTE} días o menos, ponlo en <strong>promoción</strong>. Si ya no se puede
                        vender, regístralo como <strong>merma</strong>.
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* ============ MUESTRA DEL CORREO ============ */}
        {conCorreo && (
          <aside className="alv-tarjeta alv-muestra">
            <h2 className="alv-muestra__titulo">
              <Mail size={15} aria-hidden="true" />
              Así se vería el aviso
            </h2>
            <AjustarAlAlto>
              {!cargando && !error && (
                <VistaCorreo
                  negocio={negocio}
                  correo={ajustes.correoAlertas}
                  stockBajo={stockBajo}
                  agotados={agotados}
                  porCaducar={porCaducar}
                  conCaducidad={conCaducidad}
                  diasAviso={diasAviso}
                />
              )}
            </AjustarAlAlto>
          </aside>
        )}
      </div>
      )}

      <ModalAvisos
        abierto={modalAbierto}
        onCerrar={cerrarModal}
        conCorreo={conCorreo}
        correo={ajustes.correoAlertas}
        estado={estado}
        proximaRevision={proximaRevision}
        enLinea={enLinea}
        enviando={enviando}
        onEnviar={enviarAhora}
        onConfigurar={() => navigate('/configuracion', { state: { seccion: 'email' } })}
      />
    </div>
  )
}
