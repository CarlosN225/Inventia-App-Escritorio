import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
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
  ShieldCheck,
  FileSpreadsheet,
  FileText,
} from 'lucide-react'

import { getUsuarioActual } from '../services/auth'
import { listarProductos, mensajeDeError } from '../services/productos'
import { listarMovimientos } from '../services/movimientos'
import { listarVentas } from '../services/ventas'
import { listarCompras } from '../services/compras'
import { textoUnidad } from '../utils/unidades'
import { exportarExcel, exportarPDF } from '../utils/exportarHistorial'
import useConfiguracion from '../hooks/useConfiguracion'
import { notificar } from '../services/notificar'
import '../styles/historial.css'

const POR_PAGINA = 10

// El tipo del backend -> cómo se muestra
const TIPOS = {
  entrada: { label: 'Entrada', clase: 'compra', color: '#14a06b', icono: Truck },
  salida: { label: 'Venta', clase: 'venta', color: '#1668e3', icono: ShoppingCart },
  merma: { label: 'Merma', clase: 'merma', color: '#dc2626', icono: PackageMinus },
  correccion: { label: 'Corrección', clase: 'correccion', color: '#7c3aed', icono: ClipboardCheck },
}

// Filtro especial (no es un tipo de movimiento): ventas con algún precio cambiado
const FILTRO_PRECIOS = 'precios'

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

// ¿Esta venta trae algún precio cambiado a mano?
function tieneEditado(r) {
  return r.esGrupo && r.tipo === 'salida' && (r.ticket?.detalles ?? []).some((d) => d.tipo_precio === 'editado')
}

// "Ajuste de precio · lo cambió Luis · autorizó Ana"
function textoBitacora(d, vendedor) {
  const partes = [d.motivo_precio || 'Sin motivo', `lo cambió ${primerNombre(vendedor)}`]
  if (d.autorizado_por_nombre) partes.push(`autorizó ${primerNombre(d.autorizado_por_nombre)}`)
  return partes.join(' · ')
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
    const motivos = (r.ticket?.detalles ?? []).map((d) => d.motivo_precio ?? '').join(' ')
    return normalizar(`${etiquetaTipo(r)} ${r.folio} ${nombres} ${extra} ${motivos}`)
  }
  return normalizar(`${r.productoNombreFinal} ${textoOrigen(r)} ${r.motivo}`)
}

/* ---------- Lo que va en el Excel y el PDF (producto por producto) ---------- */

function armarFilasExportacion(renglones) {
  return renglones.flatMap((r) => {
    const movimientos = r.esGrupo ? r.movimientos : [r]
    const esVenta = r.esGrupo && r.tipo === 'salida'

    return movimientos.map((m) => {
      const d = esVenta ? (r.ticket?.detalles ?? []).find((x) => x.producto === m.productoId) : null

      let bitacora = ''
      if (d?.tipo_precio === 'editado') {
        bitacora = `De ${moneda.format(Number(d.precio_lista ?? 0))} a ${moneda.format(Number(d.precio_unitario))} · ${textoBitacora(d, r.usuarioNombre)}`
      } else if (d && d.tipo_precio !== 'normal') {
        bitacora = ETIQUETAS_PRECIO[d.tipo_precio]?.texto ?? ''
      }

      return {
        fecha: new Date(m.fecha),
        tipo: etiquetaTipo(r),
        clase: (TIPOS[r.tipo] ?? TIPOS.correccion).clase,
        folio: r.esGrupo ? `${etiquetaTipo(r)} #${r.folio}` : '',
        producto: m.productoNombreFinal,
        cantidad: cambioDeStock(m),
        unidad: textoUnidad(m.unidad, m.cantidad, true),
        stock: m.stockResultante ?? '',
        usuario: m.usuarioNombre ?? '',
        detalle: r.esGrupo ? (r.tipo === 'entrada' ? r.ticket?.proveedor ?? '' : '') : textoOrigen(m),
        precio: d ? Number(d.precio_unitario) : null,
        bitacora,
      }
    })
  })
}

