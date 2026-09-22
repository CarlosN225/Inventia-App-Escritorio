export default function Button({
  children,
  variant = 'primary',
  size,
  block = false,
  type = 'button',
  ...rest
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
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  )
}