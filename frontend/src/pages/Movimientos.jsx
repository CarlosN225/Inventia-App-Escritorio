import { useState } from 'react'
import Card from '../components/Card.jsx'
import PageHeader from '../components/PageHeader.jsx'
// ...
<PageHeader title="Registrar movimiento" subtitle="Entradas, salidas y ajustes de inventario" />
const historial = [
  { fecha: '20/09 09:14', producto: 'Paleta payaso', tipo: 'Salida', cantidad: 5, motivo: 'Venta', usuario: 'Ana Reyes' },
  { fecha: '19/09 17:02', producto: 'Chocolate turín', tipo: 'Entrada', cantidad: 30, motivo: 'Compra a proveedor', usuario: 'Ana Reyes' },
  { fecha: '19/09 12:40', producto: 'Piñata estrella', tipo: 'Salida', cantidad: 2, motivo: 'Venta', usuario: 'Ana Reyes' },
]

export default function Movimientos() {
  const [tab, setTab] = useState('registrar')

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Movimientos">
        <button className={'tab' + (tab === 'registrar' ? ' is-active' : '')} role="tab" aria-selected={tab === 'registrar'} onClick={() => setTab('registrar')}>Registrar</button>
        <button className={'tab' + (tab === 'historial' ? ' is-active' : '')} role="tab" aria-selected={tab === 'historial'} onClick={() => setTab('historial')}>Historial</button>
      </div>
      {tab === 'registrar' ? <RegistrarMovimiento /> : <HistorialMovimientos />}
    </>
  )
}

function RegistrarMovimiento() {
  const [tipo, setTipo] = useState('Entrada')

  function handleSubmit(event) {
    event.preventDefault()
    // El guardado real se conecta cuando el backend esté listo.
  }

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="producto">Producto</label>
          <select id="producto"><option>Paleta payaso</option><option>Chocolate turín</option><option>Piñata estrella</option></select>
        </div>
        <div className="field">
          <span id="tipoLabel">Tipo de movimiento</span>
          <div className="pill-group" role="radiogroup" aria-labelledby="tipoLabel">
            {['Entrada', 'Salida', 'Ajuste'].map((opcion) => (
              <button
                key={opcion}
                type="button"
                role="radio"
                aria-checked={tipo === opcion}
                className={'pill' + (tipo === opcion ? ' is-selected' : '')}
                onClick={() => setTipo(opcion)}
              >
                {opcion}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="cantidad">Cantidad</label>
          <input id="cantidad" type="number" min="1" />
        </div>
        <div className="field">
          <label htmlFor="motivo">Motivo</label>
          <input id="motivo" placeholder="Ej. Compra a proveedor" />
        </div>
        <button type="submit" className="btn btn--primary">Registrar</button>
      </form>
    </div>
  )
}

function HistorialMovimientos() {
  return (
    <Card>
      <table>
        <thead>
          <tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Motivo</th><th>Usuario</th></tr>
        </thead>
        <tbody>
          {historial.map((m) => (
            <tr key={m.fecha + m.producto}>
              <td>{m.fecha}</td><td>{m.producto}</td><td>{m.tipo}</td>
              <td className="num">{m.cantidad}</td><td>{m.motivo}</td><td>{m.usuario}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}