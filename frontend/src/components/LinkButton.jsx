import { Link } from 'react-router-dom'

export default function LinkButton({
  to,
  children,
  variant = 'primary',
  size,
  block = false,
}) {
  const cls = [
    'btn',
    `btn--${variant}`,
    size ? `btn--${size}` : '',
    block ? 'btn--block' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <Link to={to} className={cls}>
      {children}
    </Link>
  )
}