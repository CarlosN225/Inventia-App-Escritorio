import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MessageCircle,
  Check,
  CheckCheck,
  Clock,
  Send,
  AlertTriangle,
  CalendarClock,
  Candy,
  Truck,
  PackageMinus,
  Tag,
  WifiOff,
  Lightbulb,
  CheckCircle2,
  X,
} from 'lucide-react'

import '../styles/alertas.css'

/* ============================================================
   ESTADO INICIAL — Todo vacío hasta conectar el backend
   ------------------------------------------------------------
   PRODUCTOS:         catálogo de productos
   DETALLES:          info extra por producto (máximo, empaque, etc.)
   CONFIG_WHATSAPP:   viene de Configuración del negocio
   ============================================================ */
const PRODUCTOS = []
const DETALLES = {}

const CONFIG_WHATSAPP = {
  hora: '8:00 p.m.',
  numero: 'Sin configurar',
  ultimoEnvio: null,
}

const DIAS_AVISO_CADUCIDAD = 30
const MAX_EN_MENSAJE = 3

const formatoFecha = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
const formatoDiaMes = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' })
const formatoChat = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

/* ============ Utilidades ============ */

// TODO: cuando el backend esté listo, `unidadDe` y `textoUnidad` vienen del backend
function unidadDe() { return 'pza' }
function textoUnidad(unidad, cantidad) {
  return cantidad === 1 ? unidad : `${unidad}s`
}

