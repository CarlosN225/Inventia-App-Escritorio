import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  SearchX,
  PackageOpen,
} from 'lucide-react'

import '../styles/catalogo.css'

/* ============================================================
   ESTADO INICIAL — Todo vacío hasta conectar el backend
   ------------------------------------------------------------
   PRODUCTOS:  catálogo del negocio
   CATEGORIAS: categorías disponibles (o se calculan de PRODUCTOS)
   ============================================================ */
const PRODUCTOS = []
const CATEGORIAS = []

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

function margen(p) {
  return Math.round(((p.precio - p.costo) / p.precio) * 100)
}

/* ============ Componentes auxiliares ============ */

function PastillaStock({ producto }) {
  const estado = estadoStock(producto)
  const texto =
    estado === 'agotado'
      ? '0 · Agotado'
      : `${producto.stock} pzas${estado === 'bajo' ? ' · Bajo' : ''}`

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

  if (porCaducar(producto)) {
    const urgente = producto.diasCaducar <= 7
    return (
      <span className={'cat-caduca' + (urgente ? ' is-urgente' : '')}>
        <CalendarClock size={13} aria-hidden="true" />
        Caduca en {producto.diasCaducar} días
      </span>
    )
  }

  return <span>{producto.caducidad}</span>
}

/* ============ Componente principal ============ */

export default function Catalogo() {
  const navigate = useNavigate()

  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('Todas')
  const [estado, setEstado] = useState('todos')
  const [vista, setVista] = useState('tabla')
  const [pagina, setPagina] = useState(1)
  const [menuAbierto, setMenuAbierto] = useState(null)

  const menuRef = useRef(null)

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

  const resumen = useMemo(
    () => ({
      total: PRODUCTOS.length,
      bajo: PRODUCTOS.filter((p) => estadoStock(p) === 'bajo').length,
      agotado: PRODUCTOS.filter((p) => estadoStock(p) === 'agotado').length,
      caducar: PRODUCTOS.filter(porCaducar).length,
    }),
    []
  )

  const conteoCategorias = useMemo(() => {
    const conteo = {}
    PRODUCTOS.forEach((p) => {
      conteo[p.categoria] = (conteo[p.categoria] || 0) + 1
    })
    return conteo
  }, [])

  const filtrados = useMemo(() => {
    const texto = normalizar(busqueda.trim())

    return PRODUCTOS.filter((p) => {
      if (texto && !normalizar(`${p.nombre} ${p.marca}`).includes(texto)) return false
      if (categoria !== 'Todas' && p.categoria !== categoria) return false
      if (estado === 'bajo' && estadoStock(p) !== 'bajo') return false
      if (estado === 'agotado' && estadoStock(p) !== 'agotado') return false
      if (estado === 'caducar' && !porCaducar(p)) return false
      return true
    })
  }, [busqueda, categoria, estado])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicio = (paginaActual - 1) * POR_PAGINA
  const visibles = filtrados.slice(inicio, inicio + POR_PAGINA)
  const hayFiltros = busqueda !== '' || categoria !== 'Todas' || estado !== 'todos'

  const sinProductos = PRODUCTOS.length === 0
  const sinResultados = filtrados.length === 0 && !sinProductos

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

  const chipsResumen = [
    { id: 'todos',   icono: Package,       texto: `${resumen.total} productos`, clase: '' },
    { id: 'bajo',    icono: AlertTriangle, texto: `${resumen.bajo} stock bajo`, clase: 'cat-resumen__chip--bajo' },
    { id: 'agotado', icono: XCircle,       texto: `${resumen.agotado} agotado${resumen.agotado === 1 ? '' : 's'}`, clase: 'cat-resumen__chip--agotado' },
    { id: 'caducar', icono: CalendarClock, texto: `${resumen.caducar} por caducar`, clase: 'cat-resumen__chip--caducar' },
  ]

  return (
    <div className="cat">
      {/* ============ ENCABEZADO ============ */}
      <header className="cat-encabezado">
        <div>
          <h1 className="cat-encabezado__titulo">Catálogo</h1>
          <p className="cat-encabezado__subtitulo">
            {sinProductos
              ? 'Aún no tienes productos registrados'
              : `Todos los productos de tu negocio`}
          </p>

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
        </div>

        {!sinProductos && (
          <button
            type="button"
            className="cat-boton-primario"
            onClick={() => navigate('/catalogo/nuevo')}
          >
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
            <select value={estado} onChange={(e) => cambiarEstado(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="bajo">Stock bajo</option>
              <option value="agotado">Agotados</option>
              <option value="caducar">Por caducar</option>
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

        {CATEGORIAS.length > 0 && (
          <div className="cat-categorias">
            <button
              type="button"
              className={'cat-categoria' + (categoria === 'Todas' ? ' is-activa' : '')}
              onClick={() => cambiarCategoria('Todas')}
            >
              Todas<span className="cat-categoria__conteo">({PRODUCTOS.length})</span>
            </button>

            {CATEGORIAS.filter((c) => conteoCategorias[c]).map((c) => (
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

        {/* --- Sin productos registrados --- */}
        {sinProductos ? (
          <div className="cat-vacio-estado">
            <span className="cat-vacio-estado__icono" aria-hidden="true">
              <PackageOpen size={22} />
            </span>
            <p className="cat-vacio-estado__titulo">Aún no tienes productos</p>
            <p className="cat-vacio-estado__texto">
              Agrega tu primer producto para empezar a controlar tu inventario.
            </p>
            <button
              type="button"
              className="cat-boton-primario"
              onClick={() => navigate('/catalogo/nuevo')}
            >
              <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
              Nuevo producto
            </button>
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
                <th className="is-der">Último costo</th>
                <th className="is-der">Margen</th>
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
                  <tr key={p.id}>
                    <td className="cat-col-num">{numero}</td>
                    <td className="cat-col-producto">
                      <div className="cat-producto">
                        <span className="cat-placeholder" aria-hidden="true">
                          <Candy size={16} />
                        </span>
                        <div>
                          <p className="cat-producto__nombre">{p.nombre}</p>
                          <p className="cat-producto__marca">{p.marca}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="cat-chip">{p.categoria}</span>
                    </td>
                    <td className="is-der cat-precio">{moneda.format(p.precio)}</td>
                    <td className="is-der cat-costo">{moneda.format(p.costo)}</td>
                    <td className={'is-der cat-margen' + (m < MARGEN_BAJO ? ' is-bajo' : '')}>{m}%</td>
                    <td>
                      <PastillaStock producto={p} />
                    </td>
                    <td className="cat-col-caducidad">
                      <Caducidad producto={p} />
                    </td>
                    <td className="is-der">
                      <div className="cat-acciones" ref={menuAbierto === p.id ? menuRef : null}>
                        <button
                          type="button"
                          className="cat-icono-boton"
                          title="Editar"
                          aria-label={`Editar ${p.nombre}`}
                          onClick={() => irAEditar(p.id)}
                        >
                          <Pencil size={16} />
                        </button>
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
                            <button type="button" role="menuitem" onClick={() => irAEditar(p.id)}>
                              <Pencil size={14} aria-hidden="true" />
                              Editar producto
                            </button>
                            <button type="button" role="menuitem" onClick={() => navigate('/movimientos')}>
                              <History size={14} aria-hidden="true" />
                              Ver movimientos
                            </button>
                            {/* TODO: conectar con el backend (desactivar, no borrar) */}
                            <button
                              type="button"
                              role="menuitem"
                              className="is-peligro"
                              onClick={() => setMenuAbierto(null)}
                            >
                              <EyeOff size={14} aria-hidden="true" />
                              Desactivar
                            </button>
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
                <article className="cat-tarjeta" key={p.id}>
                  <div className="cat-tarjeta__arriba">
                    <span className="cat-placeholder cat-placeholder--grande" aria-hidden="true">
                      <Candy size={22} />
                    </span>
                    <span className="cat-tarjeta__numero">No. {inicio + indice + 1}</span>
                  </div>

                  <p className="cat-tarjeta__nombre">{p.nombre}</p>
                  <p className="cat-tarjeta__marca">
                    {p.marca} · {p.categoria}
                  </p>

                  <div className="cat-tarjeta__precio">
                    <span className="cat-precio">{moneda.format(p.precio)}</span>
                    <span className={'cat-margen' + (m < MARGEN_BAJO ? ' is-bajo' : '')}>{m}% margen</span>
                  </div>

                  <div className="cat-tarjeta__pie">
                    <PastillaStock producto={p} />
                    {porCaducar(p) && <Caducidad producto={p} />}
                  </div>

                  <button type="button" className="cat-boton-secundario" onClick={() => irAEditar(p.id)}>
                    <Pencil size={14} aria-hidden="true" />
                    Editar
                  </button>
                </article>
              )
            })}
          </div>
        )}

        {/* ============ PAGINACIÓN ============ */}
        {!sinProductos && !sinResultados && (
          <footer className="cat-paginacion">
            <span>
              Mostrando <strong>{inicio + 1}–{Math.min(inicio + POR_PAGINA, filtrados.length)}</strong> de{' '}
              <strong>{filtrados.length}</strong> productos
            </span>

            <div className="cat-paginacion__botones">
              <button
                type="button"
                disabled={paginaActual === 1}
                onClick={() => setPagina(paginaActual - 1)}
              >
                <ChevronLeft size={15} aria-hidden="true" />
                Anterior
              </button>

              {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={'cat-pagina' + (n === paginaActual ? ' is-activa' : '')}
                  onClick={() => setPagina(n)}
                  aria-current={n === paginaActual ? 'page' : undefined}
                >
                  {n}
                </button>
              ))}

              <button
                type="button"
                disabled={paginaActual === totalPaginas}
                onClick={() => setPagina(paginaActual + 1)}
              >
                Siguiente
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>
          </footer>
        )}
      </section>
    </div>
  )
}