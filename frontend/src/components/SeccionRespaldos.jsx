import { useEffect, useRef, useState } from 'react'
import {
  DatabaseBackup,
  Send,
  Usb,
  FolderOpen,
  Cloud,
  ArchiveRestore,
  Upload,
  CheckCircle2,
  AlertCircle,
  Info,
  Loader2,
  Eye,
  EyeOff,
  X,
} from 'lucide-react'

import {
  estadoRespaldos,
  cambiarCarpeta,
  respaldarAhora,
  respaldarPorCorreo,
  restaurarRespaldo,
  mensajeRespaldo,
} from '../services/respaldos'
import { notificar } from '../services/notificar'
import '../styles/respaldos.css'

const fechaHora = new Intl.DateTimeFormat('es-MX', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function cuando(iso) {
  if (!iso) return null
  return fechaHora.format(new Date(iso))
}

function haceCuanto(iso) {
  if (!iso) return null
  const horas = (Date.now() - new Date(iso).getTime()) / 36e5
  if (horas < 1) return 'hace un momento'
  if (horas < 24) return `hace ${Math.floor(horas)} h`
  const dias = Math.floor(horas / 24)
  return dias === 1 ? 'ayer' : `hace ${dias} días`
}

export default function SeccionRespaldos() {
  const [estado, setEstado] = useState(null)
  const [error, setError] = useState('')
  const [carpeta, setCarpeta] = useState('')
  const [trabajando, setTrabajando] = useState(null) // 'manual' | 'correo' | 'usb' | 'carpeta'
  const [restaurar, setRestaurar] = useState(null) // { nombre?, archivo?, texto }
  const archivoRef = useRef(null)

  async function cargar() {
    try {
      const datos = await estadoRespaldos()
      setEstado(datos)
      setCarpeta(datos.carpeta)
      setError('')
    } catch (e) {
      setError(mensajeRespaldo(e, 'No se pudo cargar la información de respaldos.'))
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  async function hacer(tipo, accion, textoOk) {
    setTrabajando(tipo)
    try {
      const r = await accion()
      notificar({ texto: textoOk(r) })
      await cargar()
    } catch (e) {
      notificar({ texto: mensajeRespaldo(e), tipo: 'error' })
    } finally {
      setTrabajando(null)
    }
  }

  async function guardarCarpeta(ruta = carpeta) {
    setTrabajando('carpeta')
    try {
      const r = await cambiarCarpeta(ruta)
      notificar({ texto: `Los respaldos se guardarán en ${r.carpeta}` })
      await cargar()
    } catch (e) {
      notificar({ texto: mensajeRespaldo(e), tipo: 'error' })
    } finally {
      setTrabajando(null)
    }
  }

  if (error) {
    return (
      <section className="cf-panel cf-seccion">
        <p className="rs-error">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </p>
      </section>
    )
  }

  if (!estado) return null

  const usb = estado.usb[0]
  const ultimo = estado.respaldos[0]
  const cambioCarpeta = carpeta.trim() !== estado.carpeta

  return (
    <section className="cf-panel cf-seccion rs">
      <header className="cf-seccion__cabecera">
        <div>
          <h2 className="cf-seccion__titulo">Respaldos</h2>
          <p className="cf-seccion__sub">Copias de tu información por si la computadora falla, se pierde o la cambias.</p>
        </div>

        <span className={'rs-estado ' + (ultimo ? 'is-ok' : 'is-falta')}>
          {ultimo ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />}
          {ultimo ? `Último: ${haceCuanto(ultimo.fecha)}` : 'Aún sin respaldos'}
        </span>
      </header>

      {/* Respaldar ahora */}
      <div className="rs-acciones">
        <button
          type="button"
          className="cf-boton cf-boton--primario"
          disabled={!!trabajando}
          onClick={() => hacer('manual', () => respaldarAhora(), () => 'Respaldo guardado en tu carpeta de respaldos')}
        >
          {trabajando === 'manual' ? <Loader2 size={15} className="cf-girando" /> : <DatabaseBackup size={15} />}
          Respaldar ahora
        </button>

        <button
          type="button"
          className="cf-boton"
          disabled={!!trabajando}
          onClick={() => hacer('correo', respaldarPorCorreo, (r) => `Respaldo enviado a ${r.correo}`)}
        >
          {trabajando === 'correo' ? <Loader2 size={15} className="cf-girando" /> : <Send size={15} />}
          Enviar a mi correo
        </button>

        <button
          type="button"
          className="cf-boton"
          disabled={!!trabajando || !usb}
          title={usb ? `Guardar en la USB ${usb}` : 'Conecta una USB para usar esta opción'}
          onClick={() => hacer('usb', () => respaldarAhora('usb', usb), () => `Respaldo guardado en la USB ${usb}`)}
        >
          {trabajando === 'usb' ? <Loader2 size={15} className="cf-girando" /> : <Usb size={15} />}
          {usb ? `Respaldar en USB (${usb})` : 'USB no conectada'}
        </button>
      </div>

      <p className="cf-info rs-info">
        <Info size={16} aria-hidden="true" />
        <span>
          <strong>Automático:</strong> uno diario al abrir Inventia (se guardan los últimos {estado.conservar}).{' '}
          <strong>Por correo:</strong> cada viernes en la noche
          {estado.correo_destino ? ` a ${estado.correo_destino}` : ''}, si hay internet
          {estado.ultimo_correo ? ` · último envío ${cuando(estado.ultimo_correo)}` : ''}.
        </span>
      </p>

      {/* Carpeta */}
      <div className="cf-campo">
        <label className="cf-etiqueta" htmlFor="rs-carpeta">
          Carpeta de respaldos
        </label>
        <div className="rs-carpeta">
          <div className="rs-carpeta__input">
            <FolderOpen size={15} aria-hidden="true" />
            <input
              id="rs-carpeta"
              className="cf-input"
              value={carpeta}
              onChange={(e) => setCarpeta(e.target.value)}
              spellCheck={false}
            />
          </div>
          {cambioCarpeta && (
            <button type="button" className="cf-boton" disabled={!!trabajando} onClick={() => guardarCarpeta()}>
              Guardar
            </button>
          )}
        </div>
        <div className="rs-sugeridas">
          <span>Sugeridas:</span>
          {estado.sugeridas.map((s) => (
            <button
              key={s.ruta}
              type="button"
              className={'rs-chip' + (s.ruta === estado.carpeta ? ' is-activo' : '')}
              disabled={!!trabajando}
              onClick={() => guardarCarpeta(s.ruta)}
              title={s.ruta}
            >
              {s.nube ? <Cloud size={13} aria-hidden="true" /> : <FolderOpen size={13} aria-hidden="true" />}
              {s.nombre}
              {s.nube && <em>se sube a la nube</em>}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="rs-lista">
        <div className="rs-lista__cabecera">
          <span>Respaldos guardados ({estado.respaldos.length})</span>
          <button type="button" className="rs-enlace" onClick={() => archivoRef.current?.click()}>
            <Upload size={14} aria-hidden="true" />
            Restaurar desde un archivo
          </button>
          <input
            ref={archivoRef}
            type="file"
            accept=".zip"
            hidden
            onChange={(e) => {
              const archivo = e.target.files?.[0]
              e.target.value = ''
              if (archivo) setRestaurar({ archivo, texto: archivo.name })
            }}
          />
        </div>

        {estado.respaldos.length === 0 ? (
          <p className="rs-vacio">Todavía no hay respaldos en esta carpeta. Usa "Respaldar ahora".</p>
        ) : (
          <ul>
            {estado.respaldos.map((r) => (
              <li key={r.archivo}>
                <span className="rs-lista__fecha">{cuando(r.fecha)}</span>
                <span className={`rs-tipo rs-tipo--${r.tipo}`}>{r.tipo_texto}</span>
                <span className="rs-lista__tam">{r.tamano_kb} KB</span>
                <button
                  type="button"
                  className="rs-enlace"
                  onClick={() => setRestaurar({ nombre: r.archivo, texto: `el respaldo del ${cuando(r.fecha)}` })}
                >
                  <ArchiveRestore size={14} aria-hidden="true" />
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {restaurar && <DialogoRestaurar datos={restaurar} onCerrar={() => setRestaurar(null)} />}
    </section>
  )
}

function DialogoRestaurar({ datos, onCerrar }) {
  const [contrasena, setContrasena] = useState('')
  const [ver, setVer] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    if (!contrasena) {
      setError('Escribe tu contraseña')
      return
    }
    setEnviando(true)
    setError('')
    try {
      await restaurarRespaldo({ nombre: datos.nombre, archivo: datos.archivo, contrasena })
      notificar({ texto: 'Respaldo restaurado. Vuelve a iniciar sesión.' })
      setTimeout(() => window.location.assign('/'), 900)
    } catch (e) {
      setError(mensajeRespaldo(e))
      setEnviando(false)
    }
  }

  return (
    <div className="rs-fondo" role="dialog" aria-modal="true" aria-labelledby="rs-dialogo-titulo">
      <div className="rs-dialogo">
        <header>
          <span className="rs-dialogo__icono" aria-hidden="true">
            <ArchiveRestore size={18} />
          </span>
          <h3 id="rs-dialogo-titulo">Restaurar respaldo</h3>
          <button type="button" className="rs-cerrar" onClick={onCerrar} aria-label="Cerrar" disabled={enviando}>
            <X size={16} />
          </button>
        </header>

        <p>
          Toda la información actual se reemplazará por <strong>{datos.texto}</strong>. Antes guardamos una copia
          de lo actual por si te equivocas. Al terminar, vuelve a iniciar sesión.
        </p>

        <label className="cf-etiqueta" htmlFor="rs-contrasena">
          Confirma tu contraseña
        </label>
        <div className="rs-pass">
          <input
            id="rs-contrasena"
            className="cf-input"
            type={ver ? 'text' : 'password'}
            autoFocus
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmar()}
          />
          <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar' : 'Mostrar'}>
            {ver ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {error && (
          <p className="rs-error">
            <AlertCircle size={14} aria-hidden="true" />
            {error}
          </p>
        )}

        <footer>
          <button type="button" className="cf-boton" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </button>
          <button type="button" className="cf-boton cf-boton--primario" onClick={confirmar} disabled={enviando}>
            {enviando ? <Loader2 size={15} className="cf-girando" /> : <ArchiveRestore size={15} />}
            {enviando ? 'Restaurando…' : 'Restaurar'}
          </button>
        </footer>
      </div>
    </div>
  )
}
