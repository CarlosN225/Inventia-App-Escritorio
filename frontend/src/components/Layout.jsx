import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
 

const STORAGE_KEY = 'inventia.sidebar.collapsed'

export default function Layout() {
  const location = useLocation()
  // Siempre arranca expandido; "Contraer" solo dura mientras se usa la app
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

    // Limpia lo que se haya guardado con la versión anterior (menú contraído "para siempre")
  useEffect(() => {
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  return (
    <div
      className={
        'app-shell' +
        (collapsed ? ' is-collapsed' : '') +
        (mobileOpen ? ' is-mobile-open' : '')
      }
    >
   {/* Cuando el backend esté listo, alertasPendientes vendrá de un hook o contexto */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
        onClose={() => setMobileOpen(false)}
        alertasPendientes={0}
      />
      <div
        className="sidebar__backdrop"
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      <div className="app-main">
        <Topbar onOpenSidebar={() => setMobileOpen(true)} />
        <main className="page" key={location.pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}