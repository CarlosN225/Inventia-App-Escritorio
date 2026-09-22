import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, ChevronDown, User, LogOut, Settings } from 'lucide-react'
import StatusDot from './StatusDot.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import { getUsuarioActual, logout as logoutApi } from '../services/auth.js'

const titles = {
  '/panel': 'Panel principal',
  '/catalogo': 'Catálogo',
  '/movimientos': 'Movimientos',
  '/alertas': 'Alertas',
  '/configuracion': 'Configuración',
}

export default function Topbar({ onOpenSidebar }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [usuario, setUsuario] = useState(null)

  const ref = useRef(null)

  const title =
    titles[pathname] ??
    (pathname.startsWith('/catalogo') ? 'Catálogo' : 'INVENTIA')

  // Obtener los datos del usuario actual
  useEffect(() => {
    getUsuarioActual()
      .then(setUsuario)
      .catch((err) => {
        console.error('Error al obtener usuario actual:', err)
        setUsuario(null)
      })
  }, [])

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Cerrar menú cuando cambia la página
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  function requestLogout() {
    setOpen(false)
    setConfirmOpen(true)
  }

  async function confirmLogout() {
    setConfirmOpen(false)

    try {
      await logoutApi()
    } catch (err) {
      console.error('Error al cerrar sesión:', err)
    }

    navigate('/')
  }

  // Crear iniciales para el avatar
  function obtenerIniciales() {
    if (!usuario) {
      return '...'
    }

    const nombre =
      usuario.nombre_completo ||
      usuario.nombre ||
      usuario.username ||
      ''

    const partes = nombre.trim().split(' ').filter(Boolean)

    if (partes.length === 0) {
      return 'U'
    }

    if (partes.length === 1) {
      return partes[0].substring(0, 2).toUpperCase()
    }

    return (
      partes[0].charAt(0) +
      partes[partes.length - 1].charAt(0)
    ).toUpperCase()
  }

  return (
    <>
      <header className="topbar">

        <div className="topbar__left">

          <button
            type="button"
            className="sidebar__mobile-toggle"
            onClick={onOpenSidebar}
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>

          <h1 className="topbar__title">
            {title}
          </h1>

        </div>

        <div className="topbar__right">

          <StatusDot online />

          <div
            className="topbar__user-wrap"
            ref={ref}
          >

            <button
              type="button"
              className={
                'topbar__user' +
                (open ? ' is-open' : '')
              }
              onClick={() => setOpen(v => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
            >

              <span className="topbar__avatar">
                {obtenerIniciales()}
              </span>

              <div className="topbar__user-info">

                <span className="topbar__user-name">
                  {usuario?.nombre_completo ??
                    usuario?.nombre ??
                    usuario?.username ??
                    'Cargando...'}
                </span>

                <span className="topbar__user-role">
                  {usuario?.rol ?? ''}
                </span>

              </div>

              <ChevronDown
                size={16}
                className="topbar__chevron"
                aria-hidden="true"
              />

            </button>

            {open && (

              <div
                className="user-menu"
                role="menu"
              >

                <div className="user-menu__header">

                  <span className="topbar__avatar">
                    {obtenerIniciales()}
                  </span>

                  <div className="topbar__user-info">

                    <span className="topbar__user-name">
                      {usuario?.nombre_completo ??
                        usuario?.nombre ??
                        usuario?.username ??
                        ''}
                    </span>

                    <span className="topbar__user-role">
                      {usuario?.correo ??
                        usuario?.email ??
                        ''}
                    </span>

                  </div>

                </div>

                <div className="user-menu__divider" />

                <button
                  type="button"
                  className="user-menu__item"
                  role="menuitem"
                >
                  <User size={16} />
                  Mi perfil
                </button>

                <button
                  type="button"
                  className="user-menu__item"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    navigate('/configuracion')
                  }}
                >
                  <Settings size={16} />
                  Configuración
                </button>

                <div className="user-menu__divider" />

                <button
                  type="button"
                  className="user-menu__item user-menu__item--danger"
                  role="menuitem"
                  onClick={requestLogout}
                >
                  <LogOut size={16} />
                  Cerrar sesión
                </button>

              </div>

            )}

          </div>

        </div>

      </header>

      <ConfirmDialog
        open={confirmOpen}
        title="¿Cerrar sesión?"
        message="Se cerrará tu sesión actual y volverás a la pantalla de inicio. ¿Deseas continuar?"
        confirmText="Sí, cerrar sesión"
        cancelText="Cancelar"
        tone="danger"
        onConfirm={confirmLogout}
        onCancel={() => setConfirmOpen(false)}
      />

    </>
  )
}