import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Bell,
  // CAMBIO 1: aquí estaba "Settings,". Se borró porque ahora el icono lo pone AjustesMenu.
  ChevronsLeft,
  ChevronsRight,
  X,
  ShoppingCart,
  Truck,
  PackageMinus,
  ClipboardCheck,
  History,
} from 'lucide-react'
import logoInventia from '../assets/logo-inventia-sf.png'
import { getUsuarioActual } from '../services/auth'
// CAMBIO 2: import nuevo del menú de ajustes
import AjustesMenu from './AjustesMenu.jsx'

/* ============================================================
   NAVEGACIÓN
   ------------------------------------------------------------
   El badge de "Alertas" se calculará desde el backend cuando
   esté listo. Por ahora recibe la prop `alertasPendientes`.
   ============================================================ */
const links = [
  {
    to: '/panel',
    label: 'Panel principal',
    icon: LayoutDashboard,
  },
  {
    to: '/catalogo',
    label: 'Catálogo',
    icon: Package,
  },
  {
    to: '/registrar-venta',
    label: 'Registrar venta',
    icon: ShoppingCart,
  },
  {
    to: '/registrar-compra',
    label: 'Registrar compra',
    icon: Truck,
  },
  {
    to: '/registrar-merma',
    label: 'Registrar merma',
    icon: PackageMinus,
  },
  {
    to: '/correccion-inventario',
    label: 'Corrección de inventario',
    icon: ClipboardCheck,
    soloPropietario: true,
  },
  {
    to: '/movimientos',
    label: 'Historial',
    icon: History,
  },
  {
    to: '/alertas',
    label: 'Alertas',
    icon: Bell,
    badgeKey: 'alertas',
  },
]

export default function Sidebar({
  collapsed,
  onToggle,
  onClose,
  alertasPendientes = 0,
}) {
  const [rol, setRol] = useState(null)

  useEffect(() => {
    getUsuarioActual()
      .then((u) => {
        setRol(u.rol)
      })
      .catch(() => {
        setRol(null)
      })
  }, [])

  const visibles = links.filter(
    (l) =>
      !l.soloPropietario ||
      rol === 'propietario'
  )

  return (
    <aside
      className={
        'sidebar' +
        (collapsed ? ' is-collapsed' : '')
      }
    >
      <div className="sidebar__brand">
        <img
          src={logoInventia}
          alt="INVENTIA"
          className="sidebar__brand-logo"
        />

        {!collapsed && (
          <span className="sidebar__brand-text">
            INVENTIA
          </span>
        )}
      </div>

      <nav
        className="sidebar__nav"
        aria-label="Navegación principal"
      >
        {visibles.map(
          ({
            to,
            label,
            icon: Icon,
            badgeKey,
          }) => {
            const badge =
              badgeKey === 'alertas'
                ? alertasPendientes
                : 0

            return (
              <NavLink
                key={to}
                to={to}
                title={
                  collapsed
                    ? label
                    : undefined
                }
                className={({ isActive }) =>
                  'sidebar__link' +
                  (isActive
                    ? ' is-active'
                    : '')
                }
              >
                <Icon
                  size={20}
                  strokeWidth={1.9}
                  aria-hidden="true"
                />

                {!collapsed && (
                  <span className="sidebar__link-label">
                    {label}
                  </span>
                )}

                {!collapsed &&
                  badge > 0 && (
                    <span className="sidebar__badge">
                      {badge}
                    </span>
                  )}

                {collapsed &&
                  badge > 0 && (
                    <span className="sidebar__dot" />
                  )}
              </NavLink>
            )
          }
        )}
      </nav>

      <div className="sidebar__footer">
        {/* CAMBIO 3: aquí estaba el bloque completo de
            {rol === 'propietario' && (<NavLink to="/configuracion" ...>)}
            Ahora el icono de ajustes abre un menú con el tema (claro/oscuro).
            El propietario además ve ahí el enlace a Configuración. */}
        <AjustesMenu
          collapsed={collapsed}
          esPropietario={rol === 'propietario'}
        />

        <button
          type="button"
          className="sidebar__toggle"
          onClick={onToggle}
          aria-label={
            collapsed
              ? 'Expandir menú'
              : 'Contraer menú'
          }
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <ChevronsRight size={18} />
          ) : (
            <>
              <ChevronsLeft size={18} />

              <span className="sidebar__toggle-text">
                Contraer
              </span>
            </>
          )}
        </button>

        <button
          type="button"
          className="sidebar__toggle sidebar__mobile-toggle"
          onClick={onClose}
          aria-label="Cerrar menú"
          style={{
            display: 'none',
          }}
        >
          <X size={18} />
        </button>
      </div>
    </aside>
  )
}