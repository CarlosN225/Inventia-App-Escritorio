
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Info, ArrowUp, ArrowUpRight, Receipt,
  AlertTriangle, CalendarX, Clock, Candy,
  Package, Bell, ShoppingCart,
} from 'lucide-react'

import { getUsuarioActual } from '../services/auth'

import '../styles/dashboard.css'

/* ============================================================
   ESTADO INICIAL — Todo vacío hasta que conectes el backend
   ============================================================ */

// Se llenará con los datos reales del usuario logueado
const USUARIO = null
const RESULTADOS = null
const GANANCIA_DIARIA = []
const MAS_VENDIDOS = []
const MENOS_VENDIDOS = []
const MOVIMIENTOS = []
const AVISOS = []

const PERIODOS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
]

const TIPOS_MOVIMIENTO = {
  venta: 'Venta',
  compra: 'Compra',
  merma: 'Merma',
  correccion: 'Corrección',
}

const ICONOS_AVISO = {
  stock: AlertTriangle,
  urgente: CalendarX,
  caducidad: Clock,
}

const moneda = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN'
})

const monedaCorta = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
})

const numero = new Intl.NumberFormat('es-MX')


/* ============================================================ */

export default function Dashboard() {
  const navigate = useNavigate()

  const [periodo, setPeriodo] = useState('mes')
  const [vistaTop, setVistaTop] = useState('mas')

  // Usuario actualmente autenticado
  const [usuarioActual, setUsuarioActual] = useState(null)
  const [cargandoUsuario, setCargandoUsuario] = useState(true)

  /* ============================================================
     OBTENER USUARIO ACTUAL
     ============================================================ */

  useEffect(() => {
    getUsuarioActual()
      .then((usuario) => {
        setUsuarioActual(usuario)
      })
      .catch(() => {
        setUsuarioActual(null)
      })
      .finally(() => {
        setCargandoUsuario(false)
      })
  }, [])

  /*
     Solo el propietario puede ver:
     - Ventas del periodo
     - Ganancia estimada
     - Ganancia por día
  */
  const esPropietario = usuarioActual?.rol === 'propietario'

  const nombreUsuario = USUARIO?.nombre ?? 'de nuevo'
  const nombreNegocio = USUARIO?.negocio ?? 'tu negocio'

  const resumen = RESULTADOS
  const topLista = vistaTop === 'mas' ? MAS_VENDIDOS : MENOS_VENDIDOS
  const sinTopProductos = topLista.length === 0
  const sinMovimientos = MOVIMIENTOS.length === 0
  const sinAvisos = AVISOS.length === 0
  const sinGanancia = GANANCIA_DIARIA.length === 0

  const maxGanancia = sinGanancia
    ? 0
    : Math.max(...GANANCIA_DIARIA.map((d) => d.valor))

  const maxTop = sinTopProductos
    ? 0
    : Math.max(...topLista.map((p) => p.piezas))

  const escalaMax = sinGanancia
    ? 1000
    : Math.ceil(maxGanancia / 500) * 500

  const marcasEje = sinGanancia
    ? [1000, 500, 0]
    : [escalaMax, escalaMax / 2, 0]


  /* ============================================================
     CARGANDO USUARIO
     ============================================================ */

  if (cargandoUsuario) {
    return null
  }


  return (
    <div className="dash">

      {/* ============ ENCABEZADO ============ */}

      <header className="dash-encabezado">

        <div>
          <h1 className="dash-encabezado__titulo">
            Hola, {nombreUsuario}
          </h1>

          <p className="dash-encabezado__subtitulo">
            Así va {nombreNegocio} hoy
          </p>
        </div>

        <div
          className="dash-segmentado"
          role="tablist"
          aria-label="Periodo"
        >
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={periodo === p.id}
              className={
                'dash-segmentado__opcion' +
                (periodo === p.id ? ' is-activo' : '')
              }
              onClick={() => setPeriodo(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

      </header>


      {/* ============ KPIs ============ */}

      <section className="dash-kpis">

        {/* ======================================================
           SOLO PROPIETARIO:
           Ventas del periodo
           ====================================================== */}

        {esPropietario && (
          <article className="dash-kpi">

            <span className="dash-kpi__etiqueta">
              {periodo === 'hoy'
                ? 'Ventas de hoy'
                : periodo === 'semana'
                  ? 'Ventas de la semana'
                  : 'Ventas del mes'}
            </span>

            <p className="dash-kpi__valor">
              {resumen
                ? moneda.format(resumen.ventas)
                : '—'}
            </p>

            <p className="dash-kpi__nota">
              <Receipt size={14} aria-hidden="true" />

              {resumen
                ? `${numero.format(resumen.numVentas)} ventas registradas`
                : 'Sin ventas registradas'}
            </p>

          </article>
        )}


        {/* ======================================================
           SOLO PROPIETARIO:
           Ganancia estimada
           ====================================================== */}

        {esPropietario && (
          <article className="dash-kpi">

            <div className="dash-kpi__fila">

              <span className="dash-kpi__etiqueta">
                Ganancia estimada
              </span>

              <span
                className="dash-kpi__info"
                title="Ventas menos lo que te costó lo vendido"
              >
                <Info size={14} />
              </span>

            </div>

            <p
              className={
                'dash-kpi__valor' +
                (resumen
                  ? ' dash-kpi__valor--verde'
                  : '')
              }
            >
              {resumen
                ? moneda.format(resumen.ganancia)
                : '—'}
            </p>

            {resumen && resumen.cambio !== 0 ? (

              <span className="dash-pastilla dash-pastilla--verde">

                <ArrowUp
                  size={12}
                  strokeWidth={2.6}
                  aria-hidden="true"
                />

                {resumen.cambio}% {resumen.comparado}

              </span>

            ) : (

              <span className="dash-kpi__nota">
                Sin comparativa disponible
              </span>

            )}

          </article>
        )}


        {/* ======================================================
           Stock bajo
           ====================================================== */}

        <article className="dash-kpi">

          <span className="dash-kpi__etiqueta">
            Stock bajo
          </span>

          <p
            className={
              'dash-kpi__valor' +
              (0 > 0
                ? ' dash-kpi__valor--ambar'
                : '')
            }
          >
            0
          </p>

          <p className="dash-kpi__nota">

            <AlertTriangle
              size={14}
              className="dash-icono--ambar"
              aria-hidden="true"
            />

            productos por debajo del mínimo

          </p>

        </article>


        {/* ======================================================
           Por caducar
           ====================================================== */}

        <article className="dash-kpi">

          <span className="dash-kpi__etiqueta">
            Por caducar
          </span>

          <p className="dash-kpi__valor">
            0
          </p>

          <p className="dash-kpi__nota">

            <CalendarX
              size={14}
              className="dash-icono--rojo"
              aria-hidden="true"
            />

            en los próximos 30 días

          </p>

        </article>

      </section>


      {/* ============ GRÁFICA + TOP ============ */}

      <section className="dash-fila">

        {/* ======================================================
           SOLO PROPIETARIO:
           Ganancia por día
           ====================================================== */}

        {esPropietario && (
          <article className="dash-tarjeta">

            <div className="dash-tarjeta__cabecera">

              <div>

                <h2 className="dash-tarjeta__titulo">
                  Ganancia por día
                </h2>

                <p className="dash-tarjeta__subtitulo">
                  Últimos 7 días
                </p>

              </div>

              <span className="dash-leyenda">

                <span
                  className="dash-leyenda__punto"
                  aria-hidden="true"
                />

                Ganancia estimada

              </span>

            </div>


            {sinGanancia ? (

              <div className="dash-vacio">

                <div
                  className="dash-vacio__icono"
                  aria-hidden="true"
                >
                  <ShoppingCart
                    size={22}
                    strokeWidth={1.8}
                  />
                </div>

                <p className="dash-vacio__titulo">
                  Aún no hay ganancias registradas
                </p>

                <p className="dash-vacio__texto">
                  Cuando registres tus primeras ventas,
                  aparecerán aquí agrupadas por día.
                </p>

                <button
                  type="button"
                  className="dash-boton-chico"
                  onClick={() => navigate('/movimientos')}
                >
                  Registrar primera venta
                </button>

              </div>

            ) : (

              <div className="dash-chart">

                <div className="dash-chart__eje">

                  {marcasEje.map((v) => (
                    <span key={v}>
                      {monedaCorta.format(v)}
                    </span>
                  ))}

                </div>

                <div className="dash-chart__area">

                  <div className="dash-chart__rejilla">

                    {marcasEje.map((v) => (
                      <div
                        key={v}
                        className="dash-chart__linea"
                        style={{
                          bottom:
                            `${(v / escalaMax) * 100}%`
                        }}
                      />
                    ))}

                  </div>

                  <div className="dash-chart__barras">

                    {GANANCIA_DIARIA.map((d) => {

                      const esMax =
                        d.valor === maxGanancia

                      const clases =
                        'dash-chart__barra' +
                        (esMax ? ' is-max' : '') +
                        (d.hoy ? ' is-hoy' : '')

                      return (
                        <div
                          className="dash-chart__columna"
                          key={d.dia}
                        >

                          <div className="dash-chart__pista">

                            <div
                              className={clases}
                              style={{
                                height:
                                  `${(d.valor / escalaMax) * 100}%`
                              }}
                              title={`${d.dia}: ${moneda.format(d.valor)}`}
                            >

                              {esMax && (
                                <span className="dash-chart__valor">
                                  {monedaCorta.format(d.valor)}
                                </span>
                              )}

                            </div>

                          </div>

                          <span
                            className={
                              'dash-chart__dia' +
                              (esMax ? ' is-max' : '')
                            }
                          >
                            {d.dia}
                          </span>

                        </div>
                      )
                    })}

                  </div>

                </div>

              </div>

            )}

          </article>
        )}


        {/* ======================================================
           TOP PRODUCTOS
           ====================================================== */}

        <article className="dash-tarjeta">

          <div className="dash-tarjeta__cabecera">

            <h2 className="dash-tarjeta__titulo">
              Top productos
            </h2>

            <div
              className="dash-segmentado dash-segmentado--chico"
              role="tablist"
            >

              <button
                type="button"
                role="tab"
                aria-selected={vistaTop === 'mas'}
                className={
                  'dash-segmentado__opcion' +
                  (vistaTop === 'mas'
                    ? ' is-activo'
                    : '')
                }
                onClick={() => setVistaTop('mas')}
              >
                Más vendidos
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={vistaTop === 'menos'}
                className={
                  'dash-segmentado__opcion' +
                  (vistaTop === 'menos'
                    ? ' is-activo'
                    : '')
                }
                onClick={() => setVistaTop('menos')}
              >
                Menos
              </button>

            </div>

          </div>


          {sinTopProductos ? (

            <div className="dash-vacio">

              <div
                className="dash-vacio__icono"
                aria-hidden="true"
              >
                <Package
                  size={22}
                  strokeWidth={1.8}
                />
              </div>

              <p className="dash-vacio__titulo">
                Sin productos registrados
              </p>

              <p className="dash-vacio__texto">
                Agrega productos a tu catálogo para ver
                cuáles se venden más.
              </p>

              <button
                type="button"
                className="dash-boton-chico"
                onClick={() => navigate('/catalogo')}
              >
                Ir al catálogo
              </button>

            </div>

          ) : (

            <ol className="dash-top">

              {topLista.map((p, i) => (

                <li
                  className="dash-top__item"
                  key={p.nombre}
                >

                  <span className="dash-top__posicion">
                    {i + 1}
                  </span>

                  <span
                    className="dash-placeholder"
                    aria-hidden="true"
                  >
                    <Candy size={15} />
                  </span>

                  <div className="dash-top__info">

                    <div className="dash-top__fila">

                      <span className="dash-top__nombre">
                        {p.nombre}
                      </span>

                      <span className="dash-top__piezas">
                        {p.piezas} pzas
                      </span>

                    </div>

                    <div className="dash-top__barra">

                      <div
                        className={
                          'dash-top__relleno' +
                          (vistaTop === 'menos'
                            ? ' is-bajo'
                            : '')
                        }
                        style={{
                          width:
                            `${(p.piezas / maxTop) * 100}%`
                        }}
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

        {/* ======================================================
           MOVIMIENTOS
           ====================================================== */}

        <article className="dash-tarjeta">

          <div className="dash-tarjeta__cabecera">

            <h2 className="dash-tarjeta__titulo">
              Últimos movimientos
            </h2>

            <button
              type="button"
              className="dash-enlace"
              onClick={() => navigate('/movimientos')}
            >
              Ver todos
              <ArrowUpRight
                size={14}
                aria-hidden="true"
              />
            </button>

          </div>


          {sinMovimientos ? (

            <div className="dash-vacio">

              <div
                className="dash-vacio__icono"
                aria-hidden="true"
              >
                <Receipt
                  size={22}
                  strokeWidth={1.8}
                />
              </div>

              <p className="dash-vacio__titulo">
                Sin movimientos todavía
              </p>

              <p className="dash-vacio__texto">
                Registra entradas, salidas o ajustes para
                ver el historial aquí.
              </p>

              <button
                type="button"
                className="dash-boton-chico"
                onClick={() => navigate('/movimientos')}
              >
                Registrar movimiento
              </button>

            </div>

          ) : (

            <div className="dash-tabla-contenedor">

              <table className="dash-tabla">

                <thead>

                  <tr>
                    <th>Producto</th>
                    <th>Tipo</th>
                    <th className="is-der">
                      Cantidad
                    </th>
                    <th>Usuario</th>
                    <th className="is-der">
                      Hace
                    </th>
                  </tr>

                </thead>

                <tbody>

                  {MOVIMIENTOS.map((m) => {

                    const claseCantidad =
                      m.tipo === 'correccion'
                        ? 'is-neutra'
                        : m.cantidad > 0
                          ? 'is-suma'
                          : 'is-resta'

                    return (

                      <tr key={m.id}>

                        <td>

                          <div className="dash-tabla__producto">

                            <span
                              className="dash-placeholder dash-placeholder--chico"
                              aria-hidden="true"
                            >
                              <Candy size={13} />
                            </span>

                            {m.producto}

                          </div>

                        </td>

                        <td>

                          <span
                            className={`dash-tipo dash-tipo--${m.tipo}`}
                          >
                            {TIPOS_MOVIMIENTO[m.tipo]}
                          </span>

                        </td>

                        <td
                          className={
                            'is-der dash-tabla__cantidad ' +
                            claseCantidad
                          }
                        >
                          {m.cantidad > 0
                            ? `+${m.cantidad}`
                            : m.cantidad}
                        </td>

                        <td>
                          {m.usuario}
                        </td>

                        <td className="is-der dash-tabla__tiempo">
                          {m.hace}
                        </td>

                      </tr>

                    )
                  })}

                </tbody>

              </table>

            </div>

          )}

        </article>


        {/* ======================================================
           AVISOS
           ====================================================== */}

        <article className="dash-tarjeta">

          <div className="dash-tarjeta__cabecera">

            <h2 className="dash-tarjeta__titulo">

              <span
                className="dash-punto-rojo"
                aria-hidden="true"
              />

              Requiere tu atención

            </h2>

          </div>


          {sinAvisos ? (

            <div className="dash-vacio">

              <div
                className="dash-vacio__icono"
                aria-hidden="true"
              >
                <Bell
                  size={22}
                  strokeWidth={1.8}
                />
              </div>

              <p className="dash-vacio__titulo">
                Todo en orden
              </p>

              <p className="dash-vacio__texto">
                Aquí verás los avisos de stock bajo y
                productos por caducar.
              </p>

            </div>

          ) : (

            <ul className="dash-avisos">

              {AVISOS.map((a) => {

                const Icono = ICONOS_AVISO[a.tipo]

                return (

                  <li
                    key={a.id}
                    className={
                      `dash-aviso dash-aviso--${a.tipo}`
                    }
                  >

                    <span
                      className="dash-aviso__icono"
                      aria-hidden="true"
                    >
                      <Icono
                        size={15}
                        strokeWidth={2.2}
                      />
                    </span>

                    <div className="dash-aviso__info">

                      <p className="dash-aviso__nombre">
                        {a.nombre}
                      </p>

                      <p className="dash-aviso__detalle">
                        {a.detalle}
                      </p>

                    </div>

                    <button
                      type="button"
                      className="dash-boton-chico"
                    >
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

