export default function StockBar({ stock, minimo }) {
  const scale = Math.max(minimo * 2, 1)
  const pct = Math.min(100, Math.round((stock / scale) * 100))
  const isLow = stock <= minimo

  return (
    <div
      className="stockbar"
      role="img"
      aria-label={`Existencia: ${stock}. Mínimo recomendado: ${minimo}`}
    >
      <div className="stockbar__track">
        <div
          className={'stockbar__fill' + (isLow ? ' is-low' : '')}
          style={{ width: pct + '%' }}
        />
        <div className="stockbar__threshold" style={{ left: '50%' }} />
      </div>
      <span className="stockbar__value">{stock}</span>
    </div>
  )
}