function sumarDias(dias) {
  const fecha = new Date()
  fecha.setHours(0, 0, 0, 0)
  fecha.setDate(fecha.getDate() + dias)
  return fecha
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/* ============ Pantalla ============ */

export default function Alertas() {
  const navigate = useNavigate()

  const [pestana, setPestana] = useState('stock')
  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const [enviado, setEnviado] = useState(false)

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

  /* ---------- Stock bajo ---------- */

  const stockBajo = useMemo(
    () =>
      PRODUCTOS.filter((p) => p.stock < p.minimo)
        .map((p) => {
          const detalles = DETALLES[p.id]
          const unidad = unidadDe(p.id)
          const objetivo = detalles?.maximo ?? p.minimo * 2
          const sugerido = Math.max(objetivo - p.stock, 1)
          const porEmpaque = detalles?.piezasEmpaque ?? null
          const empaques = porEmpaque ? Math.ceil(sugerido / porEmpaque) : null

          return {
            ...p,
            unidad,
            faltan: p.minimo - p.stock,
            porcentaje: Math.round((p.stock / p.minimo) * 100),
            sugerido,
            porEmpaque,
            empaque: detalles?.empaque ?? 'caja',
            empaques,
            piezasACompra: empaques ? empaques * porEmpaque : sugerido,
          }
        })
        .sort((a, b) => a.porcentaje - b.porcentaje),
    []
  )

  /* ---------- Por caducar ---------- */

  const porCaducar = useMemo(
    () =>
      PRODUCTOS.filter(
        (p) => p.diasCaducar !== null && p.diasCaducar <= DIAS_AVISO_CADUCIDAD && p.stock > 0
      )
        .map((p) => ({
          ...p,
          unidad: unidadDe(p.id),
          fecha: sumarDias(p.diasCaducar),
          urgente: p.diasCaducar <= 7,
        }))
        .sort((a, b) => a.diasCaducar - b.diasCaducar),
    []
  )

  /* ---------- Acciones ---------- */

  function irACompra(p) {
    navigate('/registrar-compra', { state: { agregar: { id: p.id, piezas: p.piezasACompra } } })
  }

  function irAMerma(p) {
    navigate('/registrar-merma', { state: { productoId: p.id } })
  }

  function enviarAhora() {
    // TODO: pedirle al backend que mande el resumen por WhatsApp (Twilio)
    setEnviado(true)
  }

  /* ---------- Mensaje de WhatsApp ---------- */

  const hoy = new Date()
  const stockEnMensaje = stockBajo.slice(0, MAX_EN_MENSAJE)
  const caducarEnMensaje = porCaducar.slice(0, MAX_EN_MENSAJE)
  const configurado = CONFIG_WHATSAPP.numero !== 'Sin configurar'

  return (
    <div className="al">
      {/* ============ ENCABEZADO ============ */}
      <header className="al-encabezado">
        <div>
          <h1 className="al-titulo">Alertas</h1>
          <p className="al-subtitulo">Lo que se está acabando y lo que está por caducar</p>
        </div>

        <div className="al-pastillas">
          <span className="al-pastilla al-pastilla--ambar">
            <AlertTriangle size={14} aria-hidden="true" />
            {stockBajo.length} con stock bajo
          </span>
          <span className="al-pastilla al-pastilla--rojo">
            <CalendarClock size={14} aria-hidden="true" />
            {porCaducar.length} por caducar
          </span>
        </div>
      </header>

      {/* ============ RESUMEN DE WHATSAPP ============ */}
      <section className="al-wa">
        <span className="al-wa__icono" aria-hidden="true">
          <MessageCircle size={24} />
        </span>

        <div className="al-wa__info">
          <p className="al-wa__titulo">Resumen diario por WhatsApp</p>
          {configurado ? (
            <p className="al-wa__texto">
              Un solo mensaje todos los días a las <strong>{CONFIG_WHATSAPP.hora}</strong> al{' '}
              <strong>{CONFIG_WHATSAPP.numero}</strong>, con lo que se acaba y lo que caduca.
            </p>
          ) : (
            <p className="al-wa__texto">
              Aún no configuras el número de WhatsApp ni el horario de envío. Ve a{' '}
              <strong>Configuración</strong> para activarlo.
            </p>
          )}
        </div>

        {configurado && (
          <div className="al-wa__estado">
            <span className="al-wa__linea">
              {CONFIG_WHATSAPP.ultimoEnvio ? (
                <>
                  Último envío: {CONFIG_WHATSAPP.ultimoEnvio}
                  <span className="al-enviado">
                    <Check size={11} strokeWidth={3} aria-hidden="true" />
                    Enviado
                  </span>
                </>
              ) : (
                <>
                  Sin envíos todavía
                </>
              )}
            </span>

            {enLinea ? (
              <span className="al-proximo">
                <Clock size={14} aria-hidden="true" />
                Próximo envío: hoy a las {CONFIG_WHATSAPP.hora}
              </span>
            ) : (
              <span className="al-pendiente">
                <WifiOff size={14} aria-hidden="true" />
                1 resumen pendiente · se enviará al recuperar conexión
              </span>
            )}
          </div>
        )}

        <div className="al-wa__acciones">
          <button
            type="button"
            className="al-boton"
            onClick={enviarAhora}
            disabled={!enLinea || !configurado}
            title={
              !configurado
                ? 'Primero configura el WhatsApp en Configuración'
                : enLinea
                ? 'Manda el resumen de hoy en este momento'
                : 'Necesitas internet para enviarlo'
            }
          >
            <Send size={14} aria-hidden="true" />
            Enviar ahora
          </button>
          <button type="button" className="al-enlace" onClick={() => navigate('/configuracion')}>
            {configurado ? 'Cambiar horario o número' : 'Configurar WhatsApp'}
          </button>
        </div>
      </section>

      {enviado && (
        <div className="al-aviso" role="status">
          <CheckCircle2 size={17} aria-hidden="true" />
          <span>
            <strong>Resumen enviado</strong> al {CONFIG_WHATSAPP.numero}
          </span>
          <button type="button" aria-label="Cerrar aviso" onClick={() => setEnviado(false)}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="al-grid">
        {/* ============ LISTAS ============ */}
        <section className="al-panel">
          <div className="al-pestanas" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={pestana === 'stock'}
              className={pestana === 'stock' ? 'is-activo' : ''}
              onClick={() => setPestana('stock')}
            >
              <AlertTriangle size={15} aria-hidden="true" />
              Stock bajo
              <span className="al-contador al-contador--ambar">{stockBajo.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pestana === 'caducar'}
              className={pestana === 'caducar' ? 'is-activo' : ''}
              onClick={() => setPestana('caducar')}
            >
              <CalendarClock size={15} aria-hidden="true" />
              Por caducar
              <span className="al-contador al-contador--rojo">{porCaducar.length}</span>
            </button>
          </div>

          {/* ---------- Stock bajo ---------- */}
          {pestana === 'stock' &&
            (stockBajo.length === 0 ? (
              <div className="al-vacio">
                <CheckCircle2 size={26} aria-hidden="true" />
                {PRODUCTOS.length === 0
                  ? 'Aún no tienes productos registrados.'
                  : 'Todo tu inventario está arriba del mínimo.'}
              </div>
            ) : (
              <ul className="al-lista">
                {stockBajo.map((p) => {
                  const agotado = p.stock === 0

                  return (
                    <li key={p.id} className={'al-item' + (agotado ? ' is-critico' : '')}>
                      <span className="al-placeholder" aria-hidden="true">
                        <Candy size={20} />
                      </span>

                      <div className="al-item__cuerpo">
                        <div className="al-item__arriba">
                          <div>
                            <p className="al-item__nombre">
                              {p.nombre}
                              {agotado && <span className="al-chip al-chip--rojo">Agotado</span>}
                            </p>
                            <p className="al-item__marca">
                              {p.marca} · {p.categoria}
                            </p>
                          </div>

                          <button
                            type="button"
                            className={'al-boton' + (agotado ? ' al-boton--primario' : '')}
                            onClick={() => irACompra(p)}
                          >
                            <Truck size={14} aria-hidden="true" />
                            Registrar compra
                          </button>
                        </div>

                        <div>
                          <div className="al-barra__textos">
                            <span>
                              Quedan <strong>{p.stock}</strong> · mínimo {p.minimo}{' '}
                              {textoUnidad(p.unidad, p.minimo)}
                            </span>
                            <span className="al-barra__faltan">
                              Faltan {p.faltan} {textoUnidad(p.unidad, p.faltan)}
                            </span>
                          </div>
                          <div className="al-barra" aria-hidden="true">
                            <div
                              className="al-barra__relleno"
                              style={{ width: `${Math.min(p.porcentaje, 100)}%` }}
                            />
                          </div>
                          <p className="al-barra__pie">{p.porcentaje}% del stock mínimo</p>
                        </div>

                        <p className="al-sugerencia">
                          <Lightbulb size={14} aria-hidden="true" />
                          <span>
                            <strong>Sugerido:</strong>{' '}
                            {p.empaques
                              ? `comprar ${p.empaques} ${textoUnidad(p.empaque, p.empaques)} (${p.piezasACompra} ${textoUnidad(
                                  p.unidad,
                                  p.piezasACompra
                                )}) para llegar a tu máximo.`
                              : `comprar ${p.sugerido} ${textoUnidad(p.unidad, p.sugerido)} para llegar a tu máximo.`}
                          </span>
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ))}

          {/* ---------- Por caducar ---------- */}
          {pestana === 'caducar' &&
            (porCaducar.length === 0 ? (
              <div className="al-vacio">
                <CheckCircle2 size={26} aria-hidden="true" />
                {PRODUCTOS.length === 0
                  ? 'Aún no tienes productos registrados.'
                  : `Nada caduca en los próximos ${DIAS_AVISO_CADUCIDAD} días.`}
              </div>
            ) : (
              <ul className="al-lista">
                {porCaducar.map((p) => (
                  <li key={p.id} className={'al-item' + (p.urgente ? ' is-critico' : '')}>
                    <span className="al-placeholder" aria-hidden="true">
                      <Candy size={20} />
                    </span>

                    <div className="al-item__cuerpo">
                      <div className="al-item__arriba">
                        <div>
                          <p className="al-item__nombre">{p.nombre}</p>
                          <p className="al-item__marca">
                            {p.marca} · {p.categoria} · {p.stock} {textoUnidad(p.unidad, p.stock)} en tienda
                          </p>
                        </div>

                        <div className="al-item__acciones">
                          <button type="button" className="al-boton" onClick={() => irAMerma(p)}>
                            <PackageMinus size={14} aria-hidden="true" />
                            Registrar merma
                          </button>
                          <button
                            type="button"
                            className="al-boton al-boton--primario"
                            onClick={() => navigate(`/catalogo/${p.id}/editar`)}
                          >
                            <Tag size={14} aria-hidden="true" />
                            Crear promoción
                          </button>
                        </div>
                      </div>

                      <span className={'al-caduca' + (p.urgente ? ' is-urgente' : '')}>
                        <CalendarClock size={13} aria-hidden="true" />
                        Caduca en {p.diasCaducar} {p.diasCaducar === 1 ? 'día' : 'días'}
                        <span>· {formatoFecha.format(p.fecha)}</span>
                      </span>

                      <p className="al-sugerencia">
                        <Lightbulb size={14} aria-hidden="true" />
                        <span>
                          {p.urgente
                            ? 'Ponlo en promoción para venderlo antes de que caduque. Si ya no se puede vender, regístralo como merma.'
                            : 'Todavía hay tiempo: acomódalo al frente del anaquel para que salga primero.'}
                        </span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ))}
        </section>

        {/* ============ VISTA PREVIA ============ */}
        <aside className="al-lateral">
          <section className="al-panel">
            <h2 className="al-lateral__titulo">
              <MessageCircle size={17} aria-hidden="true" />
              Así llega a tu WhatsApp
            </h2>
            <p className="al-lateral__texto">
              Sin spam: un solo mensaje al día con todo junto, para que planees tu surtido sin abrir la app.
            </p>

            <div className="al-chat">
              <div className="al-chat__cabecera">
                <span className="al-chat__avatar" aria-hidden="true">
                  <Candy size={16} />
                </span>
                <div>
                  <p className="al-chat__nombre">INVENTIA</p>
                  <p className="al-chat__sub">Avisos de tu negocio</p>
                </div>
              </div>

              <div className="al-chat__fondo">
                <span className="al-chat__fecha">{capitalizar(formatoChat.format(hoy))}</span>

                <div className="al-burbuja">
                  <p>
                    <strong>INVENTIA · Resumen del {formatoDiaMes.format(hoy)}</strong>
                  </p>

                  {PRODUCTOS.length === 0 ? (
                    <p className="al-burbuja__seccion">
                      Aún no tienes productos registrados. En cuanto agregues tu catálogo, aquí verás el resumen
                      diario con lo que se agota y lo que caduca.
                    </p>
                  ) : (
                    <>
                      <p className="al-burbuja__seccion">
                        <strong>Stock bajo ({stockBajo.length}):</strong>
                      </p>
                      {stockBajo.length === 0 ? (
                        <p>Todo surtido.</p>
                      ) : (
                        <ul>
                          {stockEnMensaje.map((p) => (
                            <li key={p.id}>
                              {p.nombre}: {p.stock === 0 ? <strong>agotado</strong> : `quedan ${p.stock}`}
                            </li>
                          ))}
                        </ul>
                      )}
                      {stockBajo.length > MAX_EN_MENSAJE && (
                        <p className="al-burbuja__mas">…y {stockBajo.length - MAX_EN_MENSAJE} más</p>
                      )}

                      <p className="al-burbuja__seccion">
                        <strong>Por caducar ({porCaducar.length}):</strong>
                      </p>
                      {porCaducar.length === 0 ? (
                        <p>Nada en los próximos {DIAS_AVISO_CADUCIDAD} días.</p>
                      ) : (
                        <ul>
                          {caducarEnMensaje.map((p) => (
                            <li key={p.id}>
                              {p.nombre}: {p.diasCaducar} días ({p.stock} {textoUnidad(p.unidad, p.stock)})
                            </li>
                          ))}
                        </ul>
                      )}
                      {porCaducar.length > MAX_EN_MENSAJE && (
                        <p className="al-burbuja__mas">…y {porCaducar.length - MAX_EN_MENSAJE} más</p>
                      )}
                    </>
                  )}

                  <p className="al-burbuja__hora">
                    {CONFIG_WHATSAPP.hora}
                    <CheckCheck size={14} aria-hidden="true" />
                  </p>
                </div>
              </div>
            </div>
          </section>

          <p className="al-nota">
            <WifiOff size={17} aria-hidden="true" />
            <span>
              <strong>Funciona aunque no haya internet.</strong> Si a la hora del envío tu negocio no tiene conexión, el
              resumen se guarda y se manda solito en cuanto regrese la señal.
            </span>
          </p>
        </aside>
      </div>
    </div>
  )
}