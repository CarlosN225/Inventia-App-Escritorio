import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  X,
  Plus,
  Minus,
  Trash2,
  Pencil,
  Zap,
  Receipt,
  Lock,
  Check,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Candy,
  ShoppingCart,
  CornerDownLeft,
  RotateCcw,
  PlusCircle,
  PackageOpen,
  Loader2,
} from 'lucide-react'

import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { listarProductos, mensajeDeError } from '../services/productos'
import { listarVentas, registrarVenta } from '../services/ventas'
import { mensajeDelBackend } from '../services/movimientos'
import { textoUnidad } from '../utils/unidades'
import '../styles/registrar-venta.css'

const MAX_RESULTADOS = 6
const MAX_RAPIDOS = 8

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

/* ============ Utilidades ============ */

function normalizar(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function redondear(n) {
  return Math.round(n * 100) / 100
}

// El precio más bajo que aplica: normal, mayoreo (si llega a la cantidad) o el que se editó
// TODO: sumar las promociones cuando tengan su endpoint
function calcularPrecio(producto, cantidad, precioEditado) {
  if (precioEditado !== null) return { precio: precioEditado, motivo: 'editado' }

  if (producto.precioMayoreo && producto.minimoMayoreo && cantidad >= producto.minimoMayoreo && producto.precioMayoreo < producto.precio) {
    return { precio: producto.precioMayoreo, motivo: 'mayoreo' }
  }

  return { precio: producto.precio, motivo: 'normal' }
}

function PastillaStock({ producto }) {
  const unidad = textoUnidad(producto.unidad, producto.stock)
  if (producto.stock === 0) return <span className="rv-stock rv-stock--agotado">Agotado</span>
  if (producto.stock < producto.minimo) {
    return (
      <span className="rv-stock rv-stock--bajo">
        Quedan {producto.stock} {unidad} · Stock bajo
      </span>
    )
  }
  return (
    <span className="rv-stock rv-stock--ok">
      Quedan {producto.stock} {unidad}
    </span>
  )
}

/* ============ Pantalla ============ */

export default function RegistrarVenta() {
  const navigate = useNavigate()
  const inputRef = useRef(null)

  // Datos del backend
  const [productos, setProductos] = useState([])
  const [rankingIds, setRankingIds] = useState([]) // ids de los más vendidos, de más a menos
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)

  // Venta en curso
  const [busqueda, setBusqueda] = useState('')
  const [resaltado, setResaltado] = useState(0)
  const [ticket, setTicket] = useState([])
  const [editando, setEditando] = useState(null)
  const [ventaRegistrada, setVentaRegistrada] = useState(null)
  const [errorVenta, setErrorVenta] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [dialogoCancelar, setDialogoCancelar] = useState(false)

  async function cargarProductos() {
    const lista = await listarProductos()
    setProductos(lista.filter((p) => p.activo))
  }

  // Más vendidos: suma de piezas vendidas por producto en todas las ventas
  async function cargarRanking() {
    const ventas = await listarVentas()
    const piezas = {}

    ventas.forEach((v) =>
      (v.detalles ?? []).forEach((d) => {
        piezas[d.producto] = (piezas[d.producto] || 0) + d.cantidad
      })
    )

    setRankingIds(
      Object.entries(piezas)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => Number(id))
    )
  }

  async function cargarTodo() {
    setCargando(true)
    setErrorCarga(null)

    try {
      await cargarProductos()
      await cargarRanking().catch(() => setRankingIds([])) // si falla, solo no hay ranking
    } catch (e) {
      setErrorCarga(mensajeDeError(e))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarTodo()
  }, [])

  const productosPorId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])

  // Los más vendidos de verdad; si todavía hay pocas ventas, se completa con otros con stock
  const masVendidos = useMemo(() => {
    const reales = rankingIds.map((id) => productosPorId.get(id)).filter(Boolean)
    const relleno = productos.filter((p) => p.stock > 0 && !rankingIds.includes(p.id))
    return [...reales, ...relleno].slice(0, MAX_RAPIDOS)
  }, [rankingIds, productos, productosPorId])

  const hayRankingReal = rankingIds.some((id) => productosPorId.has(id))
  const sinProductos = !cargando && !errorCarga && productos.length === 0

  /* ---------- Búsqueda ---------- */

  const resultados = useMemo(() => {
    const texto = normalizar(busqueda.trim())
    if (!texto) return []
    return productos.filter((p) => normalizar(`${p.nombre} ${p.marca}`).includes(texto)).slice(0, MAX_RESULTADOS)
  }, [busqueda, productos])

  const indiceResaltado = Math.min(resaltado, Math.max(resultados.length - 1, 0))

  function cambiarBusqueda(valor) {
    setBusqueda(valor)
    setResaltado(0)
  }

  function enfocarBuscador() {
    inputRef.current?.focus()
    inputRef.current?.select()
  }

  /* ---------- Ticket ---------- */

  function agregar(id) {
    const producto = productosPorId.get(id)
    if (!producto || producto.stock === 0) return

    setTicket((t) => {
      const existe = t.find((item) => item.id === id)
      if (existe) return t.map((item) => (item.id === id ? { ...item, cantidad: item.cantidad + 1 } : item))
      return [...t, { id, cantidad: 1, precioEditado: null }]
    })
    setVentaRegistrada(null)
    setErrorVenta(null)
  }

  function agregarDesdeBusqueda(id) {
    agregar(id)
    cambiarBusqueda('')
    inputRef.current?.focus()
  }

  function cambiarCantidad(id, cantidad) {
    if (!Number.isFinite(cantidad) || cantidad < 1) return
    setTicket((t) => t.map((item) => (item.id === id ? { ...item, cantidad } : item)))
  }

  function quitar(id) {
    setTicket((t) => t.filter((item) => item.id !== id))
    if (editando?.id === id) setEditando(null)
  }

  function empezarEdicion(renglon) {
    setEditando({ id: renglon.id, valor: String(renglon.precio) })
  }

  function guardarPrecio() {
    if (!editando) return

    const valor = editando.valor.trim()
    const numero = Number(valor)

    setTicket((t) =>
      t.map((item) => {
        if (item.id !== editando.id) return item
        if (valor === '') return { ...item, precioEditado: null }
        if (numero > 0) return { ...item, precioEditado: redondear(numero) }
        return item
      })
    )
    setEditando(null)
  }

  function teclaPrecio(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      guardarPrecio()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setEditando(null)
    }
  }

  function restablecerPrecio(id) {
    setTicket((t) => t.map((item) => (item.id === id ? { ...item, precioEditado: null } : item)))
  }

  /* ---------- Cálculos ---------- */

  const renglones = ticket
    .filter((item) => productosPorId.has(item.id))
    .map((item) => {
      const producto = productosPorId.get(item.id)
      const disponible = producto.stock
      const { precio, motivo } = calcularPrecio(producto, item.cantidad, item.precioEditado)

      const faltanMayoreo =
        producto.precioMayoreo &&
        producto.minimoMayoreo &&
        motivo === 'normal' &&
        item.cantidad < producto.minimoMayoreo &&
        producto.precioMayoreo < precio
          ? producto.minimoMayoreo - item.cantidad
          : null

      return {
        ...item,
        producto,
        disponible,
        precio,
        motivo,
        subtotal: redondear(precio * item.cantidad),
        faltan: item.cantidad > disponible,
        faltanMayoreo,
      }
    })

  const conError = renglones.filter((r) => r.faltan)
  const hayErrores = conError.length > 0
  const total = redondear(renglones.filter((r) => !r.faltan).reduce((suma, r) => suma + r.subtotal, 0))
  const piezas = renglones.reduce((suma, r) => suma + r.cantidad, 0)
  const puedeConfirmar = renglones.length > 0 && !hayErrores && !guardando

  /* ---------- Confirmar y cancelar ---------- */

  async function confirmarVenta() {
    if (!puedeConfirmar) return

    setGuardando(true)
    setErrorVenta(null)

    try {
      const venta = await registrarVenta(
        renglones.map((r) => ({
          producto: r.id,
          cantidad: r.cantidad,
          precio_unitario: r.precio.toFixed(2),
          tipo_precio: r.motivo,
        }))
      )

      // El backend ya descontó el stock; aquí lo reflejamos al instante
      const vendidas = new Map(renglones.map((r) => [r.id, r.cantidad]))
      setProductos((lista) =>
        lista.map((p) => (vendidas.has(p.id) ? { ...p, stock: p.stock - vendidas.get(p.id) } : p))
      )

      setVentaRegistrada({ folio: venta.id, total: Number(venta.total) })
      setTicket([])
      setEditando(null)
      enfocarBuscador()

      cargarRanking().catch(() => {})
    } catch (e) {
      setErrorVenta(mensajeDelBackend(e) ?? mensajeDeError(e))
      // Por si el stock cambió (ej. alguien más vendió), lo traemos de nuevo
      cargarProductos().catch(() => {})
    } finally {
      setGuardando(false)
    }
  }

  function pedirCancelar() {
    if (ticket.length > 0) setDialogoCancelar(true)
  }

  function cancelarVenta() {
    setDialogoCancelar(false)
    setTicket([])
    setEditando(null)
    setErrorVenta(null)
    enfocarBuscador()
  }

  /* ---------- Atajos ---------- */

  const atajosRef = useRef({})
  atajosRef.current = { confirmarVenta, pedirCancelar, dialogoAbierto: dialogoCancelar }

  useEffect(() => {
    function alPresionar(event) {
      const a = atajosRef.current

      if (event.key === 'F2') {
        event.preventDefault()
        enfocarBuscador()
      } else if (event.key === 'F12') {
        event.preventDefault()
        a.confirmarVenta()
      } else if (event.key === 'Escape' && !a.dialogoAbierto) {
        a.pedirCancelar()
      }
    }

    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [])

  function teclaBuscador(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setResaltado((i) => Math.min(i + 1, resultados.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setResaltado((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const producto = resultados[indiceResaltado]
      if (producto) agregarDesdeBusqueda(producto.id)
    } else if (event.key === 'Escape' && busqueda) {
      event.preventDefault()
      event.stopPropagation()
      cambiarBusqueda('')
    }
  }

  return (
    <div className="rv">
      {/* ============ ATAJOS ARRIBA (STICKY) ============ */}
      <footer className="rv-atajos">
        <span className="rv-atajos__titulo">
          <span className="rv-punto" aria-hidden="true" />
          Atajos rápidos
        </span>
        <ul className="rv-atajos__lista">
          <li>
            <kbd className="rv-tecla">F2</kbd> Buscar
          </li>
          <li>
            <kbd className="rv-tecla">Enter</kbd> Agregar
          </li>
          <li>
            <kbd className="rv-tecla">F12</kbd> Confirmar
          </li>
          <li>
            <kbd className="rv-tecla">Esc</kbd> Cancelar
          </li>
        </ul>
      </footer>

      {cargando || errorCarga ? (
        /* ============ CARGANDO / ERROR ============ */
        <section className="rv-panel rv-sin-productos">
          <span className="rv-sin-productos__icono" aria-hidden="true">
            {cargando ? <Loader2 size={28} className="rv-girando" /> : <AlertCircle size={28} />}
          </span>
          <h2 className="rv-sin-productos__titulo">
            {cargando ? 'Cargando productos…' : 'No pudimos cargar tus productos'}
          </h2>
          {errorCarga && (
            <>
              <p className="rv-sin-productos__texto">{errorCarga}</p>
              <button type="button" className="rv-confirmar" onClick={cargarTodo}>
                <RotateCcw size={16} aria-hidden="true" />
                Reintentar
              </button>
            </>
          )}
        </section>
      ) : sinProductos ? (
        /* ============ SIN PRODUCTOS ============ */
        <section className="rv-panel rv-sin-productos">
          <span className="rv-sin-productos__icono" aria-hidden="true">
            <PackageOpen size={28} />
          </span>
          <h2 className="rv-sin-productos__titulo">Aún no tienes productos</h2>
          <p className="rv-sin-productos__texto">Para registrar ventas, primero agrega productos a tu catálogo.</p>
          <button type="button" className="rv-confirmar" onClick={() => navigate('/catalogo/nuevo')}>
            <Plus size={16} aria-hidden="true" />
            Nuevo producto
          </button>
        </section>
      ) : (
        <>
          {/* ============ IZQUIERDA ============ */}
          <div className="rv-izquierda">
            <section className="rv-panel">
              <div className="rv-buscador">
                <Search size={18} className="rv-buscador__icono" aria-hidden="true" />
                <input
                  ref={inputRef}
                  autoFocus
                  type="text"
                  placeholder="Busca un producto… (ej. cheto, paleta)"
                  value={busqueda}
                  onChange={(e) => cambiarBusqueda(e.target.value)}
                  onKeyDown={teclaBuscador}
                  aria-label="Buscar producto"
                />
                {busqueda && (
                  <button
                    type="button"
                    className="rv-buscador__limpiar"
                    onClick={() => {
                      cambiarBusqueda('')
                      inputRef.current?.focus()
                    }}
                    aria-label="Limpiar búsqueda"
                  >
                    <X size={16} />
                  </button>
                )}
                <button type="button" className="rv-buscador__boton" onClick={enfocarBuscador} aria-label="Buscar">
                  <Search size={19} />
                </button>
              </div>

              {busqueda.trim() && (
                <div className="rv-resultados">
                  <div className="rv-resultados__cabecera">
                    <span className="rv-resultados__titulo">
                      <span className="rv-punto" aria-hidden="true" />
                      Resultados para "{busqueda.trim()}"
                      <span className="rv-resultados__conteo">
                        ({resultados.length} {resultados.length === 1 ? 'coincidencia' : 'coincidencias'})
                      </span>
                    </span>
                    <span className="rv-pista">Usa ↑ ↓ y Enter para elegir</span>
                  </div>

                  {resultados.length === 0 ? (
                    <p className="rv-vacio-texto">No encontramos productos con ese nombre.</p>
                  ) : (
                    <ul className="rv-lista">
                      {resultados.map((p, i) => {
                        const agotado = p.stock === 0
                        const activo = i === indiceResaltado

                        return (
                          <li
                            key={p.id}
                            className={'rv-resultado' + (activo ? ' is-resaltado' : '') + (agotado ? ' is-agotado' : '')}
                            onMouseEnter={() => setResaltado(i)}
                          >
                            <span className="rv-placeholder" aria-hidden="true">
                              <Candy size={20} />
                            </span>

                            <div className="rv-resultado__info">
                              <p className="rv-resultado__nombre">
                                {p.nombre}
                                <PastillaStock producto={p} />
                              </p>
                              <p className="rv-resultado__marca">
                                {p.marca ? `${p.marca} · ${p.categoria}` : p.categoria}
                              </p>
                            </div>

                            <div className="rv-resultado__precio">
                              <strong>{moneda.format(p.precio)}</strong>
                              <span>c/{textoUnidad(p.unidad, 1)}</span>
                            </div>

                            <button
                              type="button"
                              className={'rv-agregar' + (activo && !agotado ? ' is-principal' : '')}
                              disabled={agotado}
                              onClick={() => agregarDesdeBusqueda(p.id)}
                            >
                              {activo && !agotado ? (
                                <CornerDownLeft size={14} aria-hidden="true" />
                              ) : (
                                <Plus size={14} aria-hidden="true" />
                              )}
                              Agregar
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}
            </section>

            <section className="rv-panel">
              <header className="rv-seccion__cabecera">
                <span className="rv-seccion__icono" aria-hidden="true">
                  <Zap size={16} />
                </span>
                <div>
                  <h2 className="rv-seccion__titulo">{hayRankingReal ? 'Más vendidos' : 'Acceso rápido'}</h2>
                  <p className="rv-seccion__subtitulo">
                    {hayRankingReal
                      ? 'Haz clic en cualquier producto para sumar 1 al ticket'
                      : 'Cuando tengas más ventas, aquí aparecerán tus más vendidos'}
                  </p>
                </div>
              </header>

              <div className="rv-rapidos">
                {masVendidos.map((p) => {
                  const agotado = p.stock === 0

                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="rv-rapido"
                      disabled={agotado}
                      onClick={() => agregar(p.id)}
                      title={agotado ? 'Agotado' : `Agregar ${p.nombre}`}
                    >
                      <PlusCircle size={18} className="rv-rapido__mas" aria-hidden="true" />
                      <span className="rv-placeholder" aria-hidden="true">
                        <Candy size={20} />
                      </span>
                      {p.marca && <span className="rv-chip rv-chip--marca">{p.marca}</span>}
                      <span className="rv-rapido__nombre">{p.nombre}</span>
                      <span className="rv-rapido__precio">{moneda.format(p.precio)}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>

          {/* ============ TICKET ============ */}
          <aside className="rv-panel rv-ticket" aria-label="Venta actual">
            {ventaRegistrada && (
              <div className="rv-exito" role="status">
                <CheckCircle2 size={18} aria-hidden="true" />
                <span>
                  <strong>Venta #{ventaRegistrada.folio} registrada</strong> · {moneda.format(ventaRegistrada.total)} · el
                  inventario ya se actualizó
                </span>
                <button type="button" aria-label="Cerrar aviso" onClick={() => setVentaRegistrada(null)}>
                  <X size={15} />
                </button>
              </div>
            )}

            <header className="rv-ticket__cabecera">
              <span className="rv-seccion__icono" aria-hidden="true">
                <Receipt size={16} />
              </span>
              <div className="rv-ticket__titulo-grupo">
                <h2 className="rv-ticket__titulo">Venta actual</h2>
                <span className="rv-contador">
                  {renglones.length} {renglones.length === 1 ? 'producto' : 'productos'} · {piezas}{' '}
                  {piezas === 1 ? 'pieza' : 'piezas'}
                </span>
              </div>
              <button type="button" className="rv-enlace" disabled={ticket.length === 0} onClick={pedirCancelar}>
                Limpiar
              </button>
            </header>

            {renglones.length === 0 ? (
              <div className="rv-vacio">
                <span className="rv-vacio__icono" aria-hidden="true">
                  <ShoppingCart size={22} />
                </span>
                <p className="rv-vacio__titulo">Aún no hay productos</p>
                <p className="rv-vacio__texto">Busca un producto o toca uno de acceso rápido para empezar.</p>
              </div>
            ) : (
              <ul className="rv-renglones">
                {renglones.map((r) => (
                  <li key={r.id} className={'rv-renglon' + (r.faltan ? ' is-error' : '')}>
                    <span className="rv-placeholder rv-placeholder--chico" aria-hidden="true">
                      <Candy size={16} />
                    </span>

                    <div className="rv-renglon__cuerpo">
                      <div className="rv-renglon__arriba">
                        <p className="rv-renglon__nombre">{r.producto.nombre}</p>
                        <span className="rv-renglon__subtotal">
                          {r.faltan ? <span className="rv-espera">En espera</span> : moneda.format(r.subtotal)}
                        </span>
                      </div>

                      <div className="rv-renglon__fila">
                        <div className="rv-renglon__precio">
                          {editando?.id === r.id ? (
                            <div className="rv-editar-precio">
                              <span>$</span>
                              <input
                                autoFocus
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={editando.valor}
                                onChange={(e) => setEditando({ ...editando, valor: e.target.value })}
                                onKeyDown={teclaPrecio}
                                onBlur={guardarPrecio}
                                aria-label={`Precio de ${r.producto.nombre}`}
                              />
                            </div>
                          ) : (
                            <>
                              {r.motivo !== 'normal' && <s className="rv-tachado">{moneda.format(r.producto.precio)}</s>}
                              <span className="rv-unitario">
                                {moneda.format(r.precio)} c/{textoUnidad(r.producto.unidad, 1)}
                              </span>

                              {r.motivo === 'mayoreo' && <span className="rv-chip rv-chip--verde">Mayoreo</span>}
                              {r.motivo === 'editado' && <span className="rv-chip rv-chip--gris">Precio editado</span>}

                              <button
                                type="button"
                                className="rv-icono"
                                onClick={() => empezarEdicion(r)}
                                aria-label={`Editar precio de ${r.producto.nombre}`}
                                title="Editar precio"
                              >
                                <Pencil size={13} />
                              </button>

                              {r.motivo === 'editado' && (
                                <button type="button" className="rv-enlace" onClick={() => restablecerPrecio(r.id)}>
                                  <RotateCcw size={12} aria-hidden="true" />
                                  Restablecer
                                </button>
                              )}
                            </>
                          )}
                        </div>

                        <div className="rv-renglon__acciones">
                          {r.faltan && r.disponible > 0 && (
                            <button
                              type="button"
                              className="rv-boton-chico"
                              onClick={() => cambiarCantidad(r.id, r.disponible)}
                            >
                              Ajustar a {r.disponible}
                            </button>
                          )}

                          <div className="rv-cantidad">
                            <button
                              type="button"
                              onClick={() => cambiarCantidad(r.id, r.cantidad - 1)}
                              disabled={r.cantidad <= 1}
                              aria-label="Quitar una"
                            >
                              <Minus size={14} />
                            </button>
                            <input
                              type="number"
                              min="1"
                              inputMode="numeric"
                              value={r.cantidad}
                              onChange={(e) => cambiarCantidad(r.id, parseInt(e.target.value, 10))}
                              aria-label={`Cantidad de ${r.producto.nombre}`}
                            />
                            <button type="button" onClick={() => cambiarCantidad(r.id, r.cantidad + 1)} aria-label="Agregar una">
                              <Plus size={14} />
                            </button>
                          </div>

                          <button
                            type="button"
                            className="rv-icono rv-icono--borrar"
                            onClick={() => quitar(r.id)}
                            aria-label={`Quitar ${r.producto.nombre} del ticket`}
                            title="Quitar del ticket"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {r.faltan && (
                        <p className="rv-renglon__error">
                          <AlertTriangle size={13} aria-hidden="true" />
                          {r.disponible === 0
                            ? 'Ya no quedan en inventario'
                            : `Solo quedan ${r.disponible} ${textoUnidad(r.producto.unidad, r.disponible)} en inventario`}
                        </p>
                      )}

                      {!r.faltan && r.faltanMayoreo !== null && (
                        <p className="rv-renglon__sugerencia">
                          Lleva {r.faltanMayoreo} más y paga {moneda.format(r.producto.precioMayoreo)} c/u
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="rv-cierre">
              {hayErrores && (
                <div className="rv-resumen__fila">
                  <span>Subtotal de productos válidos</span>
                  <span>{moneda.format(total)}</span>
                </div>
              )}

              <div className="rv-cierre__fila">
                <div className="rv-resumen__total">
                  <span>Total de la venta</span>
                  <strong>{moneda.format(total)}</strong>
                </div>

                <div className="rv-cierre__botones">
                  <button
                    type="button"
                    className="rv-cancelar"
                    disabled={ticket.length === 0 || guardando}
                    onClick={pedirCancelar}
                  >
                    <X size={15} aria-hidden="true" />
                    Cancelar
                  </button>
                  <button type="button" className="rv-confirmar" disabled={!puedeConfirmar} onClick={confirmarVenta}>
                    {guardando ? (
                      <Loader2 size={16} className="rv-girando" aria-hidden="true" />
                    ) : hayErrores ? (
                      <Lock size={16} aria-hidden="true" />
                    ) : (
                      <Check size={16} aria-hidden="true" />
                    )}
                    {guardando ? 'Registrando…' : 'Confirmar'}
                  </button>
                </div>
              </div>

              {hayErrores && (
                <div className="rv-aviso-error" role="alert">
                  <Lock size={15} aria-hidden="true" />
                  <span>
                    <strong>Venta pausada:</strong>{' '}
                    {conError.length === 1
                      ? `corrige la cantidad de ${conError[0].producto.nombre} para poder confirmar`
                      : `corrige ${conError.length} productos para poder confirmar`}
                  </span>
                </div>
              )}

              {errorVenta && (
                <div className="rv-aviso-error" role="alert">
                  <AlertCircle size={15} aria-hidden="true" />
                  <span>
                    <strong>No se registró:</strong> {errorVenta}
                  </span>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      <ConfirmDialog
        open={dialogoCancelar}
        title="¿Cancelar la venta?"
        message="Se quitarán todos los productos del ticket. El inventario no cambia."
        confirmText="Sí, cancelar venta"
        cancelText="Seguir vendiendo"
        tone="danger"
        onConfirm={cancelarVenta}
        onCancel={() => setDialogoCancelar(false)}
      />
    </div>
  )
}