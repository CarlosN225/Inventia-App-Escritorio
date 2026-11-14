import { useRef, useState } from 'react'
import { ArchiveRestore, Upload, AlertCircle, Loader2, X, CheckCircle2 } from 'lucide-react'

import { restaurarRespaldo, mensajeRespaldo } from '../services/respaldos'
import '../styles/respaldos.css'

/* Instalación nueva: recuperar todo desde un respaldo (.zip) en vez de configurar desde cero */
export default function RestaurarInicial({ onCerrar, onListo }) {
  const [archivo, setArchivo] = useState(null)
  const [estado, setEstado] = useState('elegir') // elegir · subiendo · listo
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState(null)
  const archivoRef = useRef(null)

  async function restaurar() {
    if (!archivo) return
    setEstado('subiendo')
    setError('')
    try {
      const r = await restaurarRespaldo({ archivo })
      setResultado(r)
      setEstado('listo')
    } catch (e) {
      setError(mensajeRespaldo(e, 'No se pudo restaurar ese archivo.'))
      setEstado('elegir')
    }
  }

  return (
    <div className="rs-fondo" role="dialog" aria-modal="true" aria-labelledby="ri-titulo">
      <div className="rs-dialogo">
        <header>
          <span className="rs-dialogo__icono" aria-hidden="true">
            <ArchiveRestore size={18} />
          </span>
          <h3 id="ri-titulo">Restaurar un respaldo</h3>
          {estado !== 'subiendo' && estado !== 'listo' && (
            <button type="button" className="rs-cerrar" onClick={onCerrar} aria-label="Cerrar">
              <X size={16} />
            </button>
          )}
        </header>

        {estado === 'listo' ? (
          <>
            <p className="ri-listo">
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>
                ¡Listo! Se recuperó la información de <strong>{resultado?.negocio || 'tu dulcería'}</strong>. Entra con tu
                usuario y contraseña de siempre.
              </span>
            </p>
            <footer>
              <button type="button" className="cf-boton cf-boton--primario" onClick={onListo}>
                Ir a iniciar sesión
              </button>
            </footer>
          </>
        ) : (
          <>
            <p>
              Elige el archivo <strong>Inventia_respaldo_….zip</strong>: el que te llegó por correo, el de tu USB o el
              de tu carpeta de OneDrive o Google Drive.
            </p>

            <button type="button" className="ri-elegir" onClick={() => archivoRef.current?.click()}>
              <Upload size={16} aria-hidden="true" />
              {archivo ? archivo.name : 'Elegir archivo…'}
            </button>
            <input
              ref={archivoRef}
              type="file"
              accept=".zip"
              hidden
              onChange={(e) => {
                setArchivo(e.target.files?.[0] ?? null)
                setError('')
              }}
            />

            {error && (
              <p className="rs-error">
                <AlertCircle size={14} aria-hidden="true" />
                {error}
              </p>
            )}

            <footer>
              <button type="button" className="cf-boton" onClick={onCerrar} disabled={estado === 'subiendo'}>
                Cancelar
              </button>
              <button
                type="button"
                className="cf-boton cf-boton--primario"
                onClick={restaurar}
                disabled={!archivo || estado === 'subiendo'}
              >
                {estado === 'subiendo' ? <Loader2 size={15} className="ri-girando" /> : <ArchiveRestore size={15} />}
                {estado === 'subiendo' ? 'Restaurando…' : 'Restaurar'}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
