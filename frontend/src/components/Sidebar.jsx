import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Package, ArrowLeftRight,
  Bell, Settings, ChevronsLeft, ChevronsRight, X,
} from 'lucide-react'
import logoInventia from '../assets/logo-inventia-sf.png'

const links = [
  { to: '/panel',       label: 'Panel principal', icon: LayoutDashboard },
  { to: '/catalogo',    label: 'Catálogo',        icon: Package },
  { to: '/movimientos', label: 'Movimientos',     icon: ArrowLeftRight },
  { to: '/alertas',     label: 'Alertas',         icon: Bell, badge: 2 },
]

export default function Sidebar({ collapsed, onToggle, onClose }) {
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
        {links.map(({ to, label, icon: Icon, badge }) => (
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
        ))}
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