import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Search,
  Plus,
  Package,
  AlertTriangle,
  XCircle,
  CalendarClock,
  List,
  LayoutGrid,
  Pencil,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Candy,
  X,
  History,
  EyeOff,
  Eye,
  SearchX,
  PackageOpen,
  Loader2,
  WifiOff,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { getUsuarioActual } from '../services/auth'
import { listarProductos, cambiarActivoProducto, mensajeDeError } from '../services/productos'
import { textoUnidad } from '../utils/unidades'
import '../styles/catalogo.css'
import { notificar } from '../services/notificar.js'

const POR_PAGINA = 15
const DIAS_AVISO_CADUCIDAD = 30
const MARGEN_BAJO = 25

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

/* ============ Utilidades ============ */

// Quita acentos y pasa a minúsculas para que "mazapan" encuentre "Mazapán"
function normalizar(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function estadoStock(p) {
  if (p.stock === 0) return 'agotado'
  if (p.stock < p.minimo) return 'bajo'
  return 'ok'
}

function porCaducar(p) {
  return p.diasCaducar !== null && p.diasCaducar <= DIAS_AVISO_CADUCIDAD
}

// null si no se puede calcular (por ejemplo, el encargado no recibe el costo)
function margen(p) {
  if (p.costo === null || !p.precio) return null
  return Math.round(((p.precio - p.costo) / p.precio) * 100)
}

// Números de página con puntos suspensivos: 1 … 4 5 6 … 20
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

/* ============ Componentes auxiliares ============ */

function PastillaStock({ producto }) {
  const estado = estadoStock(producto)
  const unidad = textoUnidad(producto.unidad, producto.stock)
  const texto =
    estado === 'agotado' ? '0 · Agotado' : `${producto.stock} ${unidad}${estado === 'bajo' ? ' · Bajo' : ''}`

  return (
    <span className={`cat-stock cat-stock--${estado}`}>
      <span className="cat-stock__punto" aria-hidden="true" />
      {texto}
    </span>
  )
}

function Caducidad({ producto }) {
  if (!producto.caducidad) {
    return <span className="cat-sin-fecha">Sin fecha de caducidad registrada</span>
  }

  const dias = producto.diasCaducar

  if (dias < 0) {
    const pasaron = Math.abs(dias)
    return (
      <span className="cat-caduca is-urgente">
        <CalendarClock size={13} aria-hidden="true" />
        Caducó hace {pasaron} {pasaron === 1 ? 'día' : 'días'}
      </span>
    )
  }

  if (dias <= DIAS_AVISO_CADUCIDAD) {
    return (
      <span className={'cat-caduca' + (dias <= 7 ? ' is-urgente' : '')}>
        <CalendarClock size={13} aria-hidden="true" />
        {dias === 0 ? 'Caduca hoy' : `Caduca en ${dias} ${dias === 1 ? 'día' : 'días'}`}
      </span>
    )
  }

  return <span>{producto.caducidad}</span>
}

function FotoProducto({ producto, grande = false }) {
  return (
    <span className={'cat-placeholder' + (grande ? ' cat-placeholder--grande' : '')} aria-hidden="true">
      {producto.imagen ? (
        <img src={producto.imagen} alt="" className="cat-foto" />
      ) : (
        <Candy size={grande ? 22 : 16} />
      )}
    </span>
  )
}

/* ============ Componente principal ============ */

export default function Catalogo() {
  const navigate = useNavigate()
  const location = useLocation()

  const [usuarioActual, setUsuarioActual] = useState(null)
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aCambiar, setACambiar] = useState(null) // producto que se va a desactivar o reactivar
  const [resaltado, setResaltado] = useState(null) // id del producto recién guardado

  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('Todas')
  const [estado, setEstado] = useState('todos')
  const [vista, setVista] = useState('tabla')
  const [pagina, setPagina] = useState(1)
  const [menuAbierto, setMenuAbierto] = useState(null)

  const menuRef = useRef(null)

  const esPropietario = usuarioActual?.rol === 'propietario'

  /* ============ Cargar del backend ============ */

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
  // Aviso que manda el formulario al guardar (ej. "Chocolate Carlos V se actualizó.")
  useEffect(() => {
    const { resaltar } = location.state ?? {}
    if (!resaltar) return

    setResaltado(resaltar)

    // Lo borra para que no vuelva a salir si recargas la página
    navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
 


  useEffect(() => {
    getUsuarioActual()
      .then(setUsuarioActual)
      .catch(() => setUsuarioActual(null))

    cargarProductos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (menuAbierto === null) return

    function alClicFuera(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuAbierto(null)
      }
    }

    function alPresionarEsc(event) {
      if (event.key === 'Escape') setMenuAbierto(null)
    }

    document.addEventListener('mousedown', alClicFuera)
    document.addEventListener('keydown', alPresionarEsc)

    return () => {
      document.removeEventListener('mousedown', alClicFuera)
      document.removeEventListener('keydown', alPresionarEsc)
    }
  }, [menuAbierto])

  /* ============ Cómputos ============ */

  const activos = useMemo(() => productos.filter((p) => p.activo), [productos])
  const desactivados = useMemo(() => productos.filter((p) => !p.activo), [productos])
  // Lleva a la página del producto recién guardado y le quita el resaltado a los 3 segundos
  useEffect(() => {
    if (resaltado === null || cargando) return

    const indice = activos.findIndex((p) => p.id === resaltado)
    if (indice >= 0) setPagina(Math.floor(indice / POR_PAGINA) + 1)

    const temporizador = setTimeout(() => setResaltado(null), 3000)
    return () => clearTimeout(temporizador)
  }, [resaltado, cargando, activos])


  const resumen = useMemo(
    () => ({
      total: activos.length,
      bajo: activos.filter((p) => estadoStock(p) === 'bajo').length,
      agotado: activos.filter((p) => estadoStock(p) === 'agotado').length,
      caducar: activos.filter(porCaducar).length,
    }),
    [activos]
  )

  // Categorías que tienen productos, en el orden fijo de la lista de 16
  const categorias = useMemo(() => {
    const porNombre = new Map()
    activos.forEach((p) => porNombre.set(p.categoria, p.categoriaId))
    return [...porNombre.entries()].sort((a, b) => a[1] - b[1]).map(([nombre]) => nombre)
  }, [activos])

  const conteoCategorias = useMemo(() => {
    const conteo = {}
    activos.forEach((p) => {
      conteo[p.categoria] = (conteo[p.categoria] || 0) + 1
    })
    return conteo
  }, [activos])

  const filtrados = useMemo(() => {
    const texto = normalizar(busqueda.trim())
    const base = estado === 'desactivados' ? desactivados : activos

    return base.filter((p) => {
      if (texto && !normalizar(`${p.nombre} ${p.marca}`).includes(texto)) return false
      if (categoria !== 'Todas' && p.categoria !== categoria) return false
      if (estado === 'bajo' && estadoStock(p) !== 'bajo') return false
      if (estado === 'agotado' && estadoStock(p) !== 'agotado') return false
      if (estado === 'caducar' && !porCaducar(p)) return false
      return true
    })
  }, [activos, desactivados, busqueda, categoria, estado])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicio = (paginaActual - 1) * POR_PAGINA
  const visibles = filtrados.slice(inicio, inicio + POR_PAGINA)
  const hayFiltros = busqueda !== '' || categoria !== 'Todas' || estado !== 'todos'

  const sinProductos = !cargando && !error && productos.length === 0
  const sinResultados = !cargando && !error && !sinProductos && filtrados.length === 0

  /* ============ Acciones ============ */

  function cambiarBusqueda(valor) {
    setBusqueda(valor)
    setPagina(1)
  }

  function cambiarCategoria(valor) {
    setCategoria(valor)
    setPagina(1)
  }

  function cambiarEstado(valor) {
    setEstado(valor)
    setPagina(1)
  }

  function limpiarFiltros() {
    setBusqueda('')
    setCategoria('Todas')
    setEstado('todos')
    setPagina(1)
  }

  function irAEditar(id) {
    navigate(`/catalogo/${id}/editar`)
  }

  function pedirCambioActivo(producto) {
    setMenuAbierto(null)
    setACambiar(producto)
  }

  async function confirmarCambioActivo() {
    const producto = aCambiar
    setACambiar(null)

    try {
      const actualizado = await cambiarActivoProducto(producto.id, !producto.activo)
      setProductos((lista) => lista.map((p) => (p.id === actualizado.id ? actualizado : p)))
      notificar({
        tipo: 'ok',
        texto: actualizado.activo
          ? `${actualizado.nombre} se reactivó y vuelve a aparecer en ventas.`
          : `${actualizado.nombre} se desactivó. Su historial se conserva.`,
      })
    } catch (e) {
      notificar({ tipo: 'error', texto: mensajeDeError(e) })
    }
  }

  const chipsResumen = [
    { id: 'todos', icono: Package, texto: `${resumen.total} productos`, clase: '' },
    { id: 'bajo', icono: AlertTriangle, texto: `${resumen.bajo} stock bajo`, clase: 'cat-resumen__chip--bajo' },
    {
      id: 'agotado',
      icono: XCircle,
      texto: `${resumen.agotado} agotado${resumen.agotado === 1 ? '' : 's'}`,
      clase: 'cat-resumen__chip--agotado',
    },
    { id: 'caducar', icono: CalendarClock, texto: `${resumen.caducar} por caducar`, clase: 'cat-resumen__chip--caducar' },
  ]

  if (esPropietario && desactivados.length > 0) {
    chipsResumen.push({
      id: 'desactivados',
      icono: EyeOff,
      texto: `${desactivados.length} desactivado${desactivados.length === 1 ? '' : 's'}`,
      clase: 'cat-resumen__chip--desactivado',
    })
  }

  return (
    <div className="cat">
      {/* ============ ENCABEZADO ============ */}
      <header className="cat-encabezado">
        <div>
          <h1 className="cat-encabezado__titulo">Catálogo</h1>
          <p className="cat-encabezado__subtitulo">
            {cargando
              ? 'Cargando tus productos…'
              : sinProductos
                ? 'Aún no tienes productos registrados'
                : 'Todos los productos de tu negocio'}
          </p>

          {!cargando && !error && (
            <div className="cat-resumen">
              {chipsResumen.map(({ id, icono: Icono, texto, clase }) => (
                <button
                  key={id}
                  type="button"
                  className={`cat-resumen__chip ${clase}` + (estado === id ? ' is-activo' : '')}
                  onClick={() => cambiarEstado(id)}
                >
                  <Icono size={14} aria-hidden="true" />
                  {texto}
                </button>
              ))}
            </div>
          )}
        </div>

        {!sinProductos && !cargando && !error && esPropietario && (
          <button type="button" className="cat-boton-primario" onClick={() => navigate('/catalogo/nuevo')}>
            <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
            Nuevo producto
          </button>
        )}
      </header>

      

      {/* ============ FILTROS ============ */}
      <section className="cat-panel">
        <div className="cat-barra">
          <div className="cat-buscador">
            <Search size={16} className="cat-buscador__icono" aria-hidden="true" />
            <input
              type="text"
              placeholder="Busca por nombre o marca..."
              value={busqueda}
              onChange={(e) => cambiarBusqueda(e.target.value)}
              aria-label="Buscar producto"
              disabled={cargando || !!error}
            />
            {busqueda && (
              <button
                type="button"
                className="cat-buscador__limpiar"
                onClick={() => cambiarBusqueda('')}
                aria-label="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <label className="cat-estado">
            <span className="cat-estado__etiqueta">Estado</span>
            <select value={estado} onChange={(e) => cambiarEstado(e.target.value)} disabled={cargando || !!error}>
              <option value="todos">Todos</option>
              <option value="bajo">Stock bajo</option>
              <option value="agotado">Agotados</option>
              <option value="caducar">Por caducar</option>
              {esPropietario && <option value="desactivados">Desactivados</option>}
            </select>
          </label>

          <div className="cat-segmentado" role="tablist" aria-label="Vista">
            <button
              type="button"
              role="tab"
              aria-selected={vista === 'tabla'}
              className={'cat-segmentado__opcion' + (vista === 'tabla' ? ' is-activo' : '')}
              onClick={() => setVista('tabla')}
            >
              <List size={15} aria-hidden="true" />
              Tabla
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={vista === 'tarjetas'}
              className={'cat-segmentado__opcion' + (vista === 'tarjetas' ? ' is-activo' : '')}
              onClick={() => setVista('tarjetas')}
            >
              <LayoutGrid size={15} aria-hidden="true" />
              Tarjetas
            </button>
          </div>
        </div>

        {categorias.length > 0 && estado !== 'desactivados' && (
          <div className="cat-categorias">
            <button
              type="button"
              className={'cat-categoria' + (categoria === 'Todas' ? ' is-activa' : '')}
              onClick={() => cambiarCategoria('Todas')}
            >
              Todas<span className="cat-categoria__conteo">({activos.length})</span>
            </button>

            {categorias.map((c) => (
              <button
                key={c}
                type="button"
                className={'cat-categoria' + (categoria === c ? ' is-activa' : '')}
                onClick={() => cambiarCategoria(c)}
              >
                {c}
                <span className="cat-categoria__conteo">({conteoCategorias[c] || 0})</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ============ RESULTADOS ============ */}
      <section className="cat-panel cat-panel--tabla">
        {cargando ? (
          /* --- Cargando --- */
          <div className="cat-vacio-estado">
            <span className="cat-vacio-estado__icono" aria-hidden="true">
              <Loader2 size={22} className="cat-girando" />
            </span>
            <p className="cat-vacio-estado__titulo">Cargando productos…</p>
          </div>
        ) : error ? (
          /* --- No se pudo cargar --- */
          <div className="cat-vacio-estado">
            <span className="cat-vacio-estado__icono cat-vacio-estado__icono--error" aria-hidden="true">
              <WifiOff size={22} />
            </span>
            <p className="cat-vacio-estado__titulo">No pudimos cargar tus productos</p>
            <p className="cat-vacio-estado__texto">{error}</p>
            <button type="button" className="cat-boton-secundario" onClick={cargarProductos}>
              <RotateCcw size={14} aria-hidden="true" />
              Reintentar
            </button>
          </div>
        ) : sinProductos ? (
          /* --- Sin productos registrados --- */
          <div className="cat-vacio-estado">
            <span className="cat-vacio-estado__icono" aria-hidden="true">
              <PackageOpen size={22} />
            </span>
            <p className="cat-vacio-estado__titulo">Aún no tienes productos</p>
            <p className="cat-vacio-estado__texto">
              {esPropietario
                ? 'Agrega tu primer producto para empezar a controlar tu inventario.'
                : 'Pídele al propietario que agregue los productos del negocio.'}
            </p>
            {esPropietario && (
              <button type="button" className="cat-boton-primario" onClick={() => navigate('/catalogo/nuevo')}>
                <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
                Nuevo producto
              </button>
            )}
          </div>
        ) : sinResultados ? (
          /* --- Sin resultados por filtros --- */
          <div className="cat-vacio-estado">
            <span className="cat-vacio-estado__icono" aria-hidden="true">
              <SearchX size={22} />
            </span>
            <p className="cat-vacio-estado__titulo">No encontramos productos</p>
            <p className="cat-vacio-estado__texto">Prueba con otro nombre o quita algún filtro.</p>
            {hayFiltros && (
              <button type="button" className="cat-boton-secundario" onClick={limpiarFiltros}>
                Limpiar filtros
              </button>
            )}
          </div>
        ) : vista === 'tabla' ? (
          /* --- Vista tabla --- */
          <table className="cat-tabla">
            <thead>
              <tr>
                <th className="cat-col-num">No.</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th className="is-der">Precio</th>
                {esPropietario && <th className="is-der">Último costo</th>}
                {esPropietario && <th className="is-der">Margen</th>}
                <th>Stock</th>
                <th>Caducidad</th>
                <th className="is-der">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p, indice) => {
                const m = margen(p)
                const numero = inicio + indice + 1
                const abreArriba = visibles.length > 3 && indice >= visibles.length - 2

                return (
                 <tr
                    key={p.id}
                    className={(p.activo ? '' : 'cat-fila-inactiva') + (p.id === resaltado ? ' cat-fila-resaltada' : '')}
                  >
                    <td className="cat-col-num">{numero}</td>
                    <td className="cat-col-producto">
                      <div className="cat-producto">
                        <FotoProducto producto={p} />
                        <div>
                          <p className="cat-producto__nombre">
                            {p.nombre}
                            {!p.activo && <span className="cat-chip-inactivo">Desactivado</span>}
                          </p>
                          {(p.marca || p.descripcion) && (
                            <p className="cat-producto__marca" title={p.descripcion || undefined}>
                              {[p.marca, p.descripcion].filter(Boolean).join(' · ')}
                            </p>
                          )}
                         </div>
                      </div>
                    </td>
                    <td>
                      <span className="cat-chip">{p.categoria}</span>
                    </td>
                    <td className="is-der cat-precio">{moneda.format(p.precio)}</td>
                    {esPropietario && (
                      <td className="is-der cat-costo">
                        {p.costo !== null ? moneda.format(p.costo) : <span className="cat-sin-dato">—</span>}
                      </td>
                    )}
                    {esPropietario && (
                      <td className={'is-der cat-margen' + (m !== null && m < MARGEN_BAJO ? ' is-bajo' : '')}>
                        {m !== null ? `${m}%` : <span className="cat-sin-dato">—</span>}
                      </td>
                    )}
                    <td>
                      <PastillaStock producto={p} />
                    </td>
                    <td className="cat-col-caducidad">
                      <Caducidad producto={p} />
                    </td>
                    <td className="is-der">
                      <div className="cat-acciones" ref={menuAbierto === p.id ? menuRef : null}>
                        {esPropietario && p.activo && (
                          <button
                            type="button"
                            className="cat-icono-boton"
                            title="Editar"
                            aria-label={`Editar ${p.nombre}`}
                            onClick={() => irAEditar(p.id)}
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="cat-icono-boton"
                          title="Más opciones"
                          aria-label={`Más opciones de ${p.nombre}`}
                          aria-expanded={menuAbierto === p.id}
                          onClick={() => setMenuAbierto(menuAbierto === p.id ? null : p.id)}
                        >
                          <MoreVertical size={16} />
                        </button>

                        {menuAbierto === p.id && (
                          <div className={'cat-menu' + (abreArriba ? ' cat-menu--arriba' : '')} role="menu">
                            {esPropietario && p.activo && (
                              <button type="button" role="menuitem" onClick={() => irAEditar(p.id)}>
                                <Pencil size={14} aria-hidden="true" />
                                Editar producto
                              </button>
                            )}
                            <button type="button" role="menuitem" onClick={() => navigate('/movimientos')}>
                              <History size={14} aria-hidden="true" />
                              Ver movimientos
                            </button>
                            {esPropietario &&
                              (p.activo ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="is-peligro"
                                  onClick={() => pedirCambioActivo(p)}
                                >
                                  <EyeOff size={14} aria-hidden="true" />
                                  Desactivar
                                </button>
                              ) : (
                                <button type="button" role="menuitem" onClick={() => pedirCambioActivo(p)}>
                                  <Eye size={14} aria-hidden="true" />
                                  Reactivar
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          /* --- Vista tarjetas --- */
          <div className="cat-tarjetas">
            {visibles.map((p, indice) => {
              const m = margen(p)

              return (
                <article
                  className={
                    'cat-tarjeta' +
                    (p.activo ? '' : ' cat-tarjeta--inactiva') +
                    (p.id === resaltado ? ' cat-tarjeta--resaltada' : '')
                  }
                  key={p.id}
                >
                  <div className="cat-tarjeta__arriba">
                    <FotoProducto producto={p} grande />
                    <span className="cat-tarjeta__numero">No. {inicio + indice + 1}</span>
                  </div>

                  <p className="cat-tarjeta__nombre">{p.nombre}</p>
                  <div className="cat-tarjeta__etiquetas">
                    <span className="cat-chip">{p.categoria}</span>
                    {p.marca && <span className="cat-tarjeta__marca-texto">{p.marca}</span>}
                  </div>
                  {p.descripcion && <p className="cat-tarjeta__desc">{p.descripcion}</p>}

                  <div className="cat-tarjeta__precio">
                    <span className="cat-precio">{moneda.format(p.precio)}</span>
                    {esPropietario && m !== null && (
                      <span className={'cat-margen' + (m < MARGEN_BAJO ? ' is-bajo' : '')}>{m}% margen</span>
                    )}
                  </div>

                  <div className="cat-tarjeta__pie">
                    <PastillaStock producto={p} />
                    {porCaducar(p) && <Caducidad producto={p} />}
                  </div>

                  {esPropietario &&
                    (p.activo ? (
                      <button type="button" className="cat-boton-secundario" onClick={() => irAEditar(p.id)}>
                        <Pencil size={14} aria-hidden="true" />
                        Editar
                      </button>
                    ) : (
                      <button type="button" className="cat-boton-secundario" onClick={() => pedirCambioActivo(p)}>
                        <Eye size={14} aria-hidden="true" />
                        Reactivar
                      </button>
                    ))}
                </article>
              )
            })}
          </div>
        )}

        {/* ============ PAGINACIÓN ============ */}
        {!cargando && !error && !sinProductos && !sinResultados && (
          <footer className="cat-paginacion">
            <span>
              Mostrando{' '}
              <strong>
                {inicio + 1}–{Math.min(inicio + POR_PAGINA, filtrados.length)}
              </strong>{' '}
              de <strong>{filtrados.length}</strong> productos
            </span>

            {totalPaginas > 1 && (
              <div className="cat-paginacion__botones">
                <button type="button" disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)}>
                  <ChevronLeft size={15} aria-hidden="true" />
                  Anterior
                </button>

                {paginasVisibles(totalPaginas, paginaActual).map((n, i) =>
                  n === '…' ? (
                    <span key={`puntos-${i}`} className="cat-paginacion__puntos">
                      …
                    </span>
                  ) : (
                    <button
                      key={n}
                      type="button"
                      className={'cat-pagina' + (n === paginaActual ? ' is-activa' : '')}
                      onClick={() => setPagina(n)}
                      aria-current={n === paginaActual ? 'page' : undefined}
                    >
                      {n}
                    </button>
                  )
                )}

                <button
                  type="button"
                  disabled={paginaActual === totalPaginas}
                  onClick={() => setPagina(paginaActual + 1)}
                >
                  Siguiente
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              </div>
            )}
          </footer>
        )}
      </section>

      <ConfirmDialog
        open={aCambiar !== null}
        title={aCambiar?.activo ? '¿Desactivar el producto?' : '¿Reactivar el producto?'}
        message={
          aCambiar
            ? aCambiar.activo
              ? `${aCambiar.nombre} ya no aparecerá en ventas ni en el catálogo. Su historial se conserva y lo puedes reactivar cuando quieras.`
              : `${aCambiar.nombre} vuelve a aparecer en el catálogo y en ventas.`
            : ''
        }
        confirmText={aCambiar?.activo ? 'Sí, desactivar' : 'Sí, reactivar'}
        cancelText="Cancelar"
        tone={aCambiar?.activo ? 'danger' : 'default'}
        onConfirm={confirmarCambioActivo}
        onCancel={() => setACambiar(null)}
      />
    </div>
  )
}