// Cuántos de cada tipo y cuánto sumaron (para la hoja "Resumen" y los cuadritos del PDF)
function armarResumen(renglones) {
  const conceptos = [
    { clave: 'venta', concepto: 'Ventas', clase: 'venta', registros: 0, importe: 0 },
    { clave: 'compra', concepto: 'Compras', clase: 'compra', registros: 0, importe: 0 },
    { clave: 'entrada', concepto: 'Otras entradas', clase: 'compra', registros: 0, importe: null },
    { clave: 'merma', concepto: 'Mermas', clase: 'merma', registros: 0, importe: null },
    { clave: 'correccion', concepto: 'Correcciones', clase: 'correccion', registros: 0, importe: null },
  ]
  const porClave = new Map(conceptos.map((c) => [c.clave, c]))

  renglones.forEach((r) => {
    if (r.esGrupo) {
      const c = porClave.get(r.tipo === 'salida' ? 'venta' : 'compra')
      c.registros += 1
      c.importe += Number(r.ticket?.total ?? 0)
    } else {
      const c = porClave.get(r.tipo === 'salida' ? 'venta' : r.tipo)
      if (c) c.registros += 1
    }
  })

  return {
    total: renglones.length,
    conceptos: conceptos.map((c) => ({ ...c, importe: c.importe ? c.importe : null })),
  }
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
              const precio = Number(esVenta ? d.precio_unitario : d.costo_unitario)
              const lista = esVenta && d.precio_lista ? Number(d.precio_lista) : null
              const cambio = lista !== null && Math.abs(lista - precio) >= 0.01
              const editado = esVenta && d.tipo_precio === 'editado'
              const autorizado = editado && d.autorizado_por_nombre
              const etiqueta = esVenta && !autorizado ? ETIQUETAS_PRECIO[d.tipo_precio] : null

              return (
                <tr key={d.id} className={editado ? 'is-editado' : ''}>
                  <td>
                    {d.producto_nombre}
                    {editado && <span className="hi-bitacora">{textoBitacora(d, r.usuarioNombre)}</span>}
                  </td>
                  <td className="is-der">
                    {d.cantidad} {textoUnidad(unidad(d.producto), d.cantidad)}
                  </td>
                  <td>
                    <span className="hi-precio">
                      {cambio && <s className="hi-tachado">{moneda.format(lista)}</s>}
                      <strong>{moneda.format(precio)}</strong>
                      {autorizado && (
                        <span className="hi-chip hi-chip--autorizado" title={d.motivo_precio}>
                          <ShieldCheck size={11} aria-hidden="true" />
                          Autorizó {primerNombre(d.autorizado_por_nombre)}
                        </span>
                      )}
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
      totalTexto = 'Lo que se perdió (aprox.)'
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
      { dt: 'Motivo', dd: m.motivo || 'Sin nota', clase: m.motivo ? '' : 'is-tenue' },
    ]
    if (puedeVerCostos && m.costo !== null) {
      total = m.cantidad * m.costo
      totalTexto = 'Valor del ajuste'
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

  const configuracion = useConfiguracion()
  const [menuExportar, setMenuExportar] = useState(false)
  const [exportando, setExportando] = useState(null) // 'excel' | 'pdf' | null
  const menuRef = useRef(null)

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

  // Cierra el menú de exportar al dar clic fuera o con Esc
  useEffect(() => {
    if (!menuExportar) return undefined

    function alClicFuera(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuExportar(false)
    }
    function alPresionarEsc(e) {
      if (e.key === 'Escape') setMenuExportar(false)
    }

    document.addEventListener('mousedown', alClicFuera)
    document.addEventListener('keydown', alPresionarEsc)
    return () => {
      document.removeEventListener('mousedown', alClicFuera)
      document.removeEventListener('keydown', alPresionarEsc)
    }
  }, [menuExportar])

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
    if (tieneEditado(r)) conteo[FILTRO_PRECIOS] = (conteo[FILTRO_PRECIOS] || 0) + 1
    return conteo
  }, {})

  const filtrados =
    tipo === 'todos'
      ? sinFiltroDeTipo
      : tipo === FILTRO_PRECIOS
      ? sinFiltroDeTipo.filter(tieneEditado)
      : sinFiltroDeTipo.filter((r) => r.tipo === tipo)

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicio = (paginaActual - 1) * POR_PAGINA
  const enPagina = filtrados.slice(inicio, inicio + POR_PAGINA)

  /* ---------- Exportar lo que se está viendo ---------- */

  async function exportar(formato) {
    setMenuExportar(false)
    setExportando(formato)

    const nombreTipo =
      tipo === FILTRO_PRECIOS
        ? 'Precios editados'
        : tipo === 'entrada'
        ? 'Compras y entradas'
        : tipo === 'salida'
        ? 'Ventas'
        : TIPOS[tipo]?.label

    const contexto = {
      negocio: configuracion?.negocio?.nombre ?? '',
      periodo: rango.dias === null ? 'Todo el historial' : rango.dias === 0 ? 'Hoy' : `Últimos ${rango.dias} días`,
      filtros: [
        tipo !== 'todos' && `Tipo: ${nombreTipo}`,
        usuario !== 'todos' && `Usuario: ${usuario}`,
        busqueda.trim() && `Búsqueda: "${busqueda.trim()}"`,
      ].filter(Boolean),
      resumen: armarResumen(filtrados),
    }

    try {
      const filas = armarFilasExportacion(filtrados)
      if (formato === 'excel') await exportarExcel(filas, contexto)
      else await exportarPDF(filas, contexto)
      notificar({ texto: formato === 'excel' ? 'Listo, se descargó tu Excel.' : 'Listo, se descargó tu PDF.' })
    } catch (e) {
      console.error(e)
      notificar({ tipo: 'error', texto: 'No se pudo crear el archivo. Inténtalo otra vez.' })
    } finally {
      setExportando(null)
    }
  }

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
      if (copia.has(clave)) copia.delete(clave)
      else copia.add(clave)
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
        {/* Exportar: Excel o PDF de lo que estás viendo */}
        <div className="hi-exportar" ref={menuRef}>
          <button
            type="button"
            className="hi-boton"
            disabled={filtrados.length === 0 || exportando !== null}
            onClick={() => setMenuExportar((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuExportar}
            title="Descarga lo que estás viendo en pantalla"
          >
            {exportando ? (
              <Loader2 size={16} className="hi-girando" aria-hidden="true" />
            ) : (
              <Download size={16} aria-hidden="true" />
            )}
            {exportando ? 'Preparando…' : 'Exportar'}
            {!exportando && <ChevronDown size={14} aria-hidden="true" />}
          </button>

          {menuExportar && (
            <div className="hi-exportar__menu" role="menu">
              <button type="button" role="menuitem" onClick={() => exportar('excel')}>
                <span className="hi-exportar__icono hi-exportar__icono--excel" aria-hidden="true">
                  <FileSpreadsheet size={17} />
                </span>
                <span>
                  <strong>Excel</strong>
                  <small>Para hacer cuentas o filtrar</small>
                </span>
              </button>
              <button type="button" role="menuitem" onClick={() => exportar('pdf')}>
                <span className="hi-exportar__icono hi-exportar__icono--pdf" aria-hidden="true">
                  <FileText size={17} />
                </span>
                <span>
                  <strong>PDF</strong>
                  <small>Para imprimir o guardar</small>
                </span>
              </button>
              <p className="hi-exportar__nota">Se descarga solo lo que tienes filtrado.</p>
            </div>
          )}
        </div>
      </header>

      <p className="hi-candado">
        <Lock size={16} aria-hidden="true" />
        <span>
          Aquí nada se puede editar ni borrar. <strong>Así tus cuentas siempre cuadran.</strong>
        </span>
      </p>

      {/* ============ FILTROS ============ */}
      <section className="hi-panel">
        <div className="hi-filtros">
          <div className="hi-buscador">
            <Search size={16} className="hi-buscador__icono" aria-hidden="true" />
            <input
              type="text"
              placeholder="Busca un producto, folio, proveedor o motivo…"
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

          {/* La bitácora de precios: solo las ventas con algún precio cambiado */}
          <button
            type="button"
            className={'hi-tipo-filtro hi-tipo-filtro--precios' + (tipo === FILTRO_PRECIOS ? ' is-activo' : '')}
            onClick={() => cambiarTipo(FILTRO_PRECIOS)}
            title="Ventas donde alguien le cambió el precio a un producto"
          >
            <ShieldCheck size={13} aria-hidden="true" />
            Precios editados
            <span className="hi-tipo-filtro__conteo">{conteoPorTipo[FILTRO_PRECIOS] || 0}</span>
          </button>

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
            Trayendo tu historial…
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
            {tipo === FILTRO_PRECIOS
              ? 'En estas fechas nadie cambió precios.'
              : rangoId === 'hoy' && !busqueda && tipo === 'todos'
              ? 'Hoy todavía no se ha movido nada.'
              : 'No encontramos nada con esos filtros. Prueba con otras fechas o borra la búsqueda.'}
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
                          <span className="hi-producto__nombre">
                            {titulo}
                            {tieneEditado(r) && (
                              <span className="hi-escudo" title="Aquí se cambió un precio con permiso">
                                <ShieldCheck size={13} aria-label="Con precios autorizados" />
                              </span>
                            )}
                          </span>
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
                        <span className="hi-cantidad hi-cantidad--neutra">{r.movimientos.length} productos</span>
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
                Viendo{' '}
                <strong>
                  {inicio + 1}–{Math.min(inicio + POR_PAGINA, filtrados.length)}
                </strong>{' '}
                de <strong>{filtrados.length}</strong>
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