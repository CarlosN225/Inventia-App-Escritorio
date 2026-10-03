import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Search,
  X,
  Plus,
  Minus,
  Trash2,
  Truck,
  Package,
  CalendarDays,
  FileText,
  Store,
  Check,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Candy,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Lightbulb,
  ClipboardList,
  ClipboardCheck,
  PlusCircle,
  Lock,
} from 'lucide-react'

import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { PRODUCTOS, DETALLES, PROVEEDORES_FRECUENTES } from '../data/productos'
import '../styles/registrar-venta.css'
import '../styles/registrar-compra.css'

// TODO: traer de la Configuración del negocio
const CONFIG = { maneja_caducidad: true }

const MAX_RESULTADOS = 6

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const fechaLarga = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
const fechaCorta = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

function normalizar(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function redondear(n) {
  return Math.round(n * 100) / 100
}

function aFecha(iso) {
  return new Date(`${iso}T00:00:00`)
}

function hoyISO() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

function diasHasta(iso) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return Math.round((aFecha(iso) - hoy) / 86400000)
}

function plural(palabra, cantidad) {
  return cantidad === 1 ? palabra : `${palabra}s`
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function PastillaHay({ disponible, minimo }) {
  if (disponible === 0) return <span className="rv-stock rv-stock--agotado">Agotado</span>
  if (disponible < minimo) return <span className="rv-stock rv-stock--bajo">Hay {disponible} · Stock bajo</span>
  return <span className="rv-stock rv-stock--ok">Hay {disponible} pzas</span>
}

export default function RegistrarCompra() {
  const inputRef = useRef(null)

  const [proveedor, setProveedor] = useState('')
  const [fecha, setFecha] = useState(hoyISO)
  const [nota, setNota] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [resaltado, setResaltado] = useState(0)
  const [compra, setCompra] = useState([]) // [{ id, modo, cantidad, costo, caducidad }]
  const [stock, setStock] = useState(() => Object.fromEntries(PRODUCTOS.map((p) => [p.id, p.stock])))
  const [costos, setCostos] = useState(() => Object.fromEntries(PRODUCTOS.map((p) => [p.id, p.costo])))
  const [intento, setIntento] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [compraRegistrada, setCompraRegistrada] = useState(null)
  const [folio, setFolio] = useState(88) // TODO: lo da el backend
  const [dialogoCancelar, setDialogoCancelar] = useState(false)

  const productosPorId = useMemo(() => Object.fromEntries(PRODUCTOS.map((p) => [p.id, p])), [])

  /* ---------- Búsqueda ---------- */

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

  function enfocarBuscador() {
    inputRef.current?.focus()
    inputRef.current?.select()
  }

  /* ---------- Por surtir ---------- */

  const porSurtir = useMemo(
    () =>
      PRODUCTOS.map((p) => ({ ...p, disponible: stock[p.id] ?? 0 }))
        .filter((p) => p.disponible < p.minimo)
        .map((p) => {
          const objetivo = DETALLES[p.id]?.maximo ?? p.minimo * 2
          return { ...p, sugerido: Math.max(objetivo - p.disponible, 1) }
        })
        .sort((a, b) => a.disponible / a.minimo - b.disponible / b.minimo),
    [stock]
  )

  /* ---------- Compra ---------- */

  function nuevoRenglon(id, cantidadPiezas = null) {
    const detalles = DETALLES[id]
    const porEmpaque = detalles?.piezasEmpaque ?? null
    const modo = porEmpaque ? 'empaque' : 'pieza'

    // Si viene de "Por surtir", convierte las piezas sugeridas a empaques completos
    const cantidad =
      cantidadPiezas === null ? 1 : porEmpaque ? Math.max(1, Math.ceil(cantidadPiezas / porEmpaque)) : cantidadPiezas

    return { id, modo, cantidad, costo: String(costos[id] ?? ''), caducidad: '' }
  }

  function agregar(id, cantidadPiezas = null) {
    setCompra((c) => {
      const existe = c.find((item) => item.id === id)

      if (existe) {
        if (cantidadPiezas !== null) return c
        return c.map((item) => (item.id === id ? { ...item, cantidad: item.cantidad + 1 } : item))
      }

      return [...c, nuevoRenglon(id, cantidadPiezas)]
    })
    setCompraRegistrada(null)
  }

  function agregarDesdeBusqueda(id) {
    agregar(id)
    cambiarBusqueda('')
    inputRef.current?.focus()
  }

  function actualizar(id, cambios) {
    setCompra((c) => c.map((item) => (item.id === id ? { ...item, ...cambios } : item)))
  }

  function cambiarCantidad(id, cantidad) {
    if (!Number.isFinite(cantidad) || cantidad < 1) return
    actualizar(id, { cantidad })
  }

  function quitar(id) {
    setCompra((c) => c.filter((item) => item.id !== id))
  }

  /* ---------- Cálculos ---------- */

  const renglones = compra.map((item) => {
    const producto = productosPorId[item.id]
    const detalles = DETALLES[item.id]
    const porEmpaque = detalles?.piezasEmpaque ?? null
    const empaque = detalles?.empaque ?? 'empaque'
    const piezas = item.modo === 'empaque' && porEmpaque ? item.cantidad * porEmpaque : item.cantidad

    const costo = Number(item.costo)
    const costoValido = item.costo !== '' && costo > 0
    const costoAnterior = costos[item.id] ?? null
    const cambioCosto =
      costoValido && costoAnterior !== null && costo !== costoAnterior ? (costo > costoAnterior ? 'sube' : 'baja') : null

    const stockActual = stock[item.id] ?? 0
    const caducidadVencida = item.caducidad !== '' && diasHasta(item.caducidad) < 0

    const conversion =
      item.modo === 'empaque' && porEmpaque
        ? `${item.cantidad} ${plural(empaque, item.cantidad)} × ${porEmpaque} = ${piezas} pzas`
        : `${piezas} ${piezas === 1 ? 'pieza' : 'pzas'}`

    return {
      ...item,
      producto,
      porEmpaque,
      empaque,
      piezas,
      conversion,
      costoNum: costo,
      costoValido,
      costoAnterior,
      cambioCosto,
      subtotal: costoValido ? redondear(piezas * costo) : 0,
      stockActual,
      nuevoStock: stockActual + piezas,
      caducidadVencida,
      conError: !costoValido || caducidadVencida,
    }
  })

  const totalPiezas = renglones.reduce((suma, r) => suma + r.piezas, 0)
  const total = redondear(renglones.reduce((suma, r) => suma + r.subtotal, 0))
  const faltaProveedor = !proveedor.trim()
  const renglonesConError = renglones.filter((r) => r.conError)
  const puedeRegistrar = renglones.length > 0 && !faltaProveedor && !!fecha && renglonesConError.length === 0
  const subieronDeCosto = renglones.filter((r) => r.cambioCosto === 'sube')

  // Qué falta para poder registrar (solo se muestra después del primer intento)
  let motivoBloqueo = ''
  if (faltaProveedor) {
    motivoBloqueo = 'escribe o elige el proveedor'
  } else if (renglonesConError.length > 0) {
    const r = renglonesConError[0]
    motivoBloqueo = !r.costoValido
      ? `falta el costo de ${r.producto.nombre}`
      : `la caducidad de ${r.producto.nombre} ya pasó`
  }

  /* ---------- Registrar (con modal) y cancelar ---------- */

  // Paso 1: valida y abre el modal de confirmación
  function pedirRegistro() {
    setIntento(true)
    if (!puedeRegistrar) return
    setModalAbierto(true)
  }

  // Paso 2: ya revisado en el modal, se registra de verdad
  function confirmarRegistro() {
    if (!puedeRegistrar) return

    // TODO: mandar la compra al backend (él genera las entradas de inventario)
    setStock((s) => {
      const copia = { ...s }
      renglones.forEach((r) => {
        copia[r.id] += r.piezas
      })
      return copia
    })

    setCostos((c) => {
      const copia = { ...c }
      renglones.forEach((r) => {
        copia[r.id] = r.costoNum
      })
      return copia
    })

    setCompraRegistrada({ folio, proveedor: proveedor.trim(), piezas: totalPiezas, total })
    setFolio((f) => f + 1)
    setCompra([])
    setProveedor('')
    setNota('')
    setFecha(hoyISO())
    setIntento(false)
    setModalAbierto(false)
    enfocarBuscador()
  }

  function pedirCancelar() {
    if (compra.length > 0) setDialogoCancelar(true)
  }

  function cancelarCompra() {
    setDialogoCancelar(false)
    setCompra([])
    setIntento(false)
    enfocarBuscador()
  }

  /* ---------- Atajos ---------- */

  const atajosRef = useRef({})
  atajosRef.current = {
    pedirRegistro,
    confirmarRegistro,
    pedirCancelar,
    modalAbierto,
    dialogoAbierto: dialogoCancelar,
  }

  useEffect(() => {
    function alPresionar(event) {
      const a = atajosRef.current

      if (event.key === 'F2' && !a.modalAbierto) {
        event.preventDefault()
        enfocarBuscador()
      } else if (event.key === 'F12') {
        event.preventDefault()
        if (a.modalAbierto) a.confirmarRegistro()
        else a.pedirRegistro()
      } else if (event.key === 'Escape') {
        // Con el modal abierto, Esc solo lo cierra (no cancela la compra)
        if (a.modalAbierto) setModalAbierto(false)
        else if (!a.dialogoAbierto) a.pedirCancelar()
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

  const errorProveedor = intento && faltaProveedor

  return (
    <div className="rv rv--compra">
      {/* ============ ATAJOS ============ */}
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
            <kbd className="rv-tecla">F12</kbd> Registrar
          </li>
          <li>
            <kbd className="rv-tecla">Esc</kbd> Cancelar
          </li>
        </ul>
      </footer>

      {/* ============ IZQUIERDA ============ */}
      <div className="rv-izquierda">
        {/* Datos de la compra */}
        <section className="rv-panel">
          <header className="rv-seccion__cabecera">
            <span className="rv-seccion__icono" aria-hidden="true">
              <Truck size={16} />
            </span>
            <div>
              <h2 className="rv-seccion__titulo">Datos de la compra</h2>
              <p className="rv-seccion__subtitulo">Quién te surtió y el ticket o nota que te dieron</p>
            </div>
          </header>

          <div className="rc-datos">
            <div className="rc-campo">
              <label className="rc-etiqueta" htmlFor="rc-proveedor">
                Proveedor <span className="rc-requerido">*</span>
              </label>
              <div className={'rc-input-grupo' + (errorProveedor ? ' is-error' : '')}>
                <Store size={16} aria-hidden="true" />
                <input
                  id="rc-proveedor"
                  placeholder="Ej. De la Rosa"
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                />
                {proveedor && (
                  <button type="button" className="rc-limpiar" onClick={() => setProveedor('')} aria-label="Borrar proveedor">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="rc-campo">
              <label className="rc-etiqueta" htmlFor="rc-fecha">
                Fecha de compra <span className="rc-requerido">*</span>
              </label>
              <div className="rc-input-grupo">
                <CalendarDays size={16} aria-hidden="true" />
                <input id="rc-fecha" type="date" max={hoyISO()} value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
            </div>

            <div className="rc-campo">
              <label className="rc-etiqueta" htmlFor="rc-nota">
                Folio o nota (opcional)
              </label>
              <div className="rc-input-grupo">
                <FileText size={16} aria-hidden="true" />
                <input id="rc-nota" placeholder="Ej. Nota 4521" value={nota} onChange={(e) => setNota(e.target.value)} />
              </div>
            </div>

            <div className="rc-frecuentes rc-frecuentes--fila">
              <span className="rc-frecuentes__titulo">Frecuentes:</span>
              {PROVEEDORES_FRECUENTES.map((p) => {
                const activo = proveedor.trim() === p

                return (
                  <button
                    key={p}
                    type="button"
                    className={'rc-frecuente' + (activo ? ' is-activo' : '')}
                    onClick={() => setProveedor(p)}
                    aria-pressed={activo}
                  >
                    {activo && <Check size={12} aria-hidden="true" />}
                    {p}
                  </button>
                )
              })}

              {errorProveedor && (
                <span className="rc-error">
                  <AlertCircle size={13} aria-hidden="true" />
                  Escribe o elige el proveedor
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Buscador */}
        <section className="rv-panel">
          <div className="rv-buscador">
            <Search size={18} className="rv-buscador__icono" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Busca el producto que te llegó… (ej. mazapán)"
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

          {busqueda.trim() ? (
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
                <p className="rv-vacio-texto">
                  No encontramos ese producto. Si es nuevo, primero dalo de alta en el Catálogo.
                </p>
              ) : (
                <ul className="rv-lista">
                  {resultados.map((p, i) => {
                    const activo = i === indiceResaltado

                    return (
                      <li
                        key={p.id}
                        className={'rv-resultado' + (activo ? ' is-resaltado' : '')}
                        onMouseEnter={() => setResaltado(i)}
                      >
                        <span className="rv-placeholder" aria-hidden="true">
                          <Candy size={20} />
                        </span>

                        <div className="rv-resultado__info">
                          <p className="rv-resultado__nombre">
                            {p.nombre}
                            <PastillaHay disponible={stock[p.id] ?? 0} minimo={p.minimo} />
                          </p>
                          <p className="rv-resultado__marca">
                            {p.marca} · {p.categoria}
                          </p>
                        </div>

                        <div className="rv-resultado__precio">
                          <span>Último costo</span>
                          <strong>{moneda.format(costos[p.id])}</strong>
                        </div>

                        <button
                          type="button"
                          className={'rv-agregar' + (activo ? ' is-principal' : '')}
                          onClick={() => agregarDesdeBusqueda(p.id)}
                        >
                          {activo ? <CornerDownLeft size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                          Agregar
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : (
            compra.length === 0 && (
              <p className="rc-tip">
                <Lightbulb size={15} aria-hidden="true" />
                <span>
                  ¿Compraste por caja o bolsa? En la lista de la derecha elige <strong>Caja</strong> o{' '}
                  <strong>Bolsa</strong> y el sistema calcula las piezas solito.
                </span>
              </p>
            )
          )}
        </section>

        {/* Por surtir */}
        <section className="rv-panel">
          <header className="rv-seccion__cabecera">
            <span className="rv-seccion__icono" aria-hidden="true">
              <ClipboardList size={16} />
            </span>
            <div>
              <h2 className="rv-seccion__titulo">Por surtir</h2>
              <p className="rv-seccion__subtitulo">Se te están acabando. Clic para agregarlos con la cantidad sugerida</p>
            </div>
          </header>

          {porSurtir.length === 0 ? (
            <div className="rc-todo-surtido">
              <CheckCircle2 size={24} aria-hidden="true" />
              Todo tu inventario está surtido.
            </div>
          ) : (
            <ul className="rc-surtir">
              {porSurtir.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="rc-surtir__item"
                    onClick={() => agregar(p.id, p.sugerido)}
                    title={`Agregar ${p.nombre} con la cantidad sugerida`}
                  >
                    <span className="rv-placeholder rc-placeholder-mini" aria-hidden="true">
                      <Candy size={15} />
                    </span>

                    <span className="rc-surtir__info">
                      <span className="rc-surtir__nombre">{p.nombre}</span>
                      <span className="rc-surtir__detalle">
                        <span
                          className={
                            'rc-sugerido__estado rc-sugerido__estado--' + (p.disponible === 0 ? 'agotado' : 'bajo')
                          }
                        >
                          {p.disponible === 0 ? 'Agotado' : 'Stock bajo'}
                        </span>
                        {' · '}Quedan {p.disponible} · mín. {p.minimo}
                      </span>
                    </span>

                    <span className="rc-surtir__sugerido">+{p.sugerido} pzas</span>
                    <PlusCircle size={18} className="rc-surtir__mas" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ============ COMPRA ACTUAL ============ */}
      <aside className="rv-panel rv-ticket" aria-label="Compra actual">
        {compraRegistrada && (
          <div className="rv-exito" role="status">
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>
              <strong>Compra #{compraRegistrada.folio} registrada</strong> · {compraRegistrada.proveedor} · se sumaron{' '}
              {compraRegistrada.piezas} piezas al inventario
            </span>
            <button type="button" aria-label="Cerrar aviso" onClick={() => setCompraRegistrada(null)}>
              <X size={15} />
            </button>
          </div>
        )}

        <header className="rv-ticket__cabecera">
          <span className="rv-seccion__icono" aria-hidden="true">
            <Package size={16} />
          </span>
          <div className="rv-ticket__titulo-grupo">
            <h2 className="rv-ticket__titulo">Compra actual</h2>
            <span className="rv-contador">
              {renglones.length} {renglones.length === 1 ? 'producto' : 'productos'} · {totalPiezas}{' '}
              {totalPiezas === 1 ? 'pieza' : 'piezas'}
            </span>
          </div>
          <button type="button" className="rv-enlace" disabled={compra.length === 0} onClick={pedirCancelar}>
            Limpiar
          </button>
        </header>

        {renglones.length === 0 ? (
          <div className="rv-vacio">
            <span className="rv-vacio__icono" aria-hidden="true">
              <Truck size={22} />
            </span>
            <p className="rv-vacio__titulo">Aún no hay productos</p>
            <p className="rv-vacio__texto">Busca lo que te llegó o agrega algo de "Por surtir".</p>
          </div>
        ) : (
          <ul className="rv-renglones">
            {renglones.map((r) => (
              <li key={r.id} className={'rv-renglon rc-renglon' + (r.conError ? ' is-error' : '')}>
                <div className="rv-renglon__cuerpo">
                  {/* Línea 1: nombre + subtotal */}
                  <div className="rv-renglon__arriba">
                    <p className="rv-renglon__nombre">{r.producto.nombre}</p>
                    <span className="rv-renglon__subtotal">{r.costoValido ? moneda.format(r.subtotal) : '—'}</span>
                  </div>

                  {/* Línea 2: pieza/caja + cantidad + borrar */}
                  <div className="rc-linea">
                    {r.porEmpaque ? (
                      <div className="rc-modo" role="group" aria-label="Comprar por">
                        <button
                          type="button"
                          aria-pressed={r.modo === 'pieza'}
                          className={r.modo === 'pieza' ? 'is-activo' : ''}
                          onClick={() => actualizar(r.id, { modo: 'pieza' })}
                        >
                          Pieza
                        </button>
                        <button
                          type="button"
                          aria-pressed={r.modo === 'empaque'}
                          className={r.modo === 'empaque' ? 'is-activo' : ''}
                          onClick={() => actualizar(r.id, { modo: 'empaque' })}
                        >
                          {capitalizar(r.empaque)}
                        </button>
                      </div>
                    ) : (
                      <span className="rc-solo-pieza">Por pieza</span>
                    )}

                    <div className="rv-cantidad">
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(r.id, r.cantidad - 1)}
                        disabled={r.cantidad <= 1}
                        aria-label="Quitar uno"
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={r.cantidad}
                        onChange={(e) => cambiarCantidad(r.id, parseInt(e.target.value, 10))}
                        aria-label={`Cantidad de ${r.producto.nombre}`}
                      />
                      <button type="button" onClick={() => cambiarCantidad(r.id, r.cantidad + 1)} aria-label="Agregar uno">
                        <Plus size={13} />
                      </button>
                    </div>

                    <button
                      type="button"
                      className="rv-icono rv-icono--borrar rc-borrar"
                      onClick={() => quitar(r.id)}
                      aria-label={`Quitar ${r.producto.nombre} de la compra`}
                      title="Quitar de la compra"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Línea 3: costo + cambio de costo + caducidad */}
                  <div className="rc-linea rc-linea--envuelve">
                    <span className={'rc-costo__grupo' + (!r.costoValido ? ' is-error' : '')}>
                      <span>$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={r.costo}
                        onChange={(e) => actualizar(r.id, { costo: e.target.value })}
                        aria-label={`Costo por pieza de ${r.producto.nombre}`}
                      />
                      <span className="rc-sufijo">/pza</span>
                    </span>

                    {r.cambioCosto && (
                      <span className={`rc-cambio rc-cambio--${r.cambioCosto}`}>
                        {r.cambioCosto === 'sube' ? (
                          <ArrowUp size={11} aria-hidden="true" />
                        ) : (
                          <ArrowDown size={11} aria-hidden="true" />
                        )}
                        antes {moneda.format(r.costoAnterior)}
                      </span>
                    )}

                    {CONFIG.maneja_caducidad && (
                      <label className={'rc-fecha' + (r.caducidadVencida ? ' is-error' : '')} title="Caducidad (opcional)">
                        <CalendarDays size={13} aria-hidden="true" />
                        <input
                          type="date"
                          value={r.caducidad}
                          onChange={(e) => actualizar(r.id, { caducidad: e.target.value })}
                          aria-label={`Caducidad de ${r.producto.nombre} (opcional)`}
                        />
                      </label>
                    )}
                  </div>

                  {/* Línea 4: conversión + stock en una sola línea */}
                  <p className="rc-resumen-linea">
                    {r.conversion}
                    {' · '}Stock {r.stockActual} → <strong>{r.nuevoStock}</strong>
                  </p>

                  {r.conError && (
                    <p className="rv-renglon__error">
                      <AlertTriangle size={12} aria-hidden="true" />
                      {!r.costoValido ? 'Escribe el costo por pieza' : 'Esa fecha de caducidad ya pasó'}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* ============ CIERRE ============ */}
        <div className="rv-cierre">
          <div className="rc-piezas">
            <span>Piezas que entran al inventario</span>
            <strong>{totalPiezas}</strong>
          </div>

          <div className="rv-cierre__fila">
            <div className="rv-resumen__total">
              <span>Total de la compra</span>
              <strong>{moneda.format(total)}</strong>
            </div>

            <div className="rv-cierre__botones">
              <button type="button" className="rv-cancelar" disabled={compra.length === 0} onClick={pedirCancelar}>
                <X size={15} aria-hidden="true" />
                Cancelar
              </button>
              <button type="button" className="rv-confirmar" disabled={compra.length === 0} onClick={pedirRegistro}>
                {intento && !puedeRegistrar ? <Lock size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                Registrar
              </button>
            </div>
          </div>

          {intento && motivoBloqueo && (
            <div className="rv-aviso-error" role="alert">
              <Lock size={15} aria-hidden="true" />
              <span>
                <strong>Falta un dato:</strong> {motivoBloqueo}
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* ============ MODAL DE CONFIRMACIÓN ============ */}
      {modalAbierto &&
        createPortal(
          <div
            className="rc-modal"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setModalAbierto(false)
            }}
          >
            <div className="rc-modal__caja" role="dialog" aria-modal="true" aria-labelledby="rc-modal-titulo">
              <header className="rc-modal__cabecera">
                <span className="rc-modal__icono" aria-hidden="true">
                  <ClipboardCheck size={18} />
                </span>
                <div className="rc-modal__encabezado">
                  <h2 id="rc-modal-titulo" className="rc-modal__titulo">
                    Confirma la compra
                  </h2>
                  <p className="rc-modal__subtitulo">Revisa que todo coincida con tu nota antes de registrar</p>
                </div>
                <button
                  type="button"
                  className="rc-limpiar"
                  onClick={() => setModalAbierto(false)}
                  aria-label="Cerrar"
                >
                  <X size={18} />
                </button>
              </header>

              <dl className="rc-modal__datos">
                <div>
                  <dt>Proveedor</dt>
                  <dd>{proveedor.trim()}</dd>
                </div>
                <div>
                  <dt>Fecha</dt>
                  <dd>{fecha ? fechaLarga.format(aFecha(fecha)) : '—'}</dd>
                </div>
                <div>
                  <dt>Folio o nota</dt>
                  <dd>{nota.trim() || 'Sin folio'}</dd>
                </div>
              </dl>

              <div className="rc-modal__tabla-contenedor">
                <table className="rc-modal__tabla">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th className="is-der">Costo</th>
                      <th className="is-der">Subtotal</th>
                      <th className="is-der">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renglones.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <span className="rc-modal__producto">{r.producto.nombre}</span>
                          {r.caducidad && (
                            <span className="rc-modal__cad">Cad. {fechaCorta.format(aFecha(r.caducidad))}</span>
                          )}
                        </td>
                        <td>{r.conversion}</td>
                        <td className="is-der">
                          {moneda.format(r.costoNum)}
                          {r.cambioCosto === 'sube' && (
                            <span className="rc-cambio rc-cambio--sube rc-modal__cambio">
                              <ArrowUp size={10} aria-hidden="true" />
                            </span>
                          )}
                        </td>
                        <td className="is-der rc-modal__subtotal">{moneda.format(r.subtotal)}</td>
                        <td className="is-der rc-modal__stock">
                          {r.stockActual} → <strong>{r.nuevoStock}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {subieronDeCosto.length > 0 && (
                <p className="rc-modal__aviso">
                  <AlertTriangle size={15} aria-hidden="true" />
                  {subieronDeCosto.length === 1
                    ? `${subieronDeCosto[0].producto.nombre} subió de costo respecto a tu última compra.`
                    : `${subieronDeCosto.length} productos subieron de costo respecto a tu última compra.`}
                </p>
              )}

              <footer className="rc-modal__pie">
                <div className="rc-modal__totales">
                  <span>
                    {renglones.length} {renglones.length === 1 ? 'producto' : 'productos'} · {totalPiezas} piezas entran al
                    inventario
                  </span>
                  <strong>{moneda.format(total)}</strong>
                </div>

                <div className="rc-modal__botones">
                  <button type="button" className="rv-cancelar" onClick={() => setModalAbierto(false)}>
                    Volver a editar
                  </button>
                  <button type="button" className="rv-confirmar" onClick={confirmarRegistro} autoFocus>
                    <Check size={16} aria-hidden="true" />
                    Confirmar compra
                  </button>
                </div>
              </footer>
            </div>
          </div>,
          document.body
        )}

      <ConfirmDialog
        open={dialogoCancelar}
        title="¿Cancelar la compra?"
        message="Se quitarán todos los productos de la lista. El inventario no cambia."
        confirmText="Sí, cancelar compra"
        cancelText="Seguir capturando"
        tone="danger"
        onConfirm={cancelarCompra}
        onCancel={() => setDialogoCancelar(false)}
      />
    </div>
  )
}