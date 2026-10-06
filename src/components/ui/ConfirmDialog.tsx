import type { ReactNode } from 'react'
import { Button } from './Button'
import { FormError } from './Feedback'
import { Modal } from './Modal'

export function ConfirmDialog({ open, title, children, confirmLabel, danger, loading, error, onConfirm, onClose }: {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  danger?: boolean
  loading?: boolean
  error?: unknown
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal
      open={open} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <Button onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-muted">{children}</div>
      {!!error && <div className="mt-3"><FormError error={error} /></div>}
    </Modal>
  )
}
