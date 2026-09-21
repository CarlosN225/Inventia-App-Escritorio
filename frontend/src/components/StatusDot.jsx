export default function StatusDot({ online = true }) {
  return (
    <span className={'status-dot' + (online ? ' is-online' : ' is-offline')}>
      <span className="status-dot__core" aria-hidden="true" />
      {online ? 'En línea' : 'Sin conexión'}
    </span>
  )
}