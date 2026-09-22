import { useState } from 'react'
import Tag from '../components/Tag.jsx'

const activas = [
  { producto: 'Piñata estrella', stock: 1, minimo: 3, estado: 'pendiente' },
  { producto: 'Paleta payaso', stock: 3, minimo: 10, estado: 'enviada' },
]

export default function Alertas() {
  const [tab, setTab] = useState('activas')

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Alertas">
        <button className={'tab' + (tab === 'activas' ? ' is-active' : '')} role="tab" aria-selected={tab === 'activas'} onClick={() => setTab('activas')}>Activas</button>
        <button className={'tab' + (tab === 'historial' ? ' is-active' : '')} role="tab" aria-selected={tab === 'historial'} onClick={() => setTab('historial')}>Historial</button>
      </div>

      {tab === 'activas' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activas.map((a) => (
            <div className="card" key={a.producto} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{a.producto}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Stock actual: {a.stock} · Mínimo: {a.minimo}</div>
              </div>
              <Tag tone={a.estado === 'pendiente' ? 'warning' : 'success'}>
                {a.estado === 'pendiente' ? 'Pendiente de envío' : 'Enviada por WhatsApp'}
              </Tag>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--color-text-muted)' }}>Aún no hay historial de alertas enviadas.</p>
      )}
    </>
  )
}