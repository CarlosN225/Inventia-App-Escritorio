import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Info,
  ArrowUp,
  ArrowUpRight,
  Receipt,
  AlertTriangle,
  CalendarX,
  Clock,
  Candy,
  Package,
  PackageX,
  Bell,
  ShoppingCart,
  History,
} from 'lucide-react'

import { getUsuarioActual } from '../services/auth'
import { listarProductos } from '../services/productos'
import { listarMovimientos } from '../services/movimientos'
import { textoUnidad } from '../utils/unidades'

import '../styles/dashboard.css'

// TODO: traer de Configuración › Negocio (endpoint de Héctor)
const NOMBRE_NEGOCIO = 'Los Querubines'

// TODO: traer dias_aviso_caducidad de la Configuración
const DIAS_AVISO_CADUCIDAD = 30
const MAX_AVISOS = 5
const MAX_MOVIMIENTOS = 6

// TODO: llenar con el endpoint de ventas (Bryan)
const RESULTADOS = null
const GANANCIA_DIARIA = []
const MAS_VENDIDOS = []
const MENOS_VENDIDOS = []

const PERIODOS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
]

const TIPOS_MOVIMIENTO = {
  entrada: { label: 'Entrada', clase: 'compra' },
  salida: { label: 'Venta', clase: 'venta' },
  merma: { label: 'Merma', clase: 'merma' },
  correccion: { label: 'Corrección', clase: 'correccion' },
}

const ICONOS_AVISO = {
  agotado: PackageX,
  urgente: CalendarX,
  stock: AlertTriangle,
  caducidad: Clock,
}

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const monedaCorta = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
const numero = new Intl.NumberFormat('es-MX')
const formatoDiaMes = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' })

function primerNombre(nombreCompleto) {
  return nombreCompleto?.trim().split(/\s+/)[0] ?? ''
}

// "hace 5 min", "hace 2 h", "ayer", "3 oct"
function hace(fechaIso) {
  if (!fechaIso) return '—'

  const fecha = new Date(fechaIso)
  const minutos = Math.floor((Date.now() - fecha.getTime()) / 60000)

  if (minutos < 1) return 'ahora'
  if (minutos < 60) return `hace ${minutos} min`

  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  if (horas < 48) return 'ayer'

  return formatoDiaMes.format(fecha)
}

/* ============================================================ */

export default function Dashboard() {
  const navigate = useNavigate()

  const [periodo, setPeriodo] = useState('mes')
  const [vistaTop, setVistaTop] = useState('mas')

  const [usuarioActual, setUsuarioActual] = useState(null)
  const [cargandoUsuario, setCargandoUsuario] = useState(true)

  const [productos, setProductos] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    getUsuarioActual()
      .then(setUsuarioActual)
      .catch(() => setUsuarioActual(null))
      .finally(() => setCargandoUsuario(false))

    // Si una de las dos falla, la otra se muestra igual
    Promise.allSettled([listarProductos(), listarMovimientos()]).then(([prods, movs]) => {
      if (prods.status === 'fulfilled') setProductos(prods.value)
      if (movs.status === 'fulfilled') setMovimientos(movs.value)
      setCargando(false)
    })
  }, [])

  /*
     Solo el propietario puede ver:
     - Ventas del periodo
     - Ganancia estimada
     - Ganancia por día
  */
  const esPropietario = usuarioActual?.rol === 'propietario'
  const nombreUsuario = primerNombre(usuarioActual?.nombre_completo) || 'de nuevo'

  /* ---------- Inventario (de los productos reales) ---------- */

  const activos = useMemo(() => productos.filter((p) => p.activo), [productos])
  const productosPorId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])

  const stockBajo = useMemo(() => activos.filter((p) => p.stock < p.minimo), [activos])

  const porCaducar = useMemo(
    () => activos.filter((p) => p.diasCaducar !== null && p.diasCaducar <= DIAS_AVISO_CADUCIDAD && p.stock > 0),
    [activos]
  )

  // Los avisos más urgentes primero
  const avisos = useMemo(() => {
    const lista = []

    activos
      .filter((p) => p.stock === 0)
      .forEach((p) =>
        lista.push({ id: `a-${p.id}`, tipo: 'agotado', clase: 'urgente', nombre: p.nombre, detalle: 'Agotado', accion: 'Surtir', ir: '/registrar-compra', orden: 0 })
      )

    porCaducar
      .filter((p) => p.diasCaducar <= 7)
      .forEach((p) =>
        lista.push({
          id: `u-${p.id}`,
          tipo: 'urgente',
          clase: 'urgente',
          nombre: p.nombre,
          detalle: p.diasCaducar < 0 ? 'Ya caducó' : p.diasCaducar === 0 ? 'Caduca hoy' : `Caduca en ${p.diasCaducar} días`,
          accion: 'Ver',
          ir: '/alertas',
          orden: 1 + p.diasCaducar / 100,
        })
      )

    stockBajo
      .filter((p) => p.stock > 0)
      .forEach((p) =>
        lista.push({
          id: `s-${p.id}`,
          tipo: 'stock',
          clase: 'stock',
          nombre: p.nombre,
          detalle: `Quedan ${p.stock} ${textoUnidad(p.unidad, p.stock)} · mínimo ${p.minimo}`,
          accion: 'Surtir',
          ir: '/registrar-compra',
          orden: 2 + p.stock / Math.max(p.minimo, 1),
        })
      )

    porCaducar
      .filter((p) => p.diasCaducar > 7)
      .forEach((p) =>
        lista.push({
          id: `c-${p.id}`,
          tipo: 'caducidad',
          clase: 'caducidad',
          nombre: p.nombre,
          detalle: `Caduca en ${p.diasCaducar} días`,
          accion: 'Ver',
          ir: '/alertas',
          orden: 4 + p.diasCaducar / 100,
        })
      )

    return lista.sort((a, b) => a.orden - b.orden)
  }, [activos, stockBajo, porCaducar])

  /* ---------- Movimientos ---------- */

  const ultimosMovimientos = useMemo(
    () =>
      [...movimientos]
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, MAX_MOVIMIENTOS)
        .map((m) => {
          const producto = productosPorId.get(m.productoId)
          const tipo = TIPOS_MOVIMIENTO[m.tipo] ?? { label: m.tipo, clase: 'correccion' }
          const etiqueta = m.tipo === 'entrada' && m.compraId ? 'Compra' : tipo.label
          const unidad = producto?.unidad ?? 'pieza'

          let cantidad
          let claseCantidad

          if (m.tipo === 'correccion') {
            cantidad = m.stockResultante !== null ? `→ ${m.stockResultante}` : m.cantidad
            claseCantidad = 'is-neutra'
          } else if (m.tipo === 'entrada') {
            cantidad = `+${m.cantidad}`
            claseCantidad = 'is-suma'
          } else {
            cantidad = `−${m.cantidad}`
            claseCantidad = 'is-resta'
          }

          const usuario =
            m.usuarioNombre ??
            (usuarioActual && m.usuarioId === usuarioActual.id ? usuarioActual.nombre_completo : null)

          return {
            id: m.id,
            producto: m.productoNombre ?? producto?.nombre ?? `Producto #${m.productoId}`,
            etiqueta,
            clase: tipo.clase,
            cantidad: `${cantidad} ${textoUnidad(unidad, m.cantidad)}`,
            claseCantidad,
            usuario: usuario ? primerNombre(usuario) : '—',
            hace: hace(m.fecha),
          }
        }),
    [movimientos, productosPorId, usuarioActual]
  )

  /* ---------- Ventas (pendiente) ---------- */

  const resumen = RESULTADOS
  const topLista = vistaTop === 'mas' ? MAS_VENDIDOS : MENOS_VENDIDOS
  const sinTopProductos = topLista.length === 0
  const sinGanancia = GANANCIA_DIARIA.length === 0

  const maxGanancia = sinGanancia ? 0 : Math.max(...GANANCIA_DIARIA.map((d) => d.valor))
  const maxTop = sinTopProductos ? 0 : Math.max(...topLista.map((p) => p.piezas))
  const escalaMax = sinGanancia ? 1000 : Math.ceil(maxGanancia / 500) * 500
  const marcasEje = sinGanancia ? [1000, 500, 0] : [escalaMax, escalaMax / 2, 0]

  if (cargandoUsuario) return null

  return (
    <div className="dash">
      {/* ============ ENCABEZADO ============ */}
      <header className="dash-encabezado">
        <div>
          <h1 className="dash-encabezado__titulo">Hola, {nombreUsuario}</h1>
          <p className="dash-encabezado__subtitulo">Así va {NOMBRE_NEGOCIO} hoy</p>
        </div>

        {esPropietario && (
          <div className="dash-segmentado" role="tablist" aria-label="Periodo">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={periodo === p.id}
                className={'dash-segmentado__opcion' + (periodo === p.id ? ' is-activo' : '')}
                onClick={() => setPeriodo(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ============ KPIs ============ */}
      <section className="dash-kpis">
        {esPropietario && (
          <article className="dash-kpi">
            <span className="dash-kpi__etiqueta">
              {periodo === 'hoy' ? 'Ventas de hoy' : periodo === 'semana' ? 'Ventas de la semana' : 'Ventas del mes'}
            </span>
            <p className="dash-kpi__valor">{resumen ? moneda.format(resumen.ventas) : '—'}</p>
            <p className="dash-kpi__nota">
              <Receipt size={14} aria-hidden="true" />
              {resumen ? `${numero.format(resumen.numVentas)} ventas registradas` : 'Sin ventas registradas'}
            </p>
          </article>
        )}

        {esPropietario && (
          <article className="dash-kpi">
            <div className="dash-kpi__fila">
              <span className="dash-kpi__etiqueta">Ganancia estimada</span>
              <span className="dash-kpi__info" title="Ventas menos lo que te costó lo vendido">
                <Info size={14} />
              </span>
            </div>
            <p className={'dash-kpi__valor' + (resumen ? ' dash-kpi__valor--verde' : '')}>
              {resumen ? moneda.format(resumen.ganancia) : '—'}
            </p>
            {resumen && resumen.cambio !== 0 ? (
              <span className="dash-pastilla dash-pastilla--verde">
                <ArrowUp size={12} strokeWidth={2.6} aria-hidden="true" />
                {resumen.cambio}% {resumen.comparado}
              </span>
            ) : (
              <span className="dash-kpi__nota">Sin comparativa disponible</span>
            )}
          </article>
        )}

        <article className="dash-kpi dash-kpi--clic" onClick={() => navigate('/alertas')} title="Ver en Alertas">
          <span className="dash-kpi__etiqueta">Stock bajo</span>
          <p className={'dash-kpi__valor' + (stockBajo.length > 0 ? ' dash-kpi__valor--ambar' : '')}>
            {cargando ? '—' : stockBajo.length}
          </p>
          <p className="dash-kpi__nota">
            <AlertTriangle size={14} className="dash-icono--ambar" aria-hidden="true" />
            productos por debajo del mínimo
          </p>
        </article>

        <article className="dash-kpi dash-kpi--clic" onClick={() => navigate('/alertas')} title="Ver en Alertas">
          <span className="dash-kpi__etiqueta">Por caducar</span>
          <p className={'dash-kpi__valor' + (porCaducar.length > 0 ? ' dash-kpi__valor--rojo' : '')}>
            {cargando ? '—' : porCaducar.length}
          </p>
          <p className="dash-kpi__nota">
            <CalendarX size={14} className="dash-icono--rojo" aria-hidden="true" />
            en los próximos {DIAS_AVISO_CADUCIDAD} días
          </p>
        </article>
      </section>

      {/* ============ GRÁFICA + TOP ============ */}
      <section className="dash-fila">
        {esPropietario && (
          <article className="dash-tarjeta">
            <div className="dash-tarjeta__cabecera">
              <div>
                <h2 className="dash-tarjeta__titulo">Ganancia por día</h2>
                <p className="dash-tarjeta__subtitulo">Últimos 7 días</p>
              </div>
              <span className="dash-leyenda">
                <span className="dash-leyenda__punto" aria-hidden="true" />
                Ganancia estimada
              </span>
            </div>

            {sinGanancia ? (
              <div className="dash-vacio">
                <div className="dash-vacio__icono" aria-hidden="true">
                  <ShoppingCart size={22} strokeWidth={1.8} />
                </div>
                <p className="dash-vacio__titulo">Aún no hay ganancias registradas</p>
                <p className="dash-vacio__texto">Cuando registres tus primeras ventas, aparecerán aquí agrupadas por día.</p>
                <button type="button" className="dash-boton-chico" onClick={() => navigate('/registrar-venta')}>
                  Registrar venta
                </button>
              </div>
            ) : (
              <div className="dash-chart">
                <div className="dash-chart__eje">
                  {marcasEje.map((v) => (
                    <span key={v}>{monedaCorta.format(v)}</span>
                  ))}
                </div>

                <div className="dash-chart__area">
                  <div className="dash-chart__rejilla">
                    {marcasEje.map((v) => (
                      <div key={v} className="dash-chart__linea" style={{ bottom: `${(v / escalaMax) * 100}%` }} />
                    ))}
                  </div>

                  <div className="dash-chart__barras">
                    {GANANCIA_DIARIA.map((d) => {
                      const esMax = d.valor === maxGanancia
                      const clases = 'dash-chart__barra' + (esMax ? ' is-max' : '') + (d.hoy ? ' is-hoy' : '')

                      return (
                        <div className="dash-chart__columna" key={d.dia}>
                          <div className="dash-chart__pista">
                            <div
                              className={clases}
                              style={{ height: `${(d.valor / escalaMax) * 100}%` }}
                              title={`${d.dia}: ${moneda.format(d.valor)}`}
                            >
                              {esMax && <span className="dash-chart__valor">{monedaCorta.format(d.valor)}</span>}
                            </div>
                          </div>
                          <span className={'dash-chart__dia' + (esMax ? ' is-max' : '')}>{d.dia}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </article>
        )}

        <article className="dash-tarjeta">
          <div className="dash-tarjeta__cabecera">
            <h2 className="dash-tarjeta__titulo">Top productos</h2>
            <div className="dash-segmentado dash-segmentado--chico" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={vistaTop === 'mas'}
                className={'dash-segmentado__opcion' + (vistaTop === 'mas' ? ' is-activo' : '')}
                onClick={() => setVistaTop('mas')}
              >
                Más vendidos
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={vistaTop === 'menos'}
                className={'dash-segmentado__opcion' + (vistaTop === 'menos' ? ' is-activo' : '')}
                onClick={() => setVistaTop('menos')}
              >
                Menos
              </button>
            </div>
          </div>

          {sinTopProductos ? (
            <div className="dash-vacio">
              <div className="dash-vacio__icono" aria-hidden="true">
                <Package size={22} strokeWidth={1.8} />
              </div>
              <p className="dash-vacio__titulo">Aún no hay ventas</p>
              <p className="dash-vacio__texto">Cuando registres ventas, aquí verás lo que más y lo que menos sale.</p>
              <button type="button" className="dash-boton-chico" onClick={() => navigate('/registrar-venta')}>
                Registrar venta
              </button>
            </div>
          ) : (
            <ol className="dash-top">
              {topLista.map((p, i) => (
                <li className="dash-top__item" key={p.nombre}>
                  <span className="dash-top__posicion">{i + 1}</span>
                  <span className="dash-placeholder" aria-hidden="true">
                    <Candy size={15} />
                  </span>
                  <div className="dash-top__info">
                    <div className="dash-top__fila">
                      <span className="dash-top__nombre">{p.nombre}</span>
                      <span className="dash-top__piezas">{p.piezas} pzas</span>
                    </div>
                    <div className="dash-top__barra">
                      <div
                        className={'dash-top__relleno' + (vistaTop === 'menos' ? ' is-bajo' : '')}
                        style={{ width: `${(p.piezas / maxTop) * 100}%` }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </article>
      </section>

      {/* ============ MOVIMIENTOS + AVISOS ============ */}
      <section className="dash-fila">
        <article className="dash-tarjeta">
          <div className="dash-tarjeta__cabecera">
            <h2 className="dash-tarjeta__titulo">Últimos movimientos</h2>
            <button type="button" className="dash-enlace" onClick={() => navigate('/movimientos')}>
              Ver todos
              <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          </div>

          {!cargando && ultimosMovimientos.length === 0 ? (
            <div className="dash-vacio">
              <div className="dash-vacio__icono" aria-hidden="true">
                <History size={22} strokeWidth={1.8} />
              </div>
              <p className="dash-vacio__titulo">Sin movimientos todavía</p>
              <p className="dash-vacio__texto">Aquí verás las ventas, compras y mermas en cuanto se registren.</p>
            </div>
          ) : (
            <div className="dash-tabla-contenedor">
              <table className="dash-tabla">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Tipo</th>
                    <th className="is-der">Cantidad</th>
                    <th>Usuario</th>
                    <th className="is-der">Hace</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimosMovimientos.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="dash-tabla__producto">
                          <span className="dash-placeholder dash-placeholder--chico" aria-hidden="true">
                            <Candy size={13} />
                          </span>
                          {m.producto}
                        </div>
                      </td>
                      <td>
                        <span className={`dash-tipo dash-tipo--${m.clase}`}>{m.etiqueta}</span>
                      </td>
                      <td className={'is-der dash-tabla__cantidad ' + m.claseCantidad}>{m.cantidad}</td>
                      <td>{m.usuario}</td>
                      <td className="is-der dash-tabla__tiempo">{m.hace}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="dash-tarjeta">
          <div className="dash-tarjeta__cabecera">
            <h2 className="dash-tarjeta__titulo">
              {avisos.length > 0 && <span className="dash-punto-rojo" aria-hidden="true" />}
              Requiere tu atención
            </h2>
            {avisos.length > MAX_AVISOS && (
              <button type="button" className="dash-enlace" onClick={() => navigate('/alertas')}>
                Ver las {avisos.length}
                <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          {!cargando && avisos.length === 0 ? (
            <div className="dash-vacio">
              <div className="dash-vacio__icono" aria-hidden="true">
                <Bell size={22} strokeWidth={1.8} />
              </div>
              <p className="dash-vacio__titulo">Todo en orden</p>
              <p className="dash-vacio__texto">Aquí verás los avisos de stock bajo y productos por caducar.</p>
            </div>
          ) : (
            <ul className="dash-avisos">
              {avisos.slice(0, MAX_AVISOS).map((a) => {
                const Icono = ICONOS_AVISO[a.tipo]

                return (
                  <li key={a.id} className={`dash-aviso dash-aviso--${a.clase}`}>
                    <span className="dash-aviso__icono" aria-hidden="true">
                      <Icono size={15} strokeWidth={2.2} />
                    </span>
                    <div className="dash-aviso__info">
                      <p className="dash-aviso__nombre">{a.nombre}</p>
                      <p className="dash-aviso__detalle">{a.detalle}</p>
                    </div>
                    <button type="button" className="dash-boton-chico" onClick={() => navigate(a.ir)}>
                      {a.accion}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </article>
      </section>
    </div>
  )
}