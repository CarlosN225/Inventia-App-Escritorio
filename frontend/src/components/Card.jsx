export default function Card({ title, children, className = '' }) {
  return (
    <section className={'card' + (className ? ' ' + className : '')}>
      {title && <h2 className="card__title">{title}</h2>}
      {children}
    </section>
  )
}