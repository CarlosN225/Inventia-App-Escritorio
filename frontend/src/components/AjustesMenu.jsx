import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { Settings, Sun, Moon, Monitor, SlidersHorizontal } from 'lucide-react'
import { getTemaGuardado, guardarTema } from '../services/tema'
import '../styles/ajustes-menu.css'

const OPCIONES = [
  { id: 'claro', label: 'Claro', icon: Sun },
  { id: 'oscuro', label: 'Oscuro', icon: Moon },
  { id: 'sistema', label: 'Automático', icon: Monitor },
]

export default function AjustesMenu({ collapsed, esPropietario }) {
  const [abierto, setAbierto] = useState(false)
  const [tema, setTema] = useState(getTemaGuardado)
  const [pos, setPos] = useState({ left: 0, bottom: 0 })

  const botonRef = useRef(null)
  const menuRef = useRef(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Cierra con clic fuera o con Esc
  useEffect(() => {
    if (!abierto) return

    function alClicFuera(event) {
      if (botonRef.current?.contains(event.target)) return
      if (menuRef.current?.contains(event.target)) return
      setAbierto(false)
    }
    function alPresionarEsc(event) {
      if (event.key === 'Escape') setAbierto(false)
    }

    document.addEventListener('mousedown', alClicFuera)
    document.addEventListener('keydown', alPresionarEsc)
    return () => {
      document.removeEventListener('mousedown', alClicFuera)
      document.removeEventListener('keydown', alPresionarEsc)
    }
  }, [abierto])

  // Cierra al cambiar de pantalla
  useEffect(() => {
    setAbierto(false)
  }, [pathname])

  function alternar() {
    if (!abierto && botonRef.current) {
      // El menú aparece a la derecha del botón, alineado por abajo
      const caja = botonRef.current.getBoundingClientRect()
      setPos({ left: caja.right + 12, bottom: window.innerHeight - caja.bottom })
    }
    setAbierto((v) => !v)
  }

  function elegir(id) {
    setTema(id)
    guardarTema(id)
  }

  function irAConfiguracion() {
    setAbierto(false)
    navigate('/configuracion')
  }

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        className={'sidebar__link ajustes__boton' + (abierto ? ' is-active' : '')}
        onClick={alternar}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        title={collapsed ? 'Ajustes' : undefined}
      >
        <Settings size={20} strokeWidth={1.9} aria-hidden="true" />
        {!collapsed && <span className="sidebar__link-label">Ajustes</span>}
      </button>

      {abierto &&
        createPortal(
          <div
            ref={menuRef}
            className="ajustes__menu"
            role="dialog"
            aria-label="Ajustes"
            style={{ left: pos.left, bottom: pos.bottom }}
          >
            <p className="ajustes__titulo">Tema</p>

            <div className="ajustes__opciones" role="radiogroup" aria-label="Tema de la aplicación">
              {OPCIONES.map(({ id, label, icon: Icono }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={tema === id}
                  className={'ajustes__opcion' + (tema === id ? ' is-activa' : '')}
                  onClick={() => elegir(id)}
                >
                  <Icono size={18} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>

            {esPropietario && (
              <>
                <div className="ajustes__divisor" />
                <button type="button" className="ajustes__enlace" onClick={irAConfiguracion}>
                  <SlidersHorizontal size={16} aria-hidden="true" />
                  Configuración del negocio
                </button>
              </>
            )}
          </div>,
          document.body
        )}
    </>
  )
}