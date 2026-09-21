import { useState } from 'react'
import Card from '../components/Card.jsx'

const usuarios = [
  { nombre: 'Ana Luisa Reyes', correo: 'ana@losquerubines.com', rol: 'Propietario', estado: 'Activo' },
  { nombre: 'Encargado 1', correo: 'encargado@losquerubines.com', rol: 'Encargado', estado: 'Activo' },
]

export default function Configuracion() {
  const [tab, setTab] = useState('negocio')

  function handleSubmit(event) {
    event.preventDefault()
    // El guardado real se conecta cuando el backend esté listo.
  }

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Configuración">
        <button className={'tab' + (tab === 'negocio' ? ' is-active' : '')} role="tab" aria-selected={tab === 'negocio'} onClick={() => setTab('negocio')}>Datos del negocio</button>
        <button className={'tab' + (tab === 'usuarios' ? ' is-active' : '')} role="tab" aria-selected={tab === 'usuarios'} onClick={() => setTab('usuarios')}>Usuarios</button>
      </div>

      {tab === 'negocio' ? (
        <div className="card" style={{ maxWidth: 560 }}>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="nombreNegocio">Nombre del negocio</label>
              <input id="nombreNegocio" defaultValue='Dulcería "Los Querubines"' />
            </div>
            <div className="field">
              <label htmlFor="propietario">Propietario</label>
              <input id="propietario" defaultValue="Ana Luisa Reyes Martínez" />
            </div>
            <div className="field">
              <label htmlFor="direccion">Dirección</label>
              <input id="direccion" defaultValue="Col. Libertad, Nicolás Romero" />
            </div>
            <div className="field">
              <label htmlFor="whatsapp">Teléfono WhatsApp (alertas)</label>
              <input id="whatsapp" defaultValue="55 0000 0000" />
            </div>
            <button type="submit" className="btn btn--primary">Guardar cambios</button>
          </form>
        </div>
      ) : (
        <Card>
          <table>
            <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th></tr></thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.correo}>
                  <td>{u.nombre}</td><td>{u.correo}</td><td>{u.rol}</td><td>{u.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  )
}