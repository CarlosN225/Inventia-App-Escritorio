import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, ChevronDown, User, LogOut, Settings, HelpCircle } from 'lucide-react'

import StatusDot from './StatusDot.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import { getUsuarioActual, logout } from '../services/auth'

const titles = {
  '/panel': 'Panel principal',
  '/catalogo': 'Catálogo',
  '/catalogo/nuevo': 'Nuevo producto',
  '/registrar-venta': 'Registrar venta',
  '/registrar-compra': 'Registrar compra',
  '/registrar-merma': 'Registrar merma',
  '/correccion-inventario': 'Corrección de inventario',
  '/movimientos': 'Historial',
  '/alertas': 'Alertas',
  '/configuracion': 'Configuración',
  '/ayuda': 'Ayuda',
}

// "Ana Luisa Reyes Martínez" -> "AM" (primera letra del primer y del último nombre)
function iniciales(nombre) {
  const partes = nombre.trim().split(/\s+/)
  if (partes.length === 0 || !partes[0]) return '?'
  const primera = partes[0][0]
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primera + ultima).toUpperCase()
}

function capitalizar(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : ''
}

export default function Topbar({ onOpenSidebar }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [usuario, setUsuario] = useState(null)
  const [enLinea, setEnLinea] = useState(navigator.onLine)

  const ref = useRef(null)

  const title =
    titles[pathname] ??
    (pathname.endsWith('/editar') ? 'Editar producto' : 'INVENTIA')

  // Usuario real desde el backend
  useEffect(() => {
    getUsuarioActual()
      .then(setUsuario)
      .catch(() => setUsuario(null))
  }, [])

  // Detecta si hay o no internet
  useEffect(() => {
    const conectado = () => setEnLinea(true)
    const desconectado = () => setEnLinea(false)

    window.addEventListener('online', conectado)
    window.addEventListener('offline', desconectado)

    return () => {
      window.removeEventListener('online', conectado)
      window.removeEventListener('offline', desconectado)
    }
  }, [])

  // Cierra el menú al dar clic fuera o presionar Esc
  useEffect(() => {
    function alClicFuera(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }

    function alPresionarEsc(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', alClicFuera)
    document.addEventListener('keydown', alPresionarEsc)

    return () => {
      document.removeEventListener('mousedown', alClicFuera)
      document.removeEventListener('keydown', alPresionarEsc)
    }
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  function irA(ruta) {
    setOpen(false)
    navigate(ruta)
  }

  function requestLogout() {
    setOpen(false)
    setConfirmOpen(true)
  }

  async function confirmLogout() {
    setConfirmOpen(false)

    try {
      await logout()
    } catch {
      // Aunque falle (ej. backend apagado), igual lo mandamos al login
    }

    navigate('/', { replace: true })
  }

  const nombre = usuario?.nombre_completo ?? 'Cargando…'
  const correo = usuario?.correo ?? ''
  const rol = usuario?.rol ?? ''
  const esPropietario = rol === 'propietario'
  const avatar = usuario ? iniciales(usuario.nombre_completo) : ''

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
          <h1 className="topbar__title">{title}</h1>
        </div>

        <div className="topbar__right">
          <StatusDot online={enLinea} />

          <div className="topbar__user-wrap" ref={ref}>
            <button
              type="button"
              className={'topbar__user' + (open ? ' is-open' : '')}
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <span className="topbar__avatar">{avatar}</span>
              <div className="topbar__user-info">
                <span className="topbar__user-name">{nombre}</span>
                <span className="topbar__user-role">{capitalizar(rol)}</span>
              </div>
              <ChevronDown size={16} className="topbar__chevron" aria-hidden="true" />
            </button>

            {open && (
              <div className="user-menu" role="menu">
                <div className="user-menu__header">
                  <span className="topbar__avatar">{avatar}</span>
                  <div className="topbar__user-info">
                    <span className="topbar__user-name">{nombre}</span>
                    <span className="topbar__user-role">{correo}</span>
                  </div>
                </div>

                <div className="user-menu__divider" />

                {/* TODO: pantalla de Mi perfil */}
                <button type="button" className="user-menu__item" role="menuitem">
                  <User size={16} />
                  Mi perfil
                </button>

                {esPropietario && (
                  <button
                    type="button"
                    className="user-menu__item"
                    role="menuitem"
                    onClick={() => irA('/configuracion')}
                  >
                    <Settings size={16} />
                    Configuración
                  </button>
                )}

                <button
                  type="button"
                  className="user-menu__item"
                  role="menuitem"
                  onClick={() => irA('/ayuda')}
                >
                  <HelpCircle size={16} />
                  Ayuda
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