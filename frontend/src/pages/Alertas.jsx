import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mail,
  Clock,
  Send,
  AlertTriangle,
  CalendarClock,
  Truck,
  PackageMinus,
  Tag,
  WifiOff,
  Lightbulb,
  CheckCircle2,
  Loader2,
  RotateCcw,
  ChevronDown,
} from 'lucide-react'

import { useAjustes } from '../hooks/useConfiguracion'
import { listarProductos, mensajeDeError } from '../services/productos'
import { enviarResumenCorreo } from '../services/alertas'
import { notificar } from '../services/notificar'
import { textoUnidad } from '../utils/unidades'
import '../styles/alertas.css'

const MAX_EN_MENSAJE = 3

const formatoDiaMes = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' })

// "20:00" -> "8:00 p.m."
function horaBonita(hhmm) {
  const [h, m] = (hhmm || '20:00').split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'p.m.' : 'a.m.'}`
}

function textoCaducidad(dias) {
  if (dias < 0) {
    const pasaron = Math.abs(dias)
    return `Caducó hace ${pasaron} ${pasaron === 1 ? 'día' : 'días'}`
  }
  if (dias === 0) return 'Caduca hoy'
  return `En ${dias} ${dias === 1 ? 'día' : 'días'}`
}

// Agrupa por categoría respetando el orden de la lista (la más urgente primero)
function agruparPorCategoria(lista) {
  const grupos = new Map()

  lista.forEach((p) => {
    if (!grupos.has(p.categoria)) grupos.set(p.categoria, { nombre: p.categoria, items: [] })
    grupos.get(p.categoria).items.push(p)
  })

  return [...grupos.values()]
}

/* ---------- Encabezado de un grupo (se pliega con un clic) ---------- */

function CabeceraGrupo({ grupo, plegado, onAlternar, extra }) {
  return (
    <button type="button" className="al-g__cabecera" onClick={onAlternar} aria-expanded={!plegado}>
      <ChevronDown size={16} className={'al-g__chevron' + (plegado ? ' is-plegado' : '')} aria-hidden="true" />
      <span className="al-g__nombre">{grupo.nombre}</span>
      <span className="al-g__conteo">{grupo.items.length}</span>
      {extra}
    </button>
  )
}

export default function Alertas() {
  const navigate = useNavigate()

  // Lo que el propietario configuró: caducidad, días de aviso y correo
  const ajustes = useAjustes()
  const diasAviso = ajustes.diasAviso
  const conCaducidad = ajustes.maneja_caducidad
  const conCorreo = ajustes.alertas_activas
  const hora = horaBonita(ajustes.horaResumen)

  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [pestana, setPestana] = useState('stock')
  const [plegados, setPlegados] = useState(() => new Set())
  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const [enviando, setEnviando] = useState(false)

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

  useEffect(() => {
    cargarProductos()
  }, [])

  // Si apagan la caducidad estando en esa pestaña, regresa a "Stock bajo"
  useEffect(() => {
    if (!conCaducidad && pestana === 'caducar') setPestana('stock')
  }, [conCaducidad, pestana])

  // Detecta si hay internet, para el estado del resumen
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
        .map((p) => ({ ...p, urgente: p.diasCaducar <= 7 }))
        .sort((a, b) => a.diasCaducar - b.diasCaducar),
    [activos, conCaducidad, diasAviso]
  )

  const gruposStock = useMemo(() => agruparPorCategoria(stockBajo), [stockBajo])
  const gruposCaducar = useMemo(() => agruparPorCategoria(porCaducar), [porCaducar])
  const gruposVisibles = pestana === 'stock' ? gruposStock : gruposCaducar
  const agotados = stockBajo.filter((p) => p.stock === 0).length

  /* ---------- Plegar / desplegar ---------- */

  const clave = (nombre) => `${pestana}:${nombre}`
  const todoPlegado = gruposVisibles.length > 0 && gruposVisibles.every((g) => plegados.has(clave(g.nombre)))

  function alternarGrupo(nombre) {
    setPlegados((actual) => {
      const copia = new Set(actual)
      const k = clave(nombre)
      copia.has(k) ? copia.delete(k) : copia.add(k)
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
      notificar({
        tipo: 'ok',
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
        texto: textos[codigo] || (e.response?.status === 403
          ? 'Solo el propietario puede enviar el resumen por correo.'
          : 'No se pudo enviar el resumen. Inténtalo de nuevo.'),
      })
    } finally {
      setEnviando(false)
    }
  }

  /* ---------- Vista previa del correo ---------- */

  const hoy = new Date()
  const stockEnMensaje = stockBajo.slice(0, MAX_EN_MENSAJE)
  const caducarEnMensaje = porCaducar.slice(0, MAX_EN_MENSAJE)

  return (
    <div className="al">
      {/* ============ ENCABEZADO ============ */}
      <header className="al-encabezado">
        <div>
          <h1 className="al-titulo">Alertas</h1>
          <p className="al-subtitulo">
            {conCaducidad ? 'Lo que se está acabando y lo que está por caducar' : 'Lo que se está acabando'}
          </p>
        </div>

        {!cargando && !error && (
          <div className="al-pastillas">
            <span className="al-pastilla al-pastilla--ambar">
              <AlertTriangle size={14} aria-hidden="true" />
              {stockBajo.length} con stock bajo
            </span>
            {conCaducidad && (
              <span className="al-pastilla al-pastilla--rojo">
                <CalendarClock size={14} aria-hidden="true" />
                {porCaducar.length} por caducar
              </span>
            )}
          </div>
        )}
      </header>

      {/* ============ RESUMEN POR CORREO ============ */}
      {conCorreo && (
        <section className="al-correo">
          <span className="al-correo__icono" aria-hidden="true">
            <Mail size={24} />
          </span>

          <div className="al-correo__info">
            <p className="al-correo__titulo">Resumen diario por correo</p>
            <p className="al-correo__texto">
              Un correo al día a las <strong>{hora}</strong> con lo que se acaba{conCaducidad ? ' y lo que caduca' : ''}.
            </p>
          </div>

          <div className="al-correo__estado">
            {enLinea ? (
              <span className="al-proximo">
                <Clock size={14} aria-hidden="true" />
                Próximo envío: hoy a las {hora}
              </span>
            ) : (
              <span className="al-pendiente">
                <WifiOff size={14} aria-hidden="true" />
                Sin internet · se enviará al recuperar conexión
              </span>
            )}
          </div>

          <div className="al-correo__acciones">
            <button
              type="button"
              className="al-boton"
              onClick={enviarAhora}
              disabled={!enLinea || enviando}
              title={enLinea ? 'Manda el resumen de hoy en este momento' : 'Necesitas internet para enviarlo'}
            >
              {enviando ? <Loader2 size={14} className="al-girando" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
              {enviando ? 'Enviando…' : 'Enviar ahora'}
            </button>
            <button type="button" className="al-enlace" onClick={() => navigate('/configuracion')}>
              Cambiar horario o correo
            </button>
          </div>
        </section>
      )}

      <div className={'al-grid' + (conCorreo ? '' : ' al-grid--sola')}>
        {/* ============ LISTAS ============ */}
        <section className="al-panel">
          {cargando ? (
            <div className="al-vacio">
              <Loader2 size={26} className="al-girando" aria-hidden="true" />
              Revisando tu inventario…
            </div>
          ) : error ? (
            <div className="al-vacio al-vacio--error">
              <WifiOff size={26} aria-hidden="true" />
              {error}
              <button type="button" className="al-boton" onClick={cargarProductos}>
                <RotateCcw size={14} aria-hidden="true" />
                Reintentar
              </button>
            </div>
          ) : (
            <>
              <div className="al-barra-herramientas">
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
                  {conCaducidad && (
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
                  )}
                </div>

                {gruposVisibles.length > 1 && (
                  <button type="button" className="al-enlace" onClick={alternarTodo}>
                    {todoPlegado ? 'Expandir todo' : 'Contraer todo'}
                  </button>
                )}
              </div>

              {pestana === 'stock' && stockBajo.length > 0 && (
                <p className="al-resumen-linea">
                  {agotados > 0 && (
                    <>
                      <strong className="al-texto-rojo">
                        {agotados} {agotados === 1 ? 'agotado' : 'agotados'}
                      </strong>
                      {' · '}
                    </>
                  )}
                  {stockBajo.length - agotados} por debajo del mínimo · en {gruposStock.length}{' '}
                  {gruposStock.length === 1 ? 'categoría' : 'categorías'}
                </p>
              )}

              {/* ---------- Stock bajo ---------- */}
              {pestana === 'stock' &&
                (stockBajo.length === 0 ? (
                  <div className="al-vacio">
                    <CheckCircle2 size={26} aria-hidden="true" />
                    Todo tu inventario está arriba del mínimo.
                  </div>
                ) : (
                  <div className="al-grupos">
                    {gruposStock.map((grupo) => {
                      const plegado = plegados.has(clave(grupo.nombre))
                      const agotadosGrupo = grupo.items.filter((p) => p.stock === 0).length

                      return (
                        <section className="al-g" key={grupo.nombre}>
                          <CabeceraGrupo
                            grupo={grupo}
                            plegado={plegado}
                            onAlternar={() => alternarGrupo(grupo.nombre)}
                            extra={
                              agotadosGrupo > 0 && (
                                <span className="al-chip al-chip--rojo">
                                  {agotadosGrupo} {agotadosGrupo === 1 ? 'agotado' : 'agotados'}
                                </span>
                              )
                            }
                          />

                          {!plegado && (
                            <ul className="al-filas">
                              {grupo.items.map((p) => {
                                const agotado = p.stock === 0

                                return (
                                  <li key={p.id} className={'al-fila al-fila--stock' + (agotado ? ' is-agotado' : '')}>
                                    <div className="al-fila__producto">
                                      <span className="al-fila__icono" aria-hidden="true">
                                        <Candy size={15} />
                                      </span>
                                      <div>
                                        <p className="al-fila__nombre">
                                          {p.nombre}
                                          {p.gramaje && <span className="gramaje">{p.gramaje}</span>}
                                        </p>
                                        {agotado && <span className="al-chip al-chip--rojo">Agotado</span>}
                                      </div>
                                    </div>

                                    <div className="al-fila__nivel" title={`${p.porcentaje}% del stock mínimo`}>
                                      <span className="al-fila__cantidad">
                                        <strong>{p.stock}</strong> / {p.minimo} {textoUnidad(p.unidad, p.minimo)}
                                      </span>
                                      <span className="al-mini-barra" aria-hidden="true">
                                        <span style={{ width: `${Math.min(p.porcentaje, 100)}%` }} />
                                      </span>
                                    </div>

                                    <span className="al-fila__faltan">
                                      Faltan {p.faltan} {textoUnidad(p.unidad, p.faltan)}
                                    </span>

                                    <span className="al-fila__sugerido">
                                      <Lightbulb size={13} aria-hidden="true" />
                                      {p.empaques
                                        ? `${p.empaques} ${textoUnidad(p.empaqueNombre, p.empaques, true)} · ${p.aComprar} ${textoUnidad(p.unidad, p.aComprar)}`
                                        : `${p.sugerido} ${textoUnidad(p.unidad, p.sugerido)}`}
                                    </span>

                                    <button
                                      type="button"
                                      className={'al-boton al-boton--chico' + (agotado ? ' al-boton--primario' : '')}
                                      onClick={() => irACompra(p)}
                                      title="Registrar compra"
                                    >
                                      <Truck size={14} aria-hidden="true" />
                                      Comprar
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
                ))}

              {/* ---------- Por caducar ---------- */}
              {conCaducidad &&
                pestana === 'caducar' &&
                (porCaducar.length === 0 ? (
                  <div className="al-vacio">
                    <CheckCircle2 size={26} aria-hidden="true" />
                    Nada caduca en los próximos {diasAviso} días.
                  </div>
                ) : (
                  <div className="al-grupos">
                    {gruposCaducar.map((grupo) => {
                      const plegado = plegados.has(clave(grupo.nombre))

                      return (
                        <section className="al-g" key={grupo.nombre}>
                          <CabeceraGrupo
                            grupo={grupo}
                            plegado={plegado}
                            onAlternar={() => alternarGrupo(grupo.nombre)}
                          />

                          {!plegado && (
                            <ul className="al-filas">
                              {grupo.items.map((p) => (
                                <li key={p.id} className="al-fila al-fila--caducar">
                                  <div className="al-fila__producto">
                                    <span className="al-fila__icono" aria-hidden="true">
                                      <Candy size={15} />
                                    </span>
                                    <p className="al-fila__nombre">
                                      {p.nombre}
                                      {p.gramaje && <span className="gramaje">{p.gramaje}</span>}
                                    </p>
                                  </div>

                                  <span className="al-fila__cantidad">
                                    <strong>{p.stock}</strong> {textoUnidad(p.unidad, p.stock)} en tienda
                                  </span>

                                  <span className={'al-caduca' + (p.urgente || p.diasCaducar < 0 ? ' is-urgente' : '')}>
                                    <CalendarClock size={13} aria-hidden="true" />
                                    {textoCaducidad(p.diasCaducar)}
                                    <span>· {p.caducidad}</span>
                                  </span>

                                  <div className="al-fila__acciones">
                                    <button
                                      type="button"
                                      className="al-boton al-boton--chico"
                                      onClick={() => irAMerma(p)}
                                      title="Registrar merma"
                                    >
                                      <PackageMinus size={14} aria-hidden="true" />
                                      Merma
                                    </button>
                                    <button
                                      type="button"
                                      className="al-boton al-boton--chico al-boton--primario"
                                      onClick={() => navigate(`/catalogo/${p.id}/editar`)}
                                      title="Crear promoción"
                                    >
                                      <Tag size={14} aria-hidden="true" />
                                      Promoción
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </section>
                      )
                    })}

                    <p className="al-consejo">
                      <Lightbulb size={14} aria-hidden="true" />
                      Lo que caduca en 7 días o menos sale en rojo: ponlo en promoción, y si ya no se puede vender,
                      regístralo como merma.
                    </p>
                  </div>
                ))}
            </>
          )}
        </section>

        {/* ============ VISTA PREVIA DEL CORREO ============ */}
        {conCorreo && (
          <aside className="al-lateral">
            <section className="al-panel">
              <h2 className="al-lateral__titulo">
                <Mail size={17} aria-hidden="true" />
                Así luce el correo
              </h2>
              <p className="al-lateral__texto">
                Un resumen diario con el estado del inventario para que planees tu surtido.
              </p>

              <article className="al-email">
                <div className="al-email__cabecera">
                  <p className="al-email__de"><strong>De:</strong> INVENTIA</p>
                  <p className="al-email__para"><strong>Para:</strong> {ajustes.correoAlertas || 'tu correo'}</p>
                  <p className="al-email__asunto">INVENTIA · Resumen del {formatoDiaMes.format(hoy)}</p>
                </div>
                <div className="al-email__cuerpo">
                  <p>Hola, este es el resumen de tu inventario:</p>
                  <p className="al-email__seccion"><strong>Stock bajo ({stockBajo.length})</strong></p>
                  {stockBajo.length === 0 ? <p>Todo surtido.</p> : (
                    <ul>{stockEnMensaje.map((p) => (
                      <li key={p.id}>{p.nombre}: {p.stock === 0 ? <strong>agotado</strong> : `quedan ${p.stock}`}</li>
                    ))}</ul>
                  )}
                  {stockBajo.length > MAX_EN_MENSAJE && <p>…y {stockBajo.length - MAX_EN_MENSAJE} más</p>}
                  {conCaducidad && (
                    <>
                      <p className="al-email__seccion"><strong>Por caducar ({porCaducar.length})</strong></p>
                      {porCaducar.length === 0 ? <p>Nada en los próximos {diasAviso} días.</p> : (
                        <ul>{caducarEnMensaje.map((p) => (
                          <li key={p.id}>{p.nombre}: {p.diasCaducar} días ({p.stock} {textoUnidad(p.unidad, p.stock)})</li>
                        ))}</ul>
                      )}
                      {porCaducar.length > MAX_EN_MENSAJE && <p>…y {porCaducar.length - MAX_EN_MENSAJE} más</p>}
                    </>
                  )}
                  <p className="al-email__firma">INVENTIA · Inventario de tu negocio</p>
                </div>
              </article>
            </section>

            <p className="al-nota">
              <WifiOff size={17} aria-hidden="true" />
              <span>
                <strong>El envío requiere conexión a internet.</strong> Si la conexión se interrumpe, el resumen queda pendiente y el sistema vuelve a intentarlo.
              </span>
            </p>
          </aside>
        )}
      </div>
    </div>
  )
}
