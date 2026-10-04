import { Fragment, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'

import {
  Search,
  X,
  Lock,
  Download,
  Candy,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Truck,
  PackageMinus,
  ClipboardCheck,
  Receipt,
  SearchX,
} from 'lucide-react'

import '../styles/historial.css'

/* ============================================================
   ESTADO INICIAL — Todo vacío hasta conectar el backend
   ------------------------------------------------------------
   MOVIMIENTOS:  lista de movimientos del inventario
   VENTAS:       diccionario indexado por id de venta
   COMPRAS:      diccionario indexado por id de compra
   PRODUCTOS:    catálogo de productos
   USUARIOS:     se calcula automáticamente de los movimientos
   ============================================================ */
const PRODUCTOS = []
const MOVIMIENTOS = []
const VENTAS = {}
const COMPRAS = {}

const POR_PAGINA = 10

const TIPOS = {
  venta:      { label: 'Venta',      color: '#1668e3', icono: ShoppingCart },
  compra:     { label: 'Compra',     color: '#14a06b', icono: Truck },
  merma:      { label: 'Merma',      color: '#dc2626', icono: PackageMinus },
  correccion: { label: 'Corrección', color: '#7c3aed', icono: ClipboardCheck },
}

const RANGOS = [
  { id: 'hoy', label: 'Hoy',    dias: 0 },
  { id: '7',   label: '7 días', dias: 7 },
  { id: '30',  label: '30 días',dias: 30 },
  { id: 'todo',label: 'Todo',   dias: null },
]

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const formatoDia = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' })
const formatoLargo = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
const formatoHora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })

const productosPorId = Object.fromEntries(PRODUCTOS.map((p) => [p.id, p]))

/* ============ Utilidades ============ */

function normalizar(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function iniciales(nombre) {
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean)
  return partes
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

function dentroDeRango(fechaIso, rango) {
  if (rango.dias === null) return true
  const inicio = new Date()
  inicio.setHours(0, 0, 0, 0)
  inicio.setDate(inicio.getDate() - rango.dias)
  return new Date(fechaIso) >= inicio
}

function paginasVisibles(total, actual) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const paginas = [1]
  const desde = Math.max(2, actual - 1)
  const hasta = Math.min(total - 1, actual + 1)

  if (desde > 2) paginas.push('…')
  for (let n = desde; n <= hasta; n++) paginas.push(n)
  if (hasta < total - 1) paginas.push('…')

  paginas.push(total)
  return paginas
}

// TODO: cuando el backend esté listo, `unidadDe` y `textoUnidad` vienen del backend
function unidadDe() { return 'pza' }
function textoUnidad(unidad, cantidad) {
  return cantidad === 1 ? unidad : `${unidad}s`
}

/* ============ Origen y búsqueda ============ */

function textoOrigen(m) {
  if (m.tipo === 'venta') return `Venta #${m.ventaId}`
  if (m.tipo === 'compra') return `Compra #${m.compraId} · ${COMPRAS[m.compraId]?.proveedor ?? ''}`
  return m.motivo
}

function textoBuscable(m) {
  const p = productosPorId[m.productoId]
  return normalizar(
    `${p?.nombre ?? ''} ${p?.marca ?? ''} ${textoOrigen(m)} ${m.nota ?? ''} ${m.ventaId ?? ''} ${m.compraId ?? ''}`
  )
}

/* ============ Exportar CSV ============ */

function exportarCSV(lista) {
  const encabezado = ['Fecha', 'Hora', 'Tipo', 'Producto', 'Cantidad', 'Unidad', 'Stock después', 'Usuario', 'Origen']

  const filas = lista.map((m) => {
    const fecha = new Date(m.fecha)
    const unidad = unidadDe(m.productoId)
    return [
      formatoDia.format(fecha),
      formatoHora.format(fecha),
      TIPOS[m.tipo].label,
      productosPorId[m.productoId]?.nombre ?? '',
      m.cantidad,
      textoUnidad(unidad, m.cantidad),
      m.stockDespues,
      m.usuario,
      textoOrigen(m),
    ]
  })

  const csv = [encabezado, ...filas]
    .map((fila) => fila.map((valor) => `"${String(valor).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `historial-inventia-${new Date().toISOString().slice(0, 10)}.csv`
  enlace.click()
  URL.revokeObjectURL(url)
}

/* ============ Detalles desplegables ============ */

function CabeceraDetalle({ icono: Icono, titulo, sub, totalTexto, total }) {
  return (
    <header className="hi-detalle__cabecera">
      <span className="hi-detalle__icono" aria-hidden="true">
        <Icono size={17} />
      </span>
      <div className="hi-detalle__titulos">
        <p className="hi-detalle__titulo">{titulo}</p>
        <p className="hi-detalle__sub">{sub}</p>
      </div>
      {total !== undefined && (
        <div className="hi-detalle__total">
          <span>{totalTexto}</span>
          <strong>{moneda.format(total)}</strong>
        </div>
      )}
    </header>
  )
}

function DetalleVenta({ m }) {
  const venta = VENTAS[m.ventaId]
  if (!venta) return null

  const fecha = new Date(venta.fecha)
  const total = venta.renglones.reduce((suma, r) => suma + r.cantidad * r.precio, 0)

  return (
    <div className="hi-detalle">
      <CabeceraDetalle
        icono={Receipt}
        titulo={`Venta #${m.ventaId}`}
        sub={`${formatoLargo.format(fecha)} · ${formatoHora.format(fecha)} · ${venta.usuario} · ${venta.renglones.length} ${
          venta.renglones.length === 1 ? 'producto' : 'productos'
        }`}
        totalTexto="Total de la venta"
        total={total}
      />

      <table className="hi-detalle__tabla">
        <thead>
          <tr>
            <th>Producto</th>
            <th className="is-der">Cantidad</th>
            <th>Precio aplicado</th>
            <th className="is-der">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {venta.renglones.map((r) => {
            const p = productosPorId[r.productoId]

            return (
              <tr key={r.productoId}>
                <td>{p?.nombre}</td>
                <td className="is-der">
                  {r.cantidad} {textoUnidad(unidadDe(p?.id), r.cantidad)}
                </td>
                <td>
                  <span className="hi-precio">
                    {r.clase && <s className="hi-tachado">{moneda.format(p?.precio ?? 0)}</s>}
                    <strong>{moneda.format(r.precio)}</strong>
                    {r.etiqueta && <span className={`hi-chip hi-chip--${r.clase}`}>{r.etiqueta}</span>}
                  </span>
                </td>
                <td className="is-der">
                  <strong>{moneda.format(r.cantidad * r.precio)}</strong>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function DetalleCompra({ m }) {
  const compra = COMPRAS[m.compraId]
  if (!compra) return null

  const fecha = new Date(compra.fecha)
  const total = compra.renglones.reduce((suma, r) => suma + r.cantidad * r.costo, 0)

  return (
    <div className="hi-detalle">
      <CabeceraDetalle
        icono={Truck}
        titulo={`Compra #${m.compraId} · ${compra.proveedor}`}
        sub={`${formatoLargo.format(fecha)} · ${formatoHora.format(fecha)} · ${compra.usuario}${
          compra.nota ? ` · ${compra.nota}` : ''
        }`}
        totalTexto="Total de la compra"
        total={total}
      />

      <table className="hi-detalle__tabla">
        <thead>
          <tr>
            <th>Producto</th>
            <th className="is-der">Entraron</th>
            <th className="is-der">Costo</th>
            <th className="is-der">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {compra.renglones.map((r) => {
            const p = productosPorId[r.productoId]

            return (
              <tr key={r.productoId}>
                <td>{p?.nombre}</td>
                <td className="is-der">
                  {r.cantidad} {textoUnidad(unidadDe(p?.id), r.cantidad)}
                </td>
                <td className="is-der">{moneda.format(r.costo)} c/u</td>
                <td className="is-der">
                  <strong>{moneda.format(r.cantidad * r.costo)}</strong>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function DetalleMerma({ m }) {
  const p = productosPorId[m.productoId]
  if (!p) return null

  const fecha = new Date(m.fecha)
  const perdida = Math.abs(m.cantidad) * p.costo

  return (
    <div className="hi-detalle">
      <CabeceraDetalle
        icono={PackageMinus}
        titulo={`Merma · ${p.nombre}`}
        sub={`${formatoLargo.format(fecha)} · ${formatoHora.format(fecha)} · ${m.usuario}`}
        totalTexto="Pérdida estimada"
        total={perdida}
      />

      <dl className="hi-datos">
        <div>
          <dt>Motivo</dt>
          <dd>{m.motivo}</dd>
        </div>
        <div>
          <dt>Se dieron de baja</dt>
          <dd className="is-rojo">
            {Math.abs(m.cantidad)} {textoUnidad(unidadDe(p.id), m.cantidad)}
          </dd>
        </div>
        <div>
          <dt>Costo unitario</dt>
          <dd>{moneda.format(p.costo)}</dd>
        </div>
        <div>
          <dt>Nota</dt>
          <dd className={m.nota ? '' : 'is-tenue'}>{m.nota || 'Sin nota'}</dd>
        </div>
      </dl>
    </div>
  )
}

function DetalleCorreccion({ m }) {
  const p = productosPorId[m.productoId]
  if (!p) return null

  const fecha = new Date(m.fecha)
  const unidad = unidadDe(p.id)
  const antes = m.stockDespues - m.cantidad
  const impacto = m.cantidad * p.costo

  return (
    <div className="hi-detalle">
      <CabeceraDetalle
        icono={ClipboardCheck}
        titulo={`Corrección · ${p.nombre}`}
        sub={`${formatoLargo.format(fecha)} · ${formatoHora.format(fecha)} · ${m.usuario}`}
        totalTexto="Impacto"
        total={impacto}
      />

      <dl className="hi-datos">
        <div>
          <dt>Motivo</dt>
          <dd>{m.motivo}</dd>
        </div>
        <div>
          <dt>Antes → después</dt>
          <dd>
            {antes} → {m.stockDespues} {textoUnidad(unidad, m.stockDespues)}
          </dd>
        </div>
        <div>
          <dt>Diferencia</dt>
          <dd className={m.cantidad < 0 ? 'is-rojo' : 'is-verde'}>
            {m.cantidad > 0 ? '+' : ''}
            {m.cantidad} {textoUnidad(unidad, m.cantidad)}
          </dd>
        </div>
        <div>
          <dt>Nota</dt>
          <dd className={m.nota ? '' : 'is-tenue'}>{m.nota || 'Sin nota'}</dd>
        </div>
      </dl>
    </div>
  )
}

const DETALLES_POR_TIPO = {
  venta: DetalleVenta,
  compra: DetalleCompra,
  merma: DetalleMerma,
  correccion: DetalleCorreccion,
}

/* ============ Pantalla ============ */
 export default function Movimientos() {
  const location = useLocation()
  const usuarioInicial = location.state?.usuario

  const [busqueda, setBusqueda] = useState('')
  const [rangoId, setRangoId] = useState(usuarioInicial ? 'todo' : '7')
  const [tipo, setTipo] = useState('todos')
  const [usuario, setUsuario] = useState(usuarioInicial ?? 'todos')
  const [pagina, setPagina] = useState(1)
  const [abierto, setAbierto] = useState(null)

  const usuarios = useMemo(
    () => [...new Set(MOVIMIENTOS.map((m) => m.usuario).filter(Boolean))],
    []
  )

  const rango = RANGOS.find((r) => r.id === rangoId)
  const sinMovimientos = MOVIMIENTOS.length === 0

  const texto = normalizar(busqueda.trim())
  const sinFiltroDeTipo = MOVIMIENTOS.filter((m) => {
    if (!dentroDeRango(m.fecha, rango)) return false
    if (usuario !== 'todos' && m.usuario !== usuario) return false
    if (texto && !textoBuscable(m).includes(texto)) return false
    return true
  })

  const conteoPorTipo = sinFiltroDeTipo.reduce((conteo, m) => {
    conteo[m.tipo] = (conteo[m.tipo] || 0) + 1
    return conteo
  }, {})

  const filtrados = tipo === 'todos' ? sinFiltroDeTipo : sinFiltroDeTipo.filter((m) => m.tipo === tipo)

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicio = (paginaActual - 1) * POR_PAGINA
  const enPagina = filtrados.slice(inicio, inicio + POR_PAGINA)

  function filtrar(setter) {
    return (valor) => {
      setter(valor)
      setPagina(1)
      setAbierto(null)
    }
  }

  const cambiarBusqueda = filtrar(setBusqueda)
  const cambiarRango = filtrar(setRangoId)
  const cambiarTipo = filtrar(setTipo)
  const cambiarUsuario = filtrar(setUsuario)

  return (
    <div className="hi">
      {/* ============ ENCABEZADO ============ */}
      <header className="hi-encabezado">
        <div>
          <h1 className="hi-titulo">Historial de movimientos</h1>
          <p className="hi-subtitulo">Todo lo que ha entrado y salido de tu inventario</p>
        </div>
        <button
          type="button"
          className="hi-boton"
          disabled={filtrados.length === 0}
          onClick={() => exportarCSV(filtrados)}
          title="Descarga lo que estás viendo, para abrirlo en Excel"
        >
          <Download size={16} aria-hidden="true" />
          Exportar
        </button>
      </header>

      <p className="hi-candado">
        <Lock size={16} aria-hidden="true" />
        <span>
          Los movimientos no se pueden editar ni borrar. <strong>Así tu inventario siempre cuadra.</strong>
        </span>
      </p>

      {sinMovimientos ? (
        /* ============ ESTADO VACÍO ============ */
        <section className="hi-panel hi-vacio">
          <span className="hi-vacio__icono" aria-hidden="true">
            <Receipt size={26} />
          </span>
          <h2 className="hi-vacio__titulo">Aún no hay movimientos</h2>
          <p className="hi-vacio__texto">
            Cuando registres ventas, compras, mermas o correcciones, aparecerán aquí.
          </p>
        </section>
      ) : (
        <>
          {/* ============ FILTROS ============ */}
          <section className="hi-panel">
            <div className="hi-filtros">
              <div className="hi-buscador">
                <Search size={16} className="hi-buscador__icono" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Busca por producto, folio, proveedor o motivo…"
                  value={busqueda}
                  onChange={(e) => cambiarBusqueda(e.target.value)}
                  aria-label="Buscar movimiento"
                />
                {busqueda && (
                  <button
                    type="button"
                    className="hi-buscador__limpiar"
                    onClick={() => cambiarBusqueda('')}
                    aria-label="Limpiar búsqueda"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="hi-segmentado" role="tablist" aria-label="Periodo">
                {RANGOS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="tab"
                    aria-selected={rangoId === r.id}
                    className={rangoId === r.id ? 'is-activo' : ''}
                    onClick={() => cambiarRango(r.id)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {usuarios.length > 0 && (
                <select
                  className="hi-usuario-select"
                  value={usuario}
                  onChange={(e) => cambiarUsuario(e.target.value)}
                  aria-label="Filtrar por usuario"
                >
                  <option value="todos">Usuario: Todos</option>
                  {usuarios.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="hi-tipos">
              <span className="hi-tipos__titulo">Tipo:</span>

              <button
                type="button"
                className={'hi-tipo-filtro' + (tipo === 'todos' ? ' is-activo' : '')}
                onClick={() => cambiarTipo('todos')}
              >
                Todos
                <span className="hi-tipo-filtro__conteo">{sinFiltroDeTipo.length}</span>
              </button>

              {Object.entries(TIPOS).map(([id, t]) => (
                <button
                  key={id}
                  type="button"
                  className={'hi-tipo-filtro' + (tipo === id ? ' is-activo' : '')}
                  onClick={() => cambiarTipo(id)}
                >
                  <span className="hi-punto" style={{ background: t.color }} aria-hidden="true" />
                  {t.label}
                  <span className="hi-tipo-filtro__conteo">{conteoPorTipo[id] || 0}</span>
                </button>
              ))}
            </div>
          </section>

          {/* ============ TABLA ============ */}
          <section className="hi-panel hi-panel--tabla">
            {filtrados.length === 0 ? (
              <div className="hi-vacio">
                <SearchX size={26} aria-hidden="true" />
                {rangoId === 'hoy' && !busqueda && tipo === 'todos'
                  ? 'Hoy todavía no hay movimientos.'
                  : 'No hay movimientos con esos filtros.'}
              </div>
            ) : (
              <>
                <table className="hi-tabla">
                  <thead>
                    <tr>
                      <th>Fecha y hora</th>
                      <th>Tipo</th>
                      <th>Producto</th>
                      <th className="is-der">Cantidad</th>
                      <th className="is-der">Stock después</th>
                      <th>Usuario</th>
                      <th>Origen</th>
                      <th aria-label="Ver detalle" />
                    </tr>
                  </thead>
                  <tbody>
                    {enPagina.map((m) => {
                      const p = productosPorId[m.productoId]
                      const t = TIPOS[m.tipo]
                      const Icono = t.icono
                      const fecha = new Date(m.fecha)
                      const unidad = unidadDe(m.productoId)
                      const estaAbierto = abierto === m.id
                      const Detalle = DETALLES_POR_TIPO[m.tipo]

                      return (
                        <Fragment key={m.id}>
                          <tr
                            className={'hi-fila' + (estaAbierto ? ' is-abierta' : '')}
                            onClick={() => setAbierto(estaAbierto ? null : m.id)}
                            aria-expanded={estaAbierto}
                          >
                            <td>
                              <div className="hi-fecha">
                                <strong>{formatoDia.format(fecha)}</strong>
                                <span>{formatoHora.format(fecha)} hrs</span>
                              </div>
                            </td>
                            <td>
                              <span className={`hi-tipo hi-tipo--${m.tipo}`}>{t.label}</span>
                            </td>
                            <td>
                              <div className="hi-producto">
                                <span className="hi-placeholder" aria-hidden="true">
                                  <Candy size={14} />
                                </span>
                                <span className="hi-producto__nombre">{p?.nombre}</span>
                              </div>
                            </td>
                            <td className="is-der">
                              <span
                                className={
                                  'hi-cantidad ' + (m.cantidad > 0 ? 'hi-cantidad--entra' : 'hi-cantidad--sale')
                                }
                              >
                                {m.cantidad > 0 ? (
                                  <ArrowUp size={13} aria-hidden="true" />
                                ) : (
                                  <ArrowDown size={13} aria-hidden="true" />
                                )}
                                {m.cantidad > 0 ? '+' : ''}
                                {m.cantidad}
                                <span>{textoUnidad(unidad, m.cantidad)}</span>
                              </span>
                            </td>
                            <td className="is-der hi-stock">
                              {m.stockDespues}
                              <span>{textoUnidad(unidad, m.stockDespues)}</span>
                            </td>
                            <td>
                              <span className="hi-usuario">
                                <span className="hi-avatar" aria-hidden="true">
                                  {iniciales(m.usuario)}
                                </span>
                                {m.usuario}
                              </span>
                            </td>
                            <td>
                              <span className={'hi-origen' + (m.tipo === 'venta' ? ' hi-origen--venta' : '')}>
                                <Icono size={13} aria-hidden="true" />
                                {textoOrigen(m)}
                              </span>
                            </td>
                            <td className="is-der">
                              <ChevronDown size={16} className="hi-chevron" aria-hidden="true" />
                            </td>
                          </tr>

                          {estaAbierto && Detalle && (
                            <tr className="hi-detalle-fila">
                              <td colSpan={8}>
                                <Detalle m={m} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>

                {/* ============ PAGINACIÓN ============ */}
                <div className="hi-paginacion">
                  <span>
                    Mostrando{' '}
                    <strong>
                      {inicio + 1}–{Math.min(inicio + POR_PAGINA, filtrados.length)}
                    </strong>{' '}
                    de <strong>{filtrados.length}</strong> movimientos
                  </span>

                  {totalPaginas > 1 && (
                    <div className="hi-paginacion__botones">
                      <button
                        type="button"
                        disabled={paginaActual === 1}
                        onClick={() => {
                          setPagina(paginaActual - 1)
                          setAbierto(null)
                        }}
                      >
                        <ChevronLeft size={15} aria-hidden="true" />
                        Anterior
                      </button>

                      {paginasVisibles(totalPaginas, paginaActual).map((n, i) =>
                        n === '…' ? (
                          <span key={`puntos-${i}`} className="hi-paginacion__puntos">
                            …
                          </span>
                        ) : (
                          <button
                            key={n}
                            type="button"
                            className={'hi-pagina' + (n === paginaActual ? ' is-activa' : '')}
                            onClick={() => {
                              setPagina(n)
                              setAbierto(null)
                            }}
                            aria-current={n === paginaActual ? 'page' : undefined}
                          >
                            {n}
                          </button>
                        )
                      )}

                      <button
                        type="button"
                        disabled={paginaActual === totalPaginas}
                        onClick={() => {
                          setPagina(paginaActual + 1)
                          setAbierto(null)
                        }}
                      >
                        Siguiente
                        <ChevronRight size={15} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}