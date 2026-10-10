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
  Receipt,
} from 'lucide-react'

import { getUsuarioActual } from '../services/auth'
import { listarProductos, mensajeDeError } from '../services/productos'
import { listarMovimientos } from '../services/movimientos'
import { listarVentas } from '../services/ventas'
import { listarCompras } from '../services/compras'
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

const ETIQUETAS_PRECIO = {
  mayoreo: { texto: 'Mayoreo', clase: 'mayoreo' },
  promocion: { texto: 'Promoción', clase: 'promo' },
  editado: { texto: 'Precio editado', clase: 'editado' },
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
const formatoCaducidad = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })

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

// Cuánto cambió el stock con un movimiento (con signo)
function cambioDeStock(m) {
  if (m.tipo === 'entrada' || m.tipo === 'correccion') return m.cantidad
  return -m.cantidad
}

// "Hot Wheels, Hershey's y 4 más"
function resumenNombres(nombres) {
  if (nombres.length <= 2) return nombres.join(', ')
  return `${nombres.slice(0, 2).join(', ')} y ${nombres.length - 2} más`
}

function aFechaLocal(iso) {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

/* ---------- Arma los renglones: un ticket por venta o compra; lo demás, uno por movimiento ---------- */

function armarRenglones(movimientos, ventasPorId, comprasPorId) {
  const grupos = new Map()
  const sueltos = []

  movimientos.forEach((m) => {
    if (m.ventaId || m.compraId) {
      const esVenta = !!m.ventaId
      const clave = esVenta ? `v-${m.ventaId}` : `c-${m.compraId}`

      if (!grupos.has(clave)) {
        const ticket = esVenta ? ventasPorId.get(m.ventaId) : comprasPorId.get(m.compraId)

        grupos.set(clave, {
          clave,
          esGrupo: true,
          tipo: esVenta ? 'salida' : 'entrada',
          folio: esVenta ? m.ventaId : m.compraId,
          ticket,
          fecha: m.fecha,
          usuarioNombre: m.usuarioNombre,
          movimientos: [],
        })
      }

      grupos.get(clave).movimientos.push(m)
    } else {
      sueltos.push({ ...m, clave: `m-${m.id}`, esGrupo: false })
    }
  })

  return [...grupos.values(), ...sueltos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
}

function etiquetaTipo(r) {
  if (r.esGrupo) return r.tipo === 'salida' ? 'Venta' : 'Compra'
  return TIPOS[r.tipo]?.label ?? r.tipo
}

function textoOrigen(m) {
  if (m.tipo === 'entrada') return m.motivo || 'Entrada'
  if (m.tipo === 'merma') return MOTIVOS_MERMA[m.motivoMerma] ?? 'Merma'
  return m.motivo || 'Corrección'
}

function textoBuscable(r) {
  if (r.esGrupo) {
    const nombres = r.movimientos.map((m) => m.productoNombreFinal).join(' ')
    const extra = r.tipo === 'entrada' ? `${r.ticket?.proveedor ?? ''} ${r.ticket?.nota ?? ''}` : ''
    return normalizar(`${etiquetaTipo(r)} ${r.folio} ${nombres} ${extra}`)
  }
  return normalizar(`${r.productoNombreFinal} ${textoOrigen(r)} ${r.motivo}`)
}

/* ---------- Exportar a CSV (producto por producto, para Excel) ---------- */

function exportarCSV(renglones) {
  const encabezado = ['Fecha', 'Hora', 'Tipo', 'Folio', 'Producto', 'Cantidad', 'Unidad', 'Stock después', 'Usuario', 'Detalle']

  const filas = renglones.flatMap((r) => {
    const movimientos = r.esGrupo ? r.movimientos : [r]

    return movimientos.map((m) => {
      const fecha = new Date(m.fecha)
      return [
        formatoDia.format(fecha),
        formatoHora.format(fecha),
        etiquetaTipo(r),
        r.esGrupo ? `${etiquetaTipo(r)} #${r.folio}` : '',
        m.productoNombreFinal,
        cambioDeStock(m),
        textoUnidad(m.unidad, m.cantidad, true),
        m.stockResultante ?? '',
        m.usuarioNombre ?? '',
        r.esGrupo ? (r.tipo === 'entrada' ? r.ticket?.proveedor ?? '' : '') : textoOrigen(m),
      ]
    })
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

/* ---------- Detalle de un ticket (venta o compra) ---------- */

function DetalleTicket({ r, unidades }) {
  const esVenta = r.tipo === 'salida'
  const fecha = new Date(r.fecha)
  const t = r.ticket
  const unidad = (idProducto) => unidades.get(idProducto) ?? 'pieza'

  return (
    <div className="hi-detalle">
      <header className="hi-detalle__cabecera">
        <span className="hi-detalle__icono" aria-hidden="true">
          {esVenta ? <Receipt size={17} /> : <Truck size={17} />}
        </span>
        <div className="hi-detalle__titulos">
          <p className="hi-detalle__titulo">
            {esVenta ? `Venta #${r.folio}` : `Compra #${r.folio}${t?.proveedor ? ` · ${t.proveedor}` : ''}`}
          </p>
          <p className="hi-detalle__sub">
            {formatoLargo.format(fecha)} · {formatoHora.format(fecha)} · {r.usuarioNombre ?? 'Sin usuario'}
            {!esVenta && t?.nota ? ` · ${t.nota}` : ''}
          </p>
        </div>
        {t && (
          <div className="hi-detalle__total">
            <span>{esVenta ? 'Total de la venta' : 'Total de la compra'}</span>
            <strong>{moneda.format(Number(t.total))}</strong>
          </div>
        )}
      </header>

      {t ? (
        <table className="hi-detalle__tabla">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="is-der">{esVenta ? 'Cantidad' : 'Entraron'}</th>
              <th>{esVenta ? 'Precio' : 'Costo'}</th>
              {!esVenta && <th>Caducidad</th>}
              <th className="is-der">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {t.detalles.map((d) => {
              const etiqueta = esVenta ? ETIQUETAS_PRECIO[d.tipo_precio] : null

              return (
                <tr key={d.id}>
                  <td>{d.producto_nombre}</td>
                  <td className="is-der">
                    {d.cantidad} {textoUnidad(unidad(d.producto), d.cantidad)}
                  </td>
                  <td>
                    <span className="hi-precio">
                      <strong>{moneda.format(Number(esVenta ? d.precio_unitario : d.costo_unitario))}</strong>
                      {etiqueta && <span className={`hi-chip hi-chip--${etiqueta.clase}`}>{etiqueta.texto}</span>}
                    </span>
                  </td>
                  {!esVenta && (
                    <td>{d.fecha_caducidad ? formatoCaducidad.format(aFechaLocal(d.fecha_caducidad)) : '—'}</td>
                  )}
                  <td className="is-der">
                    <strong>{moneda.format(Number(d.subtotal))}</strong>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        /* Si no se pudo traer el ticket, al menos los productos que se movieron */
        <table className="hi-detalle__tabla">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="is-der">Cantidad</th>
              <th className="is-der">Stock después</th>
            </tr>
          </thead>
          <tbody>
            {r.movimientos.map((m) => (
              <tr key={m.id}>
                <td>{m.productoNombreFinal}</td>
                <td className="is-der">
                  {m.cantidad} {textoUnidad(m.unidad, m.cantidad)}
                </td>
                <td className="is-der">{m.stockResultante ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/* ---------- Detalle de un movimiento suelto (merma, corrección, entrada) ---------- */

function DetalleMovimiento({ m, puedeVerCostos }) {
  const tipo = TIPOS[m.tipo] ?? TIPOS.correccion
  const Icono = tipo.icono
  const fecha = new Date(m.fecha)
  const antes = m.stockResultante !== null ? m.stockResultante - cambioDeStock(m) : null

  let datos = []
  let total = null
  let totalTexto = ''

  if (m.tipo === 'merma') {
    datos = [
      { dt: 'Motivo', dd: MOTIVOS_MERMA[m.motivoMerma] ?? 'Otro' },
      { dt: 'Se dieron de baja', dd: `${m.cantidad} ${textoUnidad(m.unidad, m.cantidad, true)}`, clase: 'is-rojo' },
      { dt: 'Stock después', dd: m.stockResultante ?? '—' },
      { dt: 'Nota', dd: m.motivo || 'Sin nota', clase: m.motivo ? '' : 'is-tenue' },
    ]
    if (puedeVerCostos && m.costo !== null) {
      total = m.cantidad * m.costo
      totalTexto = 'Pérdida estimada'
    }
  } else if (m.tipo === 'correccion') {
    datos = [
      {
        dt: 'Antes → después',
        dd: antes !== null ? `${antes} → ${m.stockResultante} ${textoUnidad(m.unidad, m.stockResultante)}` : '—',
      },
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
  } else {
    datos = [
      { dt: 'Origen', dd: textoOrigen(m) },
      { dt: 'Entraron', dd: `${m.cantidad} ${textoUnidad(m.unidad, m.cantidad, true)}`, clase: 'is-verde' },
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
    </div>
  )
}

/* ---------- Pantalla ---------- */

export default function Movimientos() {
  const location = useLocation()
  const usuarioInicial = location.state?.usuario

  const [renglonesBase, setRenglonesBase] = useState([])
  const [unidades, setUnidades] = useState(new Map())
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [usuarioActual, setUsuarioActual] = useState(null)

  const [busqueda, setBusqueda] = useState('')
  const [rangoId, setRangoId] = useState(usuarioInicial ? 'todo' : '7')
  const [tipo, setTipo] = useState('todos')
  const [usuario, setUsuario] = useState('todos')
  const [pagina, setPagina] = useState(1)
  const [abiertos, setAbiertos] = useState(() => new Set()) // varios tickets abiertos a la vez
  async function cargar() {
    setCargando(true)
    setError(null)

    try {
      const [listaMovimientos, listaProductos] = await Promise.all([listarMovimientos(), listarProductos()])

      // Los tickets son un extra: si fallan, se muestra lo que se movió
      const [ventas, compras] = await Promise.allSettled([listarVentas(), listarCompras()])
      const ventasPorId = new Map((ventas.status === 'fulfilled' ? ventas.value : []).map((v) => [v.id, v]))
      const comprasPorId = new Map((compras.status === 'fulfilled' ? compras.value : []).map((c) => [c.id, c]))

      const productosPorId = new Map(listaProductos.map((p) => [p.id, p]))
      setUnidades(new Map(listaProductos.map((p) => [p.id, p.unidad])))

      const movimientos = listaMovimientos.map((m) => {
        const p = productosPorId.get(m.productoId)
        return {
          ...m,
          productoNombreFinal: m.productoNombre ?? p?.nombre ?? `Producto #${m.productoId}`,
          unidad: p?.unidad ?? 'pieza',
          costo: p?.costo ?? null,
        }
      })

      setRenglonesBase(armarRenglones(movimientos, ventasPorId, comprasPorId))
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

  const usuarios = useMemo(
    () => [...new Set(renglonesBase.map((r) => r.usuarioNombre).filter(Boolean))].sort(),
    [renglonesBase]
  )

  // Si viene de Mi perfil, filtra por ese usuario
  useEffect(() => {
    if (!usuarioInicial || usuarios.length === 0) return
    const encontrado = usuarios.find((u) => u.startsWith(usuarioInicial))
    if (encontrado) setUsuario(encontrado)
  }, [usuarioInicial, usuarios])

  const rango = RANGOS.find((r) => r.id === rangoId)
  const texto = normalizar(busqueda.trim())

  const sinFiltroDeTipo = renglonesBase.filter((r) => {
    if (!dentroDeRango(r.fecha, rango)) return false
    if (usuario !== 'todos' && r.usuarioNombre !== usuario) return false
    if (texto && !textoBuscable(r).includes(texto)) return false
    return true
  })

  const conteoPorTipo = sinFiltroDeTipo.reduce((conteo, r) => {
    conteo[r.tipo] = (conteo[r.tipo] || 0) + 1
    return conteo
  }, {})

  const filtrados = tipo === 'todos' ? sinFiltroDeTipo : sinFiltroDeTipo.filter((r) => r.tipo === tipo)

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicio = (paginaActual - 1) * POR_PAGINA
  const enPagina = filtrados.slice(inicio, inicio + POR_PAGINA)

  function filtrar(setter) {
    return (valor) => {
      setter(valor)
      setPagina(1)
    }
  }

  const cambiarBusqueda = filtrar(setBusqueda)
  const cambiarRango = filtrar(setRangoId)
  const cambiarTipo = filtrar(setTipo)
  const cambiarUsuario = filtrar(setUsuario)

     function irAPagina(n) {
    setPagina(n)
  }

  // Abre o cierra un ticket sin tocar los demás
  function alternar(clave) {
    setAbiertos((actual) => {
      const copia = new Set(actual)
      copia.has(clave) ? copia.delete(clave) : copia.add(clave)
      return copia
    })
  }

  // Expandir o contraer todos los de la página que se está viendo
  const paginaAbierta = enPagina.length > 0 && enPagina.every((r) => abiertos.has(r.clave))

  function alternarPagina() {
    setAbiertos((actual) => {
      const copia = new Set(actual)
      enPagina.forEach((r) => (paginaAbierta ? copia.delete(r.clave) : copia.add(r.clave)))
      return copia
    })
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
          title="Descarga lo que estás viendo, producto por producto, para abrirlo en Excel"
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
              {id === 'entrada' ? 'Compras y entradas' : id === 'salida' ? 'Ventas' : t.label}
              <span className="hi-tipo-filtro__conteo">{conteoPorTipo[id] || 0}</span>
            </button>
          ))}
          
          {enPagina.length > 0 && (
            <button type="button" className="hi-expandir" onClick={alternarPagina}>
              <ChevronDown size={14} className={paginaAbierta ? 'is-girado' : ''} aria-hidden="true" />
              {paginaAbierta ? 'Contraer todo' : 'Expandir todo'}
            </button>
          )}
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
                {enPagina.map((r) => {
                  const t = TIPOS[r.tipo] ?? TIPOS.correccion
                  const Icono = r.esGrupo ? (r.tipo === 'salida' ? Receipt : Truck) : t.icono
                  const fecha = new Date(r.fecha)
                  const estaAbierto = abiertos.has(r.clave)

                  // Celdas que cambian entre ticket y movimiento suelto
                  let celdaProducto
                  let celdaCantidad
                  let celdaStock
                  let celdaOrigen

                  if (r.esGrupo) {
                    const nombres = r.movimientos.map((m) => m.productoNombreFinal)
                    const solo = r.movimientos.length === 1 ? r.movimientos[0] : null
                    const titulo =
                      r.tipo === 'salida'
                        ? `Venta #${r.folio}`
                        : `Compra #${r.folio}${r.ticket?.proveedor ? ` · ${r.ticket.proveedor}` : ''}`

                    celdaProducto = (
                      <div className="hi-producto">
                        <span className="hi-placeholder" aria-hidden="true">
                          <Icono size={14} />
                        </span>
                        <span className="hi-grupo">
                          <span className="hi-producto__nombre">{titulo}</span>
                          <span className="hi-grupo__sub">{resumenNombres(nombres)}</span>
                        </span>
                      </div>
                    )

                    if (solo) {
                      const cambio = cambioDeStock(solo)
                      celdaCantidad = (
                        <span className={'hi-cantidad ' + (cambio > 0 ? 'hi-cantidad--entra' : 'hi-cantidad--sale')}>
                          {cambio > 0 ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" />}
                          {cambio > 0 ? '+' : ''}
                          {cambio}
                          <span>{textoUnidad(solo.unidad, cambio)}</span>
                        </span>
                      )
                      celdaStock = solo.stockResultante ?? '—'
                    } else {
                      celdaCantidad = (
                        <span className="hi-cantidad hi-cantidad--neutra">
                          {r.movimientos.length} productos
                        </span>
                      )
                      celdaStock = '—'
                    }

                    celdaOrigen = r.ticket ? (
                      <span className="hi-total">{moneda.format(Number(r.ticket.total))}</span>
                    ) : (
                      <span className="hi-origen">{etiquetaTipo(r)}</span>
                    )
                  } else {
                    const cambio = cambioDeStock(r)

                    celdaProducto = (
                      <div className="hi-producto">
                        <span className="hi-placeholder" aria-hidden="true">
                          <Candy size={14} />
                        </span>
                        <span className="hi-producto__nombre">{r.productoNombreFinal}</span>
                      </div>
                    )
                    celdaCantidad = (
                      <span className={'hi-cantidad ' + (cambio > 0 ? 'hi-cantidad--entra' : 'hi-cantidad--sale')}>
                        {cambio > 0 ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" />}
                        {cambio > 0 ? '+' : ''}
                        {cambio}
                        <span>{textoUnidad(r.unidad, cambio)}</span>
                      </span>
                    )
                    celdaStock = (
                      <>
                        {r.stockResultante ?? '—'}
                        {r.stockResultante !== null && <span>{textoUnidad(r.unidad, r.stockResultante)}</span>}
                      </>
                    )
                    celdaOrigen = (
                       <span className="hi-origen" title={textoOrigen(r)}>
                        <Icono size={13} aria-hidden="true" />
                        {textoOrigen(r)}
                      </span>
                    )
                  }

                  return (
                    <Fragment key={r.clave}>
                      <tr
                        className={'hi-fila' + (estaAbierto ? ' is-abierta' : '')}
                        onClick={() => alternar(r.clave)}                        
                        aria-expanded={estaAbierto}
                      >
                        <td>
                          <div className="hi-fecha">
                            <strong>{formatoDia.format(fecha)}</strong>
                            <span>{formatoHora.format(fecha)} hrs</span>
                          </div>
                        </td>
                        <td>
                          <span className={`hi-tipo hi-tipo--${t.clase}`}>{etiquetaTipo(r)}</span>
                        </td>
                        <td>{celdaProducto}</td>
                        <td className="is-der">{celdaCantidad}</td>
                        <td className="is-der hi-stock">{celdaStock}</td>
                        <td>
                          <span className="hi-usuario">
                            <span className="hi-avatar" aria-hidden="true">
                              {iniciales(r.usuarioNombre)}
                            </span>
                            {primerNombre(r.usuarioNombre)}
                          </span>
                        </td>
                        <td>{celdaOrigen}</td>
                        <td className="is-der">
                          <ChevronDown size={16} className="hi-chevron" aria-hidden="true" />
                        </td>
                      </tr>

                      {estaAbierto && (
                        <tr className="hi-detalle-fila">
                          <td colSpan={8}>
                            {r.esGrupo ? (
                              <DetalleTicket r={r} unidades={unidades} />
                            ) : (
                              <DetalleMovimiento m={r} puedeVerCostos={puedeVerCostos} />
                            )}
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
                de <strong>{filtrados.length}</strong> registros
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