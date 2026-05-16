import './ConfirmDialog.css'

const ConfirmDialog = (props) => {
  const {
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
    danger = false,
    loading = false
  } = props
  if (!open) return null
  const confirmClass = danger ? 'confirm-dialog-btn confirm-dialog-confirm confirm-dialog-danger' : 'confirm-dialog-btn confirm-dialog-confirm'
  return (
    <div className="confirm-dialog-overlay" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-dialog-title" className="confirm-dialog-title">{title}</h2>
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="confirm-dialog-btn confirm-dialog-cancel" onClick={onCancel} disabled={loading}>{cancelLabel}</button>
          <button type="button" className={confirmClass} onClick={onConfirm} disabled={loading}>{loading ? 'Please wait...' : confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
