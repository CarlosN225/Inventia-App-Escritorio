import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useConfiguracion from '../hooks/useConfiguracion'
import { nombreCorto } from '../services/configuracion'

import {
  Menu,
  User,
  LogOut,
  Settings,
  HelpCircle,
  Store,
  CalendarDays,
  Wifi,
  WifiOff,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'

import ConfirmDialog from './ConfirmDialog.jsx'
import { getUsuarioActual, logout } from '../services/auth'
import '../styles/topbar.css'
 

const formatoFecha = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

// "Ana Luisa Reyes Martínez" -> "AM"
function iniciales(nombre) {
  const partes = nombre.trim().split(/\s+/)
  if (!partes[0]) return '?'
  const primera = partes[0][0]
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primera + ultima).toUpperCase()
}

function capitalizar(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : ''
}

function horaActual() {
  return new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function Topbar({ onOpenSidebar }) {
   const configuracion = useConfiguracion()
  const nombreNegocio = nombreCorto(configuracion?.negocio.nombre) || '…'
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [usuario, setUsuario] = useState(null)
  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const [hoy, setHoy] = useState(() => new Date())
  const [sincronizando, setSincronizando] = useState(false)
  const [ultimaSync, setUltimaSync] = useState(() => horaActual())

  const ref = useRef(null)

   // Usuario real desde el backend (y otra vez si se edita en Mi perfil)
  useEffect(() => {
    function cargarUsuario() {
      getUsuarioActual()
        .then(setUsuario)
        .catch(() => setUsuario(null))
    }

    cargarUsuario()
    window.addEventListener('inventia:usuario-actualizado', cargarUsuario)

    return () => window.removeEventListener('inventia:usuario-actualizado', cargarUsuario)
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

  // Revisa la fecha cada minuto, para que cambie sola a medianoche
  useEffect(() => {
    const intervalo = setInterval(() => setHoy(new Date()), 60000)
    return () => clearInterval(intervalo)
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

  function sincronizar() {
    if (!enLinea || sincronizando) return
    // TODO: mandar al backend lo que se guardó sin conexión
    setSincronizando(true)
    setTimeout(() => {
      setSincronizando(false)
      setUltimaSync(horaActual())
    }, 1200)
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
        {/* ============ IZQUIERDA: negocio + fecha ============ */}
        <div className="topbar__left">
          <button
            type="button"
            className="sidebar__mobile-toggle"
            onClick={onOpenSidebar}
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>

          <span className="topbar__negocio">
            <span className="topbar__negocio-icono" aria-hidden="true">
              <Store size={17} />
            </span>
            <span className="topbar__negocio-texto">
              <span className="topbar__negocio-prefijo">Dulcería: </span>
              <strong>{nombreNegocio}</strong>
            </span>
          </span>

          <span className="topbar__separador" aria-hidden="true" />

          <span className="topbar__fecha">
            <CalendarDays size={15} aria-hidden="true" />
            {capitalizar(formatoFecha.format(hoy))}
          </span>
        </div>

        {/* ============ DERECHA: internet + sincronizar + perfil ============ */}
        <div className="topbar__right">
          <span
            className={'topbar__conexion ' + (enLinea ? 'is-en-linea' : 'is-sin-conexion')}
            role="status"
            title={enLinea ? 'Tienes internet' : 'Sin internet: todo se guarda en la compu y se sincroniza al volver'}
          >
            {enLinea ? <Wifi size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}
            {enLinea ? 'En línea' : 'Sin conexión · tus datos se guardan'}
          </span>

          <button
            type="button"
            className={'topbar__sync' + (sincronizando ? ' is-girando' : '')}
            onClick={sincronizar}
            disabled={!enLinea}
            title={enLinea ? `Sincronizar ahora · última vez: ${ultimaSync}` : 'Necesitas internet para sincronizar'}
            aria-label="Sincronizar"
          >
            <RefreshCw size={16} />
          </button>

          {/* Solo el monito de perfil */}
          <div className="topbar__user-wrap" ref={ref}>
            <button
              type="button"
              className={'topbar__perfil' + (open ? ' is-open' : '')}
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label={`Menú de ${nombre}`}
              title={nombre}
            >
              <span className="topbar__avatar">{avatar}</span>
            </button>

            {open && (
              <div className="user-menu" role="menu">
                <div className="user-menu__header">
                  <span className="topbar__avatar">{avatar}</span>
                  <div className="topbar__user-info">
                    <span className="topbar__user-name">{nombre}</span>
                    <span className="topbar__user-role">{correo}</span>
                    {rol && (
                      <span className={'topbar__rol ' + (esPropietario ? 'is-propietario' : 'is-encargado')}>
                        {esPropietario && <ShieldCheck size={11} aria-hidden="true" />}
                        {capitalizar(rol)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="user-menu__divider" />

                <button
                  type="button"
                  className="user-menu__item"
                  role="menuitem"
                  onClick={() => irA('/perfil')}
                >
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