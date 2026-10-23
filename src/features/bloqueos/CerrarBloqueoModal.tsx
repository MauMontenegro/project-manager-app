import { useState } from 'react'
import { useCerrarBloqueo } from '@/api/hooks'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TextArea, TextField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { isoToLocal, localToISO } from '@/lib/format'
import type { Bloqueo } from '@/types/api'
import { formatDiasHabiles } from './tiempo'

export function CerrarBloqueoModal({ bloqueo, onClose }: { bloqueo: Bloqueo; onClose: () => void }) {
  const toast = useToast()
  const mutation = useCerrarBloqueo()
  const [fin, setFin] = useState(isoToLocal(new Date().toISOString()))
  const [nota, setNota] = useState('')

  return (
    <ConfirmDialog
      open title="Resolver bloqueo" confirmLabel="Marcar como resuelto" loading={mutation.isPending}
      error={mutation.error} onClose={onClose}
      onConfirm={() => mutation.mutate(
        { id: bloqueo.id_bloqueo, fecha_fin_bloqueo: localToISO(fin), nota_resolucion: nota.trim() || null },
        { onSuccess: (b) => { toast.success(`Bloqueo resuelto: ${formatDiasHabiles(b.dias_impacto)} (${Number(b.horas_impacto)} h)`); onClose() } },
      )}
    >
      <p>
        {bloqueo.titulo_tarea ? <>«{bloqueo.titulo_tarea}» · </> : null}{bloqueo.causa_raiz}. Lleva {formatDiasHabiles(bloqueo.dias_impacto)}.
        Al resolverlo se fija su duración en tiempo hábil.
      </p>
      <TextField type="datetime-local" label="Resuelto el" value={fin} min={isoToLocal(bloqueo.fecha_inicio_bloqueo)}
        onChange={(e) => setFin(e.target.value)} />
      <TextArea label="¿Cómo se resolvió?" rows={2} maxLength={2000} value={nota} onChange={(e) => setNota(e.target.value)} />
    </ConfirmDialog>
  )
}
