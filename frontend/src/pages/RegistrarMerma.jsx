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
} from 'lucide-react'

import ConfirmDialog from '../components/ConfirmDialog.jsx'
import '../styles/registrar-merma.css'
 
 
const MAX_RESULTADOS = 5

const MOTIVOS = [
  { id: 'caducado',   label: 'Caducado',       desc: 'Fecha vencida',           icono: CalendarX,       color: '#dc2626' },
  { id: 'danado',     label: 'Dañado',         desc: 'Roto o aplastado',        icono: PackageX,        color: '#f59e0b' },
  { id: 'consumo',    label: 'Consumo propio', desc: 'Lo usó el negocio',       icono: Cookie,          color: '#14b8a6' },
  { id: 'devolucion', label: 'Devolución',     desc: 'Se regresa al proveedor', icono: Undo2,           color: '#6366f1' },
  { id: 'otro',       label: 'Otro',           desc: 'Explícalo en la nota',    icono: MoreHorizontal,  color: '#94a3b8' },
]

const MOTIVOS_POR_ID = Object.fromEntries(MOTIVOS.map((m) => [m.id, m]))

/* ============================================================
   ESTADO INICIAL — Todo vacío hasta conectar el backend
   ------------------------------------------------------------
   PRODUCTOS: catálogo de productos del negocio
   MERMAS_MES: mermas acumuladas del mes en curso, por motivo
   MERMAS_HOY: lista de mermas registradas hoy
   ============================================================ */
const PRODUCTOS = []

const MERMAS_MES_INICIALES = {
  caducado:   { monto: 0, registros: 0 },
  danado:     { monto: 0, registros: 0 },
  consumo:    { monto: 0, registros: 0 },
  devolucion: { monto: 0, registros: 0 },
  otro:       { monto: 0, registros: 0 },
}

const MERMAS_HOY_INICIALES = []

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const mesActual = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date())

