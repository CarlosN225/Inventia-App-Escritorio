import { AlertTriangle, X } from 'lucide-react'

export default function ConfirmDialog({
  open,
  title = '¿Estás seguro?',
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  tone = 'danger',
  onConfirm,
  onCancel,
}) {
  if (!open) return null

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="dialog__close"
          onClick={onCancel}
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        <div className={'dialog__icon dialog__icon--' + tone}>
          <AlertTriangle size={26} strokeWidth={2.2} />
        </div>

        <h3 className="dialog__title">{title}</h3>
        {message && <p className="dialog__message">{message}</p>}

        <div className="dialog__actions">
          <button
            type="button"
            className="btn btn--outline"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={'btn btn--' + tone}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}