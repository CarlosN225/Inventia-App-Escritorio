import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Package, ArrowLeftRight,
  Bell, Settings, ChevronsLeft, ChevronsRight, X,
  ShoppingCart, Truck, PackageMinus, ClipboardCheck, History,
} from 'lucide-react'
import logoInventia from '../assets/logo-inventia-sf.png'

/* ============================================================
   NAVEGACIÓN
   ------------------------------------------------------------
   El badge de "Alertas" se calculará desde el backend cuando
   esté listo. Por ahora recibe la prop `alertasPendientes`.
   ============================================================ */
const links = [
  { to: '/panel',                  label: 'Panel principal',         icon: LayoutDashboard },
  { to: '/catalogo',               label: 'Catálogo',                icon: Package },
  { to: '/registrar-venta',        label: 'Registrar venta',         icon: ShoppingCart },
  { to: '/registrar-compra',       label: 'Registrar compra',        icon: Truck },
  { to: '/registrar-merma',        label: 'Registrar merma',         icon: PackageMinus },
  { to: '/correccion-inventario',  label: 'Corrección de inventario', icon: ClipboardCheck },
  { to: '/movimientos',            label: 'Historial',               icon: History },
  { to: '/alertas',                label: 'Alertas',                 icon: Bell, badgeKey: 'alertas' },
]

export default function Sidebar({ collapsed, onToggle, onClose, alertasPendientes = 0 }) {
  return (
    <aside className={'sidebar' + (collapsed ? ' is-collapsed' : '')}>
      <div className="sidebar__brand">
        <img
          src={logoInventia}
          alt="INVENTIA"
          className="sidebar__brand-logo"
        />
        {!collapsed && <span className="sidebar__brand-text">INVENTIA</span>}
      </div>

      <nav className="sidebar__nav" aria-label="Navegación principal">
        {links.map(({ to, label, icon: Icon, badgeKey }) => {
          const badge = badgeKey === 'alertas' ? alertasPendientes : 0

          return (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                'sidebar__link' + (isActive ? ' is-active' : '')
              }
            >
              <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
              {!collapsed && <span className="sidebar__link-label">{label}</span>}
              {!collapsed && badge > 0 && (
                <span className="sidebar__badge">{badge}</span>
              )}
              {collapsed && badge > 0 && <span className="sidebar__dot" />}
            </NavLink>
          )
        })}
      </nav>

      <div className="sidebar__footer">
        <NavLink
          to="/configuracion"
          title={collapsed ? 'Configuración' : undefined}
          className={({ isActive }) =>
            'sidebar__link' + (isActive ? ' is-active' : '')
          }
        >
          <Settings size={20} strokeWidth={1.9} aria-hidden="true" />
          {!collapsed && <span className="sidebar__link-label">Configuración</span>}
        </NavLink>

        <button
          type="button"
          className="sidebar__toggle"
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <ChevronsRight size={18} />
          ) : (
            <>
              <ChevronsLeft size={18} />
              <span className="sidebar__toggle-text">Contraer</span>
            </>
          )}
        </button>

        <button
          type="button"
          className="sidebar__toggle sidebar__mobile-toggle"
          onClick={onClose}
          aria-label="Cerrar menú"
          style={{ display: 'none' }}
        >
          <X size={18} />
        </button>
      </div>
    </aside>
  )
}