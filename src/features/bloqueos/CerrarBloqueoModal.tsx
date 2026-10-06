import { useState } from 'react'
import { useCerrarBloqueo } from '@/api/hooks'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TextField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { isoToLocal, localToISO } from '@/lib/format'
import type { Bloqueo } from '@/types/api'

export function CerrarBloqueoModal({ bloqueo, onClose }: { bloqueo: Bloqueo; onClose: () => void }) {
  const toast = useToast()
  const mutation = useCerrarBloqueo()
  const [fin, setFin] = useState(isoToLocal(new Date().toISOString()))

  return (
    <ConfirmDialog
      open title="Resolver bloqueo" confirmLabel="Marcar como resuelto" loading={mutation.isPending}
      error={mutation.error} onClose={onClose}
      onConfirm={() =>
        mutation.mutate(
          { id: bloqueo.id_bloqueo, fecha_fin_bloqueo: localToISO(fin) },
          { onSuccess: (b) => { toast.success(`Bloqueo resuelto (${Number(b.dias_impacto ?? 0).toFixed(2)} días de impacto)`); onClose() } },
        )
      }
    >
      <p>Se registrará la fecha de fin y se calculará el impacto en días.</p>
      <TextField type="datetime-local" label="Fecha de resolución" value={fin} min={isoToLocal(bloqueo.fecha_inicio_bloqueo)}
        onChange={(e) => setFin(e.target.value)} />
    </ConfirmDialog>
  )
}
