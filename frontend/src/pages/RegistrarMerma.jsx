import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Search,
  X,
  Plus,
  Minus,
  Check,
  CheckCircle2,
  AlertCircle,
  Candy,
  CalendarX,
  PackageX,
  Cookie,
  Undo2,
  MoreHorizontal,
  Info,
  TrendingDown,
  CalendarDays,
  ArrowUpRight,
  ArrowRight,
  Lightbulb,
  Loader2,
  RotateCcw,
} from 'lucide-react'

import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { getUsuarioActual } from '../services/auth'
import { listarProductos, mensajeDeError } from '../services/productos'
import { listarMovimientos, registrarMovimiento, mensajeDelBackend } from '../services/movimientos'
import { textoUnidad } from '../utils/unidades'
import '../styles/registrar-merma.css'

const MAX_RESULTADOS = 5

// Los ids son los que acepta el backend (MOTIVO_MERMA_CHOICES)
const MOTIVOS = [
  { id: 'caducado', label: 'Caducado', desc: 'Fecha vencida', icono: CalendarX, color: '#dc2626' },
  { id: 'danado', label: 'Dañado', desc: 'Roto o aplastado', icono: PackageX, color: '#f59e0b' },
  { id: 'consumo_propio', label: 'Consumo propio', desc: 'Lo usó el negocio', icono: Cookie, color: '#14b8a6' },
  { id: 'devolucion_proveedor', label: 'Devolución', desc: 'Se regresa al proveedor', icono: Undo2, color: '#6366f1' },
  { id: 'otro', label: 'Otro', desc: 'Explícalo en la nota', icono: MoreHorizontal, color: '#94a3b8' },
]

const MOTIVOS_POR_ID = Object.fromEntries(MOTIVOS.map((m) => [m.id, m]))

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const mesActual = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date())
const formatoHora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })

function normalizar(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function redondear(n) {
  return Math.round(n * 100) / 100
}

function esHoy(fecha) {
  const f = new Date(fecha)
  const hoy = new Date()
  return f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth() && f.getDate() === hoy.getDate()
}

function esEsteMes(fecha) {
  const f = new Date(fecha)
  const hoy = new Date()
  return f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth()
}

function PastillaStock({ producto }) {
  const unidad = textoUnidad(producto.unidad, producto.stock)
  if (producto.stock === 0) return <span className="rm-stock rm-stock--agotado">Agotado</span>
  if (producto.stock < producto.minimo) {
    return (
      <span className="rm-stock rm-stock--bajo">
        Hay {producto.stock} {unidad} · Stock bajo
      </span>
    )
  }
  return (
    <span className="rm-stock rm-stock--ok">
      Hay {producto.stock} {unidad}
    </span>
  )
}

function NumeroPaso({ numero, completo }) {
  return (
    <span className="rm-paso__numero" aria-hidden="true">
      {completo ? <Check size={17} strokeWidth={3} /> : numero}
    </span>
  )
}

export default function RegistrarMerma() {
  const navigate = useNavigate()
  const location = useLocation()
  const buscadorRef = useRef(null)

  // Datos del backend
  const [productos, setProductos] = useState([])
  const [mermas, setMermas] = useState([]) // movimientos de tipo merma
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)
  const [usuarioActual, setUsuarioActual] = useState(null)

  // Formulario
  const [busqueda, setBusqueda] = useState('')
  const [resaltado, setResaltado] = useState(0)
  const [productoId, setProductoId] = useState(null)
  const [cantidad, setCantidad] = useState(1)
  const [motivo, setMotivo] = useState(null)
  const [nota, setNota] = useState('')
  const [intento, setIntento] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [registrada, setRegistrada] = useState(null)
  const [errorGuardar, setErrorGuardar] = useState(null)

  async function cargarDatos() {
    setCargando(true)
    setErrorCarga(null)

    try {
      const [listaProductos, listaMovimientos] = await Promise.all([listarProductos(), listarMovimientos()])
      setProductos(listaProductos.filter((p) => p.activo))
      setMermas(listaMovimientos.filter((m) => m.tipo === 'merma'))
    } catch (e) {
      setErrorCarga(mensajeDeError(e))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    getUsuarioActual()
      .then(setUsuarioActual)
      .catch(() => setUsuarioActual(null))

    cargarDatos()
  }, [])

  // Si viene de Alertas, deja el producto ya elegido (cuando ya cargaron los productos)
  useEffect(() => {
    const id = location.state?.productoId
    if (!id || cargando) return

    const producto = productos.find((p) => p.id === id)
    if (producto && producto.stock > 0) setProductoId(id)

    navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando])

  const esPropietario = usuarioActual?.rol === 'propietario'
  const productosPorId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])
  const producto = productoId ? productosPorId.get(productoId) ?? null : null
  const disponible = producto ? producto.stock : 0

  /* ---------- Paso 1: producto ---------- */

  const resultados = useMemo(() => {
    const texto = normalizar(busqueda.trim())
    if (!texto) return []
    return productos
      .filter((p) => normalizar(`${p.nombre} ${p.marca}`).includes(texto))
      .slice(0, MAX_RESULTADOS)
  }, [busqueda, productos])

  const indiceResaltado = Math.min(resaltado, Math.max(resultados.length - 1, 0))

  function cambiarBusqueda(valor) {
    setBusqueda(valor)
    setResaltado(0)
  }

  function elegirProducto(id) {
    const p = productosPorId.get(id)
    if (!p || p.stock === 0) return
    setProductoId(id)
    setCantidad(1)
    cambiarBusqueda('')
    setRegistrada(null)
    setErrorGuardar(null)
  }

  function cambiarProducto() {
    setProductoId(null)
    setCantidad(1)
    setErrorGuardar(null)
    setTimeout(() => buscadorRef.current?.focus(), 0)
  }

  function teclaBuscador(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setResaltado((i) => Math.min(i + 1, resultados.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setResaltado((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const p = resultados[indiceResaltado]
      if (p) elegirProducto(p.id)
    } else if (event.key === 'Escape') {
      cambiarBusqueda('')
    }
  }

  /* ---------- Paso 2: cantidad ---------- */

  function cambiarCantidad(n) {
    if (!Number.isFinite(n) || n < 1) return
    setCantidad(n)
  }

  /* ---------- Validaciones y cálculos ---------- */

  const cantidadValida = !!producto && cantidad >= 1 && cantidad <= disponible
  const faltaNota = motivo === 'otro' && !nota.trim()
  const costoUnitario = producto?.costo ?? null // null para el encargado
  const perdida = producto && costoUnitario !== null ? redondear(cantidad * costoUnitario) : null
  const puedeRegistrar = !!producto && cantidadValida && !!motivo && !faltaNota

  const paso1Completo = !!producto
  const paso2Completo = paso1Completo && cantidadValida
  const paso3Completo = !!motivo && !faltaNota

  const errorProducto = intento && !producto
  const errorCantidad = !!producto && cantidad > disponible
  const errorMotivo = intento && !motivo
  const errorNota = intento && faltaNota

  /* ---------- Resúmenes (de los movimientos reales) ---------- */

  function perdidaDe(m) {
    const costo = productosPorId.get(m.productoId)?.costo
    return costo !== null && costo !== undefined ? m.cantidad * costo : 0
  }

  const mermasHoy = useMemo(
    () => mermas.filter((m) => esHoy(m.fecha)).sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
    [mermas]
  )

  const mes = useMemo(() => {
    const porMotivo = Object.fromEntries(MOTIVOS.map((m) => [m.id, { monto: 0, registros: 0 }]))

    mermas
      .filter((m) => esEsteMes(m.fecha))
      .forEach((m) => {
        const clave = porMotivo[m.motivoMerma] ? m.motivoMerma : 'otro'
        porMotivo[clave].monto += perdidaDe(m)
        porMotivo[clave].registros += 1
      })

    return porMotivo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mermas, productosPorId])

  const totalMes = redondear(Object.values(mes).reduce((suma, m) => suma + m.monto, 0))
  const registrosMes = Object.values(mes).reduce((suma, m) => suma + m.registros, 0)
  const motivosConDatos = MOTIVOS.filter((m) => (esPropietario ? mes[m.id].monto > 0 : mes[m.id].registros > 0))
  const baseBarra = esPropietario ? totalMes : registrosMes

  /* ---------- Registrar ---------- */

  function pedirRegistro() {
    setIntento(true)
    setErrorGuardar(null)
    if (puedeRegistrar) setConfirmar(true)
  }

  async function confirmarRegistro() {
    setConfirmar(false)
    if (!puedeRegistrar) return

    setGuardando(true)

    try {
      const movimiento = await registrarMovimiento({
        producto: producto.id,
        tipo_movimiento: 'merma',
        cantidad,
        motivo_merma: motivo,
        motivo: nota.trim() || null,
      })

      // El backend ya descontó el stock; aquí solo reflejamos lo que contestó
      setProductos((lista) =>
        lista.map((p) => (p.id === producto.id ? { ...p, stock: movimiento.stockResultante ?? p.stock - cantidad } : p))
      )
      setMermas((lista) => [movimiento, ...lista])
      setRegistrada({ nombre: producto.nombre, cantidad, unidad: producto.unidad, perdida })
      limpiar()
    } catch (e) {
      setErrorGuardar(mensajeDelBackend(e) ?? mensajeDeError(e))
    } finally {
      setGuardando(false)
    }
  }

  function limpiar() {
    setProductoId(null)
    setCantidad(1)
    setMotivo(null)
    setNota('')
    setIntento(false)
    cambiarBusqueda('')
    setTimeout(() => buscadorRef.current?.focus(), 0)
  }

  const motivoElegido = motivo ? MOTIVOS_POR_ID[motivo] : null

  /* ---------- Cargando o con error ---------- */

  if (cargando || errorCarga) {
    return (
      <div className="rm rm--centro">
        <section className="rm-panel rm-cargando">
          {cargando ? (
            <>
              <Loader2 size={26} className="rm-girando" aria-hidden="true" />
              <p>Cargando productos…</p>
            </>
          ) : (
            <>
              <AlertCircle size={26} className="rm-icono-error" aria-hidden="true" />
              <p>{errorCarga}</p>
              <button type="button" className="rm-boton rm-boton--secundario" onClick={cargarDatos}>
                <RotateCcw size={15} aria-hidden="true" />
                Reintentar
              </button>
            </>
          )}
        </section>
      </div>
    )
  }

  return (
    <div className="rm">
      {/* ============ FORMULARIO ============ */}
      <section className="rm-panel">
        {registrada && (
          <div className="rm-exito" role="status">
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>
              <strong>Merma registrada</strong> · se descontaron {registrada.cantidad}{' '}
              {textoUnidad(registrada.unidad, registrada.cantidad, true)} de {registrada.nombre}
              {registrada.perdida !== null && ` · ${moneda.format(registrada.perdida)} de pérdida`}
            </span>
            <button type="button" aria-label="Cerrar aviso" onClick={() => setRegistrada(null)}>
              <X size={15} />
            </button>
          </div>
        )}

        {errorGuardar && (
          <div className="rm-aviso-error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{errorGuardar}</span>
            <button type="button" aria-label="Cerrar aviso" onClick={() => setErrorGuardar(null)}>
              <X size={15} />
            </button>
          </div>
        )}

        <ol className="rm-pasos">
          {/* Paso 1 */}
          <li className={'rm-paso' + (paso1Completo ? ' is-completo' : '')}>
            <NumeroPaso numero={1} completo={paso1Completo} />
            <div className="rm-paso__contenido">
              <h2 className="rm-paso__titulo">¿Qué producto?</h2>

              {producto ? (
                <div className="rm-producto">
                  <span className="rm-placeholder rm-placeholder--grande" aria-hidden="true">
                    <Candy size={28} />
                  </span>

                  <div className="rm-producto__info">
                    <p className="rm-producto__nombre">{producto.nombre}</p>
                    <p className="rm-producto__marca">
                      {producto.marca ? `${producto.marca} · ${producto.categoria}` : producto.categoria}
                    </p>
                    <PastillaStock producto={producto} />
                  </div>

                  <div className="rm-producto__lado">
                    {costoUnitario !== null && (
                      <span className="rm-producto__costo">
                        Costo unitario: <strong>{moneda.format(costoUnitario)}</strong>
                      </span>
                    )}
                    <button type="button" className="rm-enlace" onClick={cambiarProducto}>
                      Cambiar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={'rm-buscador' + (errorProducto ? ' is-error' : '')}>
                    <Search size={17} aria-hidden="true" />
                    <input
                      ref={buscadorRef}
                      autoFocus
                      type="text"
                      placeholder="Busca el producto que se perdió… (ej. chocolate)"
                      value={busqueda}
                      onChange={(e) => cambiarBusqueda(e.target.value)}
                      onKeyDown={teclaBuscador}
                      aria-label="Buscar producto"
                    />
                    {busqueda && (
                      <button
                        type="button"
                        className="rm-icono-boton"
                        onClick={() => cambiarBusqueda('')}
                        aria-label="Limpiar búsqueda"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>

                  {busqueda.trim() &&
                    (resultados.length === 0 ? (
                      <p className="rm-sin-resultados">No encontramos productos con ese nombre.</p>
                    ) : (
                      <ul className="rm-resultados">
                        {resultados.map((p, i) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              className={'rm-resultado' + (i === indiceResaltado ? ' is-resaltado' : '')}
                              disabled={p.stock === 0}
                              onClick={() => elegirProducto(p.id)}
                              onMouseEnter={() => setResaltado(i)}
                            >
                              <span className="rm-placeholder" aria-hidden="true">
                                <Candy size={18} />
                              </span>
                              <span className="rm-resultado__info">
                                <span className="rm-resultado__nombre">{p.nombre}</span>
                                <span className="rm-resultado__marca">
                                  {p.marca ? `${p.marca} · ${p.categoria}` : p.categoria}
                                </span>
                              </span>
                              <PastillaStock producto={p} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ))}

                  {errorProducto && (
                    <p className="rm-error">
                      <AlertCircle size={13} aria-hidden="true" />
                      Elige el producto que se perdió
                    </p>
                  )}
                </>
              )}
            </div>
          </li>

          {/* Paso 2 */}
          <li className={'rm-paso' + (paso2Completo ? ' is-completo' : '')}>
            <NumeroPaso numero={2} completo={paso2Completo} />
            <div className="rm-paso__contenido">
              <h2 className="rm-paso__titulo">
                ¿Cuántas {producto ? textoUnidad(producto.unidad, 2, true) : 'piezas'}?
              </h2>

              <div className="rm-cantidad-fila">
                <div className={'rm-cantidad' + (errorCantidad ? ' is-error' : '')}>
                  <button
                    type="button"
                    onClick={() => cambiarCantidad(cantidad - 1)}
                    disabled={!producto || cantidad <= 1}
                    aria-label="Una menos"
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={disponible || undefined}
                    inputMode="numeric"
                    value={cantidad}
                    disabled={!producto}
                    onChange={(e) => cambiarCantidad(parseInt(e.target.value, 10))}
                    aria-label="Cantidad"
                  />
                  <button
                    type="button"
                    onClick={() => cambiarCantidad(cantidad + 1)}
                    disabled={!producto || cantidad >= disponible}
                    aria-label="Una más"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {producto && (
                  <span className="rm-flujo-stock">
                    Stock: {disponible}
                    <ArrowRight size={14} aria-hidden="true" />
                    <strong>{Math.max(disponible - cantidad, 0)}</strong>
                  </span>
                )}
              </div>

              {errorCantidad && (
                <p className="rm-error">
                  <AlertCircle size={13} aria-hidden="true" />
                  Solo hay {disponible} en inventario
                </p>
              )}
            </div>
          </li>

          {/* Paso 3 */}
          <li className={'rm-paso' + (paso3Completo ? ' is-completo' : '')}>
            <NumeroPaso numero={3} completo={paso3Completo} />
            <div className="rm-paso__contenido">
              <h2 className="rm-paso__titulo">¿Por qué?</h2>

              <div className={'rm-motivos' + (errorMotivo ? ' is-error' : '')} role="radiogroup" aria-label="Motivo">
                {MOTIVOS.map((m) => {
                  const Icono = m.icono
                  const activo = motivo === m.id

                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      className={'rm-motivo' + (activo ? ' is-activo' : '')}
                      style={{ '--motivo': m.color }}
                      onClick={() => setMotivo(m.id)}
                    >
                      {activo && (
                        <span className="rm-motivo__check" aria-hidden="true">
                          <Check size={11} strokeWidth={3.5} />
                        </span>
                      )}
                      <Icono size={22} className="rm-motivo__icono" aria-hidden="true" />
                      <span className="rm-motivo__nombre">{m.label}</span>
                      <span className="rm-motivo__desc">{m.desc}</span>
                    </button>
                  )
                })}
              </div>

              {errorMotivo && (
                <p className="rm-error">
                  <AlertCircle size={13} aria-hidden="true" />
                  Elige por qué se perdió
                </p>
              )}

              {motivo === 'devolucion_proveedor' && (
                <p className="rm-consejo">
                  <Lightbulb size={15} aria-hidden="true" />
                  <span>
                    Guarda la nota del proveedor: con ella puedes pedirle el cambio físico o una nota de crédito en su
                    próxima visita.
                  </span>
                </p>
              )}

              <div className="rm-nota">
                <div className="rm-nota__fila">
                  <label className="rm-etiqueta" htmlFor="rm-nota">
                    Nota {motivo === 'otro' ? <span className="rm-requerido">*</span> : '(opcional)'}
                  </label>
                  <span className="rm-ayuda">Obligatoria si eliges "Otro"</span>
                </div>
                <textarea
                  id="rm-nota"
                  className={errorNota ? 'is-error' : ''}
                  placeholder="Ej. Se cayó la charola al acomodar"
                  maxLength={200}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                />
                {errorNota && (
                  <p className="rm-error">
                    <AlertCircle size={13} aria-hidden="true" />
                    Explica qué pasó
                  </p>
                )}
              </div>

              <div className="rm-resumen">
                <Info size={17} aria-hidden="true" />
                {producto ? (
                  <span>
                    Se descontarán{' '}
                    <strong>
                      {cantidad} {textoUnidad(producto.unidad, cantidad, true)}
                    </strong>
                    {perdida !== null && (
                      <>
                        {' '}
                        · Pérdida estimada <strong className="rm-resumen__perdida">{moneda.format(perdida)}</strong>{' '}
                        <span className="rm-resumen__nota">(a {moneda.format(costoUnitario)} c/u)</span>
                      </>
                    )}
                  </span>
                ) : (
                  <span>Elige un producto para ver cuánto se descuenta.</span>
                )}
              </div>

              <div className="rm-botones">
                <button type="button" className="rm-boton rm-boton--secundario" onClick={limpiar} disabled={guardando}>
                  Limpiar
                </button>
                <button type="button" className="rm-boton rm-boton--primario" onClick={pedirRegistro} disabled={guardando}>
                  {guardando ? (
                    <Loader2 size={17} className="rm-girando" aria-hidden="true" />
                  ) : (
                    <Check size={17} aria-hidden="true" />
                  )}
                  {guardando ? 'Registrando…' : 'Registrar merma'}
                </button>
              </div>
            </div>
          </li>
        </ol>
      </section>

      {/* ============ LATERAL ============ */}
      <aside className="rm-lateral">
        <section className="rm-panel">
          <header className="rm-cabecera">
            <span className="rm-cabecera__icono" aria-hidden="true">
              <TrendingDown size={16} />
            </span>
            <h2 className="rm-cabecera__titulo">Mermas de este mes</h2>
            <span className="rm-cabecera__extra">{mesActual}</span>
          </header>

          {esPropietario ? (
            <p className="rm-total">{moneda.format(totalMes)}</p>
          ) : (
            <p className="rm-total rm-total--neutro">{registrosMes}</p>
          )}
          <p className="rm-total__nota">
            {esPropietario
              ? `en ${registrosMes} ${registrosMes === 1 ? 'registro' : 'registros'} · al costo`
              : registrosMes === 1
                ? 'registro este mes'
                : 'registros este mes'}
          </p>

          {baseBarra > 0 && (
            <>
              <div className="rm-barra" aria-hidden="true">
                {motivosConDatos.map((m) => (
                  <span
                    key={m.id}
                    className="rm-barra__segmento"
                    style={{
                      width: `${((esPropietario ? mes[m.id].monto : mes[m.id].registros) / baseBarra) * 100}%`,
                      background: m.color,
                    }}
                  />
                ))}
              </div>

              <ul className="rm-leyenda">
                {motivosConDatos.map((m) => {
                  const valor = esPropietario ? mes[m.id].monto : mes[m.id].registros

                  return (
                    <li key={m.id}>
                      <span className="rm-leyenda__punto" style={{ background: m.color }} aria-hidden="true" />
                      <span className="rm-leyenda__nombre">{m.label}</span>
                      <span className="rm-leyenda__monto">{esPropietario ? moneda.format(valor) : valor}</span>
                      <span className="rm-leyenda__porcentaje">{Math.round((valor / baseBarra) * 100)}%</span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </section>

        <section className="rm-panel">
          <header className="rm-cabecera">
            <span className="rm-cabecera__icono" aria-hidden="true">
              <CalendarDays size={16} />
            </span>
            <h2 className="rm-cabecera__titulo">Registradas hoy</h2>
            <span className="rm-cabecera__extra">{mermasHoy.length}</span>
          </header>

          {mermasHoy.length === 0 ? (
            <p className="rm-hoy-vacio">Hoy no se ha registrado ninguna merma.</p>
          ) : (
            <ul className="rm-hoy">
              {mermasHoy.map((h) => {
                const p = productosPorId.get(h.productoId)
                const m = MOTIVOS_POR_ID[h.motivoMerma] ?? MOTIVOS_POR_ID.otro
                const unidad = p?.unidad ?? 'pieza'
                const costo = p?.costo ?? null

                return (
                  <li key={h.id}>
                    <span className="rm-hoy__hora">{formatoHora.format(new Date(h.fecha))}</span>
                    <span className="rm-placeholder rm-placeholder--chico" aria-hidden="true">
                      <Candy size={15} />
                    </span>
                    <span className="rm-hoy__info">
                      <span className="rm-hoy__nombre">{h.productoNombre ?? p?.nombre}</span>
                      <span className="rm-hoy__cantidad">
                        {h.cantidad} {textoUnidad(unidad, h.cantidad)}
                      </span>
                    </span>
                    <span className="rm-hoy__lado">
                      <span className="rm-chip" style={{ '--motivo': m.color }}>
                        {m.label}
                      </span>
                      {costo !== null && <span className="rm-hoy__perdida">-{moneda.format(h.cantidad * costo)}</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="rm-ver-todo">
            <button type="button" className="rm-enlace" onClick={() => navigate('/movimientos')}>
              Ver historial completo
              <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          </div>
        </section>
      </aside>

      <ConfirmDialog
        open={confirmar}
        title="¿Registrar la merma?"
        message={
          producto && motivoElegido
            ? `Se descontarán ${cantidad} ${textoUnidad(producto.unidad, cantidad, true)} de ${producto.nombre} por "${motivoElegido.label}". Este movimiento ya no se podrá borrar.`
            : ''
        }
        confirmText="Sí, registrar"
        cancelText="Revisar"
        tone="danger"
        onConfirm={confirmarRegistro}
        onCancel={() => setConfirmar(false)}
      />
    </div>
  )
}