function normalizar(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function redondear(n) {
  return Math.round(n * 100) / 100
}

function horaActual() {
  return new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function PastillaStock({ disponible, minimo }) {
  if (disponible === 0) return <span className="rm-stock rm-stock--agotado">Agotado</span>
  if (disponible < minimo) return <span className="rm-stock rm-stock--bajo">Hay {disponible} pzas · Stock bajo</span>
  return <span className="rm-stock rm-stock--ok">Hay {disponible} pzas</span>
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
  const buscadorRef = useRef(null)

  const [busqueda, setBusqueda] = useState('')
  const [resaltado, setResaltado] = useState(0)
  const [productoId, setProductoId] = useState(null)
  const [cantidad, setCantidad] = useState(1)
  const [motivo, setMotivo] = useState(null)
  const [nota, setNota] = useState('')
  const [intento, setIntento] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [registrada, setRegistrada] = useState(null)
  const [stock, setStock] = useState(() => Object.fromEntries(PRODUCTOS.map((p) => [p.id, p.stock])))
  const [hoy, setHoy] = useState(MERMAS_HOY_INICIALES)
  const [mes, setMes] = useState(MERMAS_MES_INICIALES)

  const productosPorId = useMemo(() => Object.fromEntries(PRODUCTOS.map((p) => [p.id, p])), [])
  const location = useLocation()

  // Si viene de Alertas, deja el producto ya elegido
  useEffect(() => {
    const id = location.state?.productoId
    if (!id) return
    elegirProducto(id)
    navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  const producto = productoId ? productosPorId[productoId] : null
  const disponible = producto ? stock[producto.id] ?? 0 : 0
  const sinProductos = PRODUCTOS.length === 0

  /* ---------- Paso 1: producto ---------- */

  const resultados = useMemo(() => {
    const texto = normalizar(busqueda.trim())
    if (!texto) return []
    return PRODUCTOS.filter((p) => normalizar(`${p.nombre} ${p.marca}`).includes(texto)).slice(0, MAX_RESULTADOS)
  }, [busqueda])

  const indiceResaltado = Math.min(resaltado, Math.max(resultados.length - 1, 0))

  function cambiarBusqueda(valor) {
    setBusqueda(valor)
    setResaltado(0)
  }

  function elegirProducto(id) {
    if ((stock[id] ?? 0) === 0) return
    setProductoId(id)
    setCantidad(1)
    cambiarBusqueda('')
    setRegistrada(null)
  }

  function cambiarProducto() {
    setProductoId(null)
    setCantidad(1)
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
  const perdida = producto ? redondear(cantidad * producto.costo) : 0
  const puedeRegistrar = !!producto && cantidadValida && !!motivo && !faltaNota

  const paso1Completo = !!producto
  const paso2Completo = paso1Completo && cantidadValida
  const paso3Completo = !!motivo && !faltaNota

  const errorProducto = intento && !producto
  const errorCantidad = !!producto && cantidad > disponible
  const errorMotivo = intento && !motivo
  const errorNota = intento && faltaNota

  const totalMes = redondear(Object.values(mes).reduce((suma, m) => suma + m.monto, 0))
  const registrosMes = Object.values(mes).reduce((suma, m) => suma + m.registros, 0)
  const motivosConMonto = MOTIVOS.filter((m) => mes[m.id].monto > 0)

  /* ---------- Registrar ---------- */

  function pedirRegistro() {
    setIntento(true)
    if (puedeRegistrar) setConfirmar(true)
  }

  function confirmarRegistro() {
    setConfirmar(false)
    if (!puedeRegistrar) return

    // TODO: mandar la merma al backend (él genera el movimiento de inventario)
    setStock((s) => ({ ...s, [producto.id]: s[producto.id] - cantidad }))

    setHoy((lista) => [
      { id: Date.now(), hora: horaActual(), productoId: producto.id, cantidad, motivo, nota: nota.trim() },
      ...lista,
    ])

    setMes((m) => ({
      ...m,
      [motivo]: { monto: redondear(m[motivo].monto + perdida), registros: m[motivo].registros + 1 },
    }))

    setRegistrada({ nombre: producto.nombre, cantidad, perdida })
    limpiar()
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

  return (
    <div className="rm">
      {/* ============ FORMULARIO ============ */}
      <section className="rm-panel">
        {registrada && (
          <div className="rm-exito" role="status">
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>
              <strong>Merma registrada</strong> · se descontaron {registrada.cantidad}{' '}
              {registrada.cantidad === 1 ? 'pieza' : 'piezas'} de {registrada.nombre} ·{' '}
              {moneda.format(registrada.perdida)} de pérdida
            </span>
            <button type="button" aria-label="Cerrar aviso" onClick={() => setRegistrada(null)}>
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

              {sinProductos ? (
                <div className="rm-vacio-estado">
                  <span className="rm-vacio-estado__icono" aria-hidden="true">
                    <Candy size={22} />
                  </span>
                  <p className="rm-vacio-estado__titulo">Aún no tienes productos</p>
                  <p className="rm-vacio-estado__texto">
                    Agrega productos a tu catálogo antes de registrar mermas.
                  </p>
                  <button
                    type="button"
                    className="rm-boton rm-boton--primario"
                    onClick={() => navigate('/catalogo/nuevo')}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Nuevo producto
                  </button>
                </div>
              ) : producto ? (
                <div className="rm-producto">
                  <span className="rm-placeholder rm-placeholder--grande" aria-hidden="true">
                    <Candy size={28} />
                  </span>

                  <div className="rm-producto__info">
                    <p className="rm-producto__nombre">{producto.nombre}</p>
                    <p className="rm-producto__marca">
                      {producto.marca} · {producto.categoria}
                    </p>
                    <PastillaStock disponible={disponible} minimo={producto.minimo} />
                  </div>

                  <div className="rm-producto__lado">
                    <span className="rm-producto__costo">
                      Costo unitario: <strong>{moneda.format(producto.costo)}</strong>
                    </span>
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
                        {resultados.map((p, i) => {
                          const disp = stock[p.id] ?? 0

                          return (
                            <li key={p.id}>
                              <button
                                type="button"
                                className={'rm-resultado' + (i === indiceResaltado ? ' is-resaltado' : '')}
                                disabled={disp === 0}
                                onClick={() => elegirProducto(p.id)}
                                onMouseEnter={() => setResaltado(i)}
                              >
                                <span className="rm-placeholder" aria-hidden="true">
                                  <Candy size={18} />
                                </span>
                                <span className="rm-resultado__info">
                                  <span className="rm-resultado__nombre">{p.nombre}</span>
                                  <span className="rm-resultado__marca">
                                    {p.marca} · {p.categoria}
                                  </span>
                                </span>
                                <PastillaStock disponible={disp} minimo={p.minimo} />
                              </button>
                            </li>
                          )
                        })}
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
              <h2 className="rm-paso__titulo">¿Cuántas piezas?</h2>

              <div className="rm-cantidad-fila">
                <div className={'rm-cantidad' + (errorCantidad ? ' is-error' : '')}>
                  <button
                    type="button"
                    onClick={() => cambiarCantidad(cantidad - 1)}
                    disabled={!producto || cantidad <= 1}
                    aria-label="Una pieza menos"
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
                    aria-label="Cantidad de piezas"
                  />
                  <button
                    type="button"
                    onClick={() => cambiarCantidad(cantidad + 1)}
                    disabled={!producto || cantidad >= disponible}
                    aria-label="Una pieza más"
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

              {motivo === 'devolucion' && (
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

              {/* Resumen */}
              <div className="rm-resumen">
                <Info size={17} aria-hidden="true" />
                {producto ? (
                  <span>
                    Se descontarán{' '}
                    <strong>
                      {cantidad} {cantidad === 1 ? 'pieza' : 'piezas'}
                    </strong>{' '}
                    · Pérdida estimada{' '}
                    <strong className="rm-resumen__perdida">{moneda.format(perdida)}</strong>{' '}
                    <span className="rm-resumen__nota">(a {moneda.format(producto.costo)} c/u)</span>
                  </span>
                ) : (
                  <span>Elige un producto para ver cuánto se descuenta.</span>
                )}
              </div>

              <div className="rm-botones">
                <button type="button" className="rm-boton rm-boton--secundario" onClick={limpiar}>
                  Limpiar
                </button>
                <button
                  type="button"
                  className="rm-boton rm-boton--primario"
                  onClick={pedirRegistro}
                  disabled={sinProductos}
                >
                  <Check size={17} aria-hidden="true" />
                  Registrar merma
                </button>
              </div>
            </div>
          </li>
        </ol>
      </section>

      {/* ============ LATERAL ============ */}
      <aside className="rm-lateral">
        {/* Mermas del mes */}
        <section className="rm-panel">
          <header className="rm-cabecera">
            <span className="rm-cabecera__icono" aria-hidden="true">
              <TrendingDown size={16} />
            </span>
            <h2 className="rm-cabecera__titulo">Mermas de este mes</h2>
            <span className="rm-cabecera__extra">{mesActual}</span>
          </header>

          {totalMes === 0 ? (
            <div className="rm-vacio-lateral">
              <span className="rm-vacio-lateral__icono" aria-hidden="true">
                <TrendingDown size={20} />
              </span>
              <p className="rm-vacio-lateral__texto">
                Sin mermas registradas este mes.
              </p>
            </div>
          ) : (
            <>
              <p className="rm-total">{moneda.format(totalMes)}</p>
              <p className="rm-total__nota">
                en {registrosMes} {registrosMes === 1 ? 'registro' : 'registros'} · al costo
              </p>

              <div className="rm-barra" aria-hidden="true">
                {motivosConMonto.map((m) => (
                  <span
                    key={m.id}
                    className="rm-barra__segmento"
                    style={{ width: `${(mes[m.id].monto / totalMes) * 100}%`, background: m.color }}
                  />
                ))}
              </div>

              <ul className="rm-leyenda">
                {motivosConMonto.map((m) => (
                  <li key={m.id}>
                    <span className="rm-leyenda__punto" style={{ background: m.color }} aria-hidden="true" />
                    <span className="rm-leyenda__nombre">{m.label}</span>
                    <span className="rm-leyenda__monto">{moneda.format(mes[m.id].monto)}</span>
                    <span className="rm-leyenda__porcentaje">
                      {Math.round((mes[m.id].monto / totalMes) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Registradas hoy */}
        <section className="rm-panel">
          <header className="rm-cabecera">
            <span className="rm-cabecera__icono" aria-hidden="true">
              <CalendarDays size={16} />
            </span>
            <h2 className="rm-cabecera__titulo">Registradas hoy</h2>
            <span className="rm-cabecera__extra">{hoy.length}</span>
          </header>

          {hoy.length === 0 ? (
            <div className="rm-vacio-lateral">
              <span className="rm-vacio-lateral__icono" aria-hidden="true">
                <CalendarDays size={20} />
              </span>
              <p className="rm-vacio-lateral__texto">
                Hoy no se ha registrado ninguna merma.
              </p>
            </div>
          ) : (
            <ul className="rm-hoy">
              {hoy.map((h) => {
                const p = productosPorId[h.productoId]
                const m = MOTIVOS_POR_ID[h.motivo]

                return (
                  <li key={h.id}>
                    <span className="rm-hoy__hora">{h.hora}</span>
                    <span className="rm-placeholder rm-placeholder--chico" aria-hidden="true">
                      <Candy size={15} />
                    </span>
                    <span className="rm-hoy__info">
                      <span className="rm-hoy__nombre">{p.nombre}</span>
                      <span className="rm-hoy__cantidad">
                        {h.cantidad} {h.cantidad === 1 ? 'pza' : 'pzas'}
                      </span>
                    </span>
                    <span className="rm-hoy__lado">
                      <span className="rm-chip" style={{ '--motivo': m.color }}>
                        {m.label}
                      </span>
                      <span className="rm-hoy__perdida">-{moneda.format(h.cantidad * p.costo)}</span>
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
            ? `Se descontarán ${cantidad} ${cantidad === 1 ? 'pieza' : 'piezas'} de ${producto.nombre} por "${motivoElegido.label}". Este movimiento ya no se podrá borrar.`
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