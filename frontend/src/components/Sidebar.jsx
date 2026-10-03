import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  PackageMinus,
  ClipboardCheck,
  History,
  Bell,
  ChevronsLeft,
  ChevronsRight,
  X,
} from 'lucide-react'

import logoInventia from '../assets/logo-inventia-sf.png'
import { getUsuarioActual } from '../services/auth'

// soloPropietario: el encargado no ve esa opción
const links = [
  { to: '/panel', label: 'Panel principal', icon: LayoutDashboard },
  { to: '/catalogo', label: 'Catálogo', icon: Package },
  { to: '/registrar-venta', label: 'Registrar venta', icon: ShoppingCart },
  { to: '/registrar-compra', label: 'Registrar compra', icon: Truck },
  { to: '/registrar-merma', label: 'Registrar merma', icon: PackageMinus },
  { to: '/correccion-inventario', label: 'Corrección de inventario', icon: ClipboardCheck, soloPropietario: true },
  { to: '/movimientos', label: 'Historial', icon: History },
  { to: '/alertas', label: 'Alertas', icon: Bell, badge: 3 },
]

export default function Sidebar({ collapsed, onToggle, onClose }) {
  const [rol, setRol] = useState(null)

  // Trae el rol del usuario para mostrar u ocultar opciones
  useEffect(() => {
    getUsuarioActual()
      .then((usuario) => setRol(usuario.rol))
      .catch(() => setRol(null))
  }, [])

  const visibles = links.filter((link) => !link.soloPropietario || rol === 'propietario')

  return (
    <aside className={'sidebar' + (collapsed ? ' is-collapsed' : '')}>
      <div className="sidebar__brand">
        <img src={logoInventia} alt="INVENTIA" className="sidebar__brand-logo" />
        {!collapsed && <span className="sidebar__brand-text">INVENTIA</span>}
      </div>

      <nav className="sidebar__nav" aria-label="Navegación principal">
        {visibles.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) => 'sidebar__link' + (isActive ? ' is-active' : '')}
          >
            <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
            {!collapsed && <span className="sidebar__link-label">{label}</span>}
            {!collapsed && badge > 0 && <span className="sidebar__badge">{badge}</span>}
            {collapsed && badge > 0 && <span className="sidebar__dot" />}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
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