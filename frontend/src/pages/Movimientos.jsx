import { Fragment, useEffect, useMemo, useState } from 'react'
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
  SearchX,
  Loader2,
  RotateCcw,
  AlertCircle,
  Info,
} from 'lucide-react'

import { getUsuarioActual } from '../services/auth'
import { listarProductos, mensajeDeError } from '../services/productos'
import { listarMovimientos } from '../services/movimientos'
import { textoUnidad } from '../utils/unidades'
import '../styles/historial.css'

const POR_PAGINA = 10

// El tipo del backend -> cómo se muestra
const TIPOS = {
  entrada: { label: 'Entrada', clase: 'compra', color: '#14a06b', icono: Truck },
  salida: { label: 'Venta', clase: 'venta', color: '#1668e3', icono: ShoppingCart },
  merma: { label: 'Merma', clase: 'merma', color: '#dc2626', icono: PackageMinus },
  correccion: { label: 'Corrección', clase: 'correccion', color: '#7c3aed', icono: ClipboardCheck },
}

const MOTIVOS_MERMA = {
  caducado: 'Caducado',
  danado: 'Dañado',
  consumo_propio: 'Consumo propio',
  devolucion_proveedor: 'Devolución a proveedor',
  otro: 'Otro',
}

const RANGOS = [
  { id: 'hoy', label: 'Hoy', dias: 0 },
  { id: '7', label: '7 días', dias: 7 },
  { id: '30', label: '30 días', dias: 30 },
  { id: 'todo', label: 'Todo', dias: null },
]

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const formatoDia = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' })
const formatoLargo = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
const formatoHora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })

function normalizar(texto) {
  return (texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function iniciales(nombre) {
  const partes = (nombre ?? '').trim().split(/\s+/)
  if (!partes[0]) return '?'
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (partes[0][0] + ultima).toUpperCase()
}

function primerNombre(nombre) {
  return (nombre ?? '').trim().split(/\s+/)[0] || '—'
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

// Cuánto cambió el stock con este movimiento (con signo)
function cambioDeStock(m) {
  if (m.tipo === 'entrada') return m.cantidad
  if (m.tipo === 'correccion') return m.cantidad // ya viene con signo (+ sobrante, - faltante)
  return -m.cantidad // salida y merma
}

function etiquetaTipo(m) {
  if (m.tipo === 'entrada' && m.compraId) return 'Compra'
  return TIPOS[m.tipo]?.label ?? m.tipo
}

// Texto de la columna "Origen"
function textoOrigen(m) {
  if (m.tipo === 'salida') return m.ventaId ? `Venta #${m.ventaId}` : 'Venta'
  if (m.tipo === 'entrada') return m.compraId ? `Compra #${m.compraId}` : m.motivo || 'Entrada'
  if (m.tipo === 'merma') return MOTIVOS_MERMA[m.motivoMerma] ?? 'Merma'
  return m.motivo || 'Corrección'
}

/* ---------- Exportar a CSV (abre en Excel) ---------- */

function exportarCSV(lista) {
  const encabezado = ['Fecha', 'Hora', 'Tipo', 'Producto', 'Cantidad', 'Unidad', 'Stock después', 'Usuario', 'Origen', 'Nota']

  const filas = lista.map((m) => {
    const fecha = new Date(m.fecha)
    return [
      formatoDia.format(fecha),
      formatoHora.format(fecha),
      etiquetaTipo(m),
      m.productoNombreFinal,
      cambioDeStock(m),
      textoUnidad(m.unidad, m.cantidad, true),
      m.stockResultante ?? '',
      m.usuarioNombre ?? '',
      textoOrigen(m),
      m.tipo === 'merma' ? m.motivo : '',
    ]
  })

  const csv = [encabezado, ...filas]
    .map((fila) => fila.map((valor) => `"${String(valor ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n')

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `historial-inventia-${new Date().toISOString().slice(0, 10)}.csv`
  enlace.click()
  URL.revokeObjectURL(url)
}

/* ---------- Detalle desplegable ---------- */

function Detalle({ m, puedeVerCostos }) {
  const tipo = TIPOS[m.tipo] ?? TIPOS.correccion
  const Icono = tipo.icono
  const fecha = new Date(m.fecha)
  const unidadLarga = (n) => textoUnidad(m.unidad, n, true)
  const antes = m.stockResultante !== null ? m.stockResultante - cambioDeStock(m) : null

  let datos = []
  let total = null
  let totalTexto = ''

  if (m.tipo === 'merma') {
    datos = [
      { dt: 'Motivo', dd: MOTIVOS_MERMA[m.motivoMerma] ?? 'Otro' },
      { dt: 'Se dieron de baja', dd: `${m.cantidad} ${unidadLarga(m.cantidad)}`, clase: 'is-rojo' },
      { dt: 'Stock después', dd: m.stockResultante ?? '—' },
      { dt: 'Nota', dd: m.motivo || 'Sin nota', clase: m.motivo ? '' : 'is-tenue' },
    ]
    if (puedeVerCostos && m.costo !== null) {
      total = m.cantidad * m.costo
      totalTexto = 'Pérdida estimada'
    }
  } else if (m.tipo === 'correccion') {
    datos = [
      { dt: 'Antes → después', dd: antes !== null ? `${antes} → ${m.stockResultante} ${textoUnidad(m.unidad, m.stockResultante)}` : '—' },
      {
        dt: 'Diferencia',
        dd: `${m.cantidad > 0 ? '+' : ''}${m.cantidad} ${textoUnidad(m.unidad, m.cantidad)}`,
        clase: m.cantidad < 0 ? 'is-rojo' : 'is-verde',
      },
      { dt: 'Motivo / nota', dd: m.motivo || 'Sin nota', clase: m.motivo ? '' : 'is-tenue' },
    ]
    if (puedeVerCostos && m.costo !== null) {
      total = m.cantidad * m.costo
      totalTexto = 'Impacto'
    }
  } else if (m.tipo === 'entrada') {
    datos = [
      { dt: 'Origen', dd: textoOrigen(m) },
      { dt: 'Entraron', dd: `${m.cantidad} ${unidadLarga(m.cantidad)}`, clase: 'is-verde' },
      { dt: 'Stock después', dd: m.stockResultante ?? '—' },
    ]
  } else {
    datos = [
      { dt: 'Folio', dd: m.ventaId ? `Venta #${m.ventaId}` : '—' },
      { dt: 'Se vendieron', dd: `${m.cantidad} ${unidadLarga(m.cantidad)}` },
      { dt: 'Stock después', dd: m.stockResultante ?? '—' },
    ]
  }

  return (
    <div className="hi-detalle">
      <header className="hi-detalle__cabecera">
        <span className="hi-detalle__icono" aria-hidden="true">
          <Icono size={17} />
        </span>
        <div className="hi-detalle__titulos">
          <p className="hi-detalle__titulo">
            {etiquetaTipo(m)} · {m.productoNombreFinal}
          </p>
          <p className="hi-detalle__sub">
            {formatoLargo.format(fecha)} · {formatoHora.format(fecha)} · {m.usuarioNombre ?? 'Sin usuario'}
          </p>
        </div>
        {total !== null && (
          <div className="hi-detalle__total">
            <span>{totalTexto}</span>
            <strong>{moneda.format(total)}</strong>
          </div>
        )}
      </header>

      <dl className="hi-datos">
        {datos.map((d) => (
          <div key={d.dt}>
            <dt>{d.dt}</dt>
            <dd className={d.clase ?? ''}>{d.dd}</dd>
          </div>
        ))}
      </dl>

      {(m.ventaId || m.compraId) && (
        <p className="hi-detalle__pendiente">
          <Info size={14} aria-hidden="true" />
          El ticket completo de {m.ventaId ? 'la venta' : 'la compra'} aparecerá aquí en cuanto se conecte.
        </p>
      )}
    </div>
  )
}

/* ---------- Pantalla ---------- */

export default function Movimientos() {
  const location = useLocation()
  const usuarioInicial = location.state?.usuario

  const [movimientos, setMovimientos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [usuarioActual, setUsuarioActual] = useState(null)

  const [busqueda, setBusqueda] = useState('')
  const [rangoId, setRangoId] = useState(usuarioInicial ? 'todo' : '7')
  const [tipo, setTipo] = useState('todos')
  const [usuario, setUsuario] = useState('todos')
  const [pagina, setPagina] = useState(1)
  const [abierto, setAbierto] = useState(null)

  async function cargar() {
    setCargando(true)
    setError(null)

    try {
      const [listaMovimientos, listaProductos] = await Promise.all([listarMovimientos(), listarProductos()])
      const productosPorId = new Map(listaProductos.map((p) => [p.id, p]))

      setMovimientos(
        listaMovimientos
          .map((m) => {
            const p = productosPorId.get(m.productoId)
            return {
              ...m,
              productoNombreFinal: m.productoNombre ?? p?.nombre ?? `Producto #${m.productoId}`,
              unidad: p?.unidad ?? 'pieza',
              costo: p?.costo ?? null,
            }
          })
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      )
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    getUsuarioActual()
      .then(setUsuarioActual)
      .catch(() => setUsuarioActual(null))

    cargar()
  }, [])

  const puedeVerCostos = usuarioActual?.rol === 'propietario'

  // Usuarios que aparecen en los movimientos
  const usuarios = useMemo(
    () => [...new Set(movimientos.map((m) => m.usuarioNombre).filter(Boolean))].sort(),
    [movimientos]
  )

  // Si viene de Mi perfil, filtra por ese usuario
  useEffect(() => {
    if (!usuarioInicial || usuarios.length === 0) return
    const encontrado = usuarios.find((u) => u.startsWith(usuarioInicial))
    if (encontrado) setUsuario(encontrado)
  }, [usuarioInicial, usuarios])

  const rango = RANGOS.find((r) => r.id === rangoId)
  const texto = normalizar(busqueda.trim())

  // Primero todo menos el tipo (para contar cuántos hay de cada tipo)
  const sinFiltroDeTipo = movimientos.filter((m) => {
    if (!dentroDeRango(m.fecha, rango)) return false
    if (usuario !== 'todos' && m.usuarioNombre !== usuario) return false
    if (texto) {
      const buscable = normalizar(
        `${m.productoNombreFinal} ${textoOrigen(m)} ${m.motivo} ${m.ventaId ?? ''} ${m.compraId ?? ''}`
      )
      if (!buscable.includes(texto)) return false
    }
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

  function irAPagina(n) {
    setPagina(n)
    setAbierto(null)
  }

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

      {/* ============ FILTROS ============ */}
      <section className="hi-panel">
        <div className="hi-filtros">
          <div className="hi-buscador">
            <Search size={16} className="hi-buscador__icono" aria-hidden="true" />
            <input
              type="text"
              placeholder="Busca por producto, folio o motivo…"
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
              {id === 'entrada' ? 'Entradas' : t.label}
              <span className="hi-tipo-filtro__conteo">{conteoPorTipo[id] || 0}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ============ TABLA ============ */}
      <section className="hi-panel hi-panel--tabla">
        {cargando ? (
          <div className="hi-vacio">
            <Loader2 size={26} className="hi-girando" aria-hidden="true" />
            Cargando movimientos…
          </div>
        ) : error ? (
          <div className="hi-vacio">
            <AlertCircle size={26} className="hi-icono-error" aria-hidden="true" />
            {error}
            <button type="button" className="hi-boton" onClick={cargar}>
              <RotateCcw size={15} aria-hidden="true" />
              Reintentar
            </button>
          </div>
        ) : filtrados.length === 0 ? (
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
                  const t = TIPOS[m.tipo] ?? TIPOS.correccion
                  const Icono = t.icono
                  const fecha = new Date(m.fecha)
                  const cambio = cambioDeStock(m)
                  const estaAbierto = abierto === m.id

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
                          <span className={`hi-tipo hi-tipo--${t.clase}`}>{etiquetaTipo(m)}</span>
                        </td>
                        <td>
                          <div className="hi-producto">
                            <span className="hi-placeholder" aria-hidden="true">
                              <Candy size={14} />
                            </span>
                            <span className="hi-producto__nombre">{m.productoNombreFinal}</span>
                          </div>
                        </td>
                        <td className="is-der">
                          <span className={'hi-cantidad ' + (cambio > 0 ? 'hi-cantidad--entra' : 'hi-cantidad--sale')}>
                            {cambio > 0 ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" />}
                            {cambio > 0 ? '+' : ''}
                            {cambio}
                            <span>{textoUnidad(m.unidad, cambio)}</span>
                          </span>
                        </td>
                        <td className="is-der hi-stock">
                          {m.stockResultante ?? '—'}
                          {m.stockResultante !== null && <span>{textoUnidad(m.unidad, m.stockResultante)}</span>}
                        </td>
                        <td>
                          <span className="hi-usuario">
                            <span className="hi-avatar" aria-hidden="true">
                              {iniciales(m.usuarioNombre)}
                            </span>
                            {primerNombre(m.usuarioNombre)}
                          </span>
                        </td>
                        <td>
                          <span className={'hi-origen' + (m.tipo === 'salida' ? ' hi-origen--venta' : '')}>
                            <Icono size={13} aria-hidden="true" />
                            {textoOrigen(m)}
                          </span>
                        </td>
                        <td className="is-der">
                          <ChevronDown size={16} className="hi-chevron" aria-hidden="true" />
                        </td>
                      </tr>

                      {estaAbierto && (
                        <tr className="hi-detalle-fila">
                          <td colSpan={8}>
                            <Detalle m={m} puedeVerCostos={puedeVerCostos} />
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
                  <button type="button" disabled={paginaActual === 1} onClick={() => irAPagina(paginaActual - 1)}>
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
                        onClick={() => irAPagina(n)}
                        aria-current={n === paginaActual ? 'page' : undefined}
                      >
                        {n}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    disabled={paginaActual === totalPaginas}
                    onClick={() => irAPagina(paginaActual + 1)}
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
    </div>
  )
}