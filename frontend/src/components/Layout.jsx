import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'

const STORAGE_KEY = 'inventia.sidebar.collapsed'

export default function Layout() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === '1'
  )
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

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
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
        onClose={() => setMobileOpen(false)}
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