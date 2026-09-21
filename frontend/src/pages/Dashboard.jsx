import { Link } from 'react-router-dom'
import {
  AlertTriangle, MessageCircle, Plus, Eye,
  PackagePlus, PackageMinus,
} from 'lucide-react'
import Card from '../components/Card.jsx'
import LinkButton from '../components/LinkButton.jsx'
import PageHeader from '../components/PageHeader.jsx'
import StockBar from '../components/StockBar.jsx'
import Tag from '../components/Tag.jsx'

const movimientosRecientes = [
  { id: 1, producto: 'Paleta payaso',   tipo: 'Salida',  cantidad: 5,  tiempo: 'Hace 3 h' },
  { id: 2, producto: 'Chocolate turín', tipo: 'Entrada', cantidad: 30, tiempo: 'Hace 4 h' },
  { id: 3, producto: 'Piñata estrella', tipo: 'Salida',  cantidad: 2,  tiempo: 'Hace 5 h' },
]

const stockBajo = [
  { id: 1, producto: 'Piñata estrella', stock: 1, minimo: 3 },
  { id: 2, producto: 'Paleta payaso',   stock: 3, minimo: 10 },
  { id: 3, producto: 'Chocolate turín', stock: 5, minimo: 15 },
]

/* Solo 3 stats — quitamos "Estado del sistema" porque ya está en el topbar */
const stats = [
  { key: 'productos', label: 'Productos',          value: '128',             tone: 'neutral' },
  { key: 'stockBajo', label: 'Stock bajo',         value: stockBajo.length,  tone: 'warning' },
  { key: 'alertas',   label: 'Alertas pendientes', value: '2',               tone: 'accent'  },
]

export default function Dashboard() {
  return (
    <>
      <PageHeader
        title="Panel principal"
        subtitle="Resumen del estado actual de tu inventario"
      />

      {/* ============ STATS (3 tarjetas) ============ */}
      <div className="stats stats--three">
        {stats.map(({ key, label, value, tone }) => (
          <div className={'stat stat--' + tone} key={key}>
            <div className="stat__label">{label}</div>
            <div className="stat__value">{value}</div>
          </div>
        ))}
      </div>

      {/* ============ MOVIMIENTOS RECIENTES ============ */}
      <Card>
        <div className="card__header-row">
          <h2 className="card__title">Últimos movimientos</h2>
          <LinkButton to="/movimientos" variant="ghost" size="sm">
            Ver todos ↗
          </LinkButton>
        </div>

        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Tipo</th>
              <th className="num">Cantidad</th>
              <th>Tiempo</th>
            </tr>
          </thead>
          <tbody>
            {movimientosRecientes.map((m) => (
              <tr key={m.id}>
                <td>
                  <span className="cell-with-icon">
                    <span
                      className={
                        'cell-icon ' +
                        (m.tipo === 'Entrada' ? 'is-in' : 'is-out')
                      }
                      aria-hidden="true"
                    >
                      {m.tipo === 'Entrada'
                        ? <PackagePlus size={15} strokeWidth={2.2} />
                        : <PackageMinus size={15} strokeWidth={2.2} />}
                    </span>
                    {m.producto}
                  </span>
                </td>
                <td>
                  <Tag tone={m.tipo === 'Entrada' ? 'success' : 'wine'}>
                    {m.tipo}
                  </Tag>
                </td>
                <td className="num">{m.cantidad}</td>
                <td className="muted">{m.tiempo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* ============ STOCK BAJO ============ */}
      <Card>
        <div className="card__header-row">
          <h2 className="card__title">
            <AlertTriangle size={18} strokeWidth={2.2} aria-hidden="true" />
            Productos con stock bajo
          </h2>
          <Tag tone="warning">{stockBajo.length} alertas</Tag>
        </div>

        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Existencia</th>
              <th className="num">Actual / Mínimo</th>
              <th style={{ width: 200 }}></th>
            </tr>
          </thead>
          <tbody>
            {stockBajo.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.producto}</td>
                <td style={{ minWidth: 180 }}>
                  <StockBar stock={p.stock} minimo={p.minimo} />
                </td>
                <td className="num">
                  {p.stock} <span className="muted">/ {p.minimo}</span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button type="button" className="btn btn--outline btn--sm">
                    <MessageCircle size={15} strokeWidth={2.2} />
                    Notificar WhatsApp
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* ============ ACCIONES PRINCIPALES ============ */}
      <div className="page-actions">
        <LinkButton to="/movimientos" variant="primary" size="lg">
          <Plus size={18} strokeWidth={2.4} />
          Registrar movimiento
        </LinkButton>
        <LinkButton to="/catalogo" variant="outline" size="lg">
          <Eye size={18} strokeWidth={2.2} />
          Ver catálogo
        </LinkButton>
      </div>
    </>
  )
}