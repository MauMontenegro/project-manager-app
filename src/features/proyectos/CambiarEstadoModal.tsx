import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useCambiarEstado } from '@/api/hooks'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EstadoBadge } from '@/components/ui/Badge'
import { TextField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { todayISO } from '@/lib/format'
import type { EstadoProyecto, ProyectoDetalle } from '@/types/api'

export function CambiarEstadoModal({ proyecto, destino, onClose }: {
  proyecto: ProyectoDetalle
  destino: EstadoProyecto
  onClose: () => void
}) {
  const toast = useToast()
  const mutation = useCambiarEstado(proyecto.id_proyecto)
  const [fecha, setFecha] = useState(todayISO())
  const cierra = destino === 'Cierre'
  const final = cierra || destino === 'Cancelado'

  return (
    <ConfirmDialog
      open title="Cambiar estado del proyecto" confirmLabel={`Pasar a ${destino}`}
      danger={destino === 'Cancelado'} loading={mutation.isPending} error={mutation.error} onClose={onClose}
      onConfirm={() =>
        mutation.mutate(
          { estado_proyecto: destino, ...(cierra && fecha ? { fecha_real_cierre: fecha } : {}) },
          { onSuccess: () => { toast.success(`Proyecto en estado “${destino}”`); onClose() } },
        )
      }
    >
      <div className="flex items-center gap-2 text-fg">
        <EstadoBadge value={proyecto.estado_proyecto} /> <ArrowRight className="size-4 text-muted" aria-hidden /> <EstadoBadge value={destino} />
      </div>
      {final && <p><strong className="text-fg">Esta acción es definitiva:</strong> los proyectos en “{destino}” ya no admiten más cambios de estado ni nuevas asignaciones.</p>}
      {cierra && (
        <TextField type="date" label="Fecha real de cierre" value={fecha} onChange={(e) => setFecha(e.target.value)}
          hint="Si la dejas vacía se usará la fecha de hoy." />
      )}
    </ConfirmDialog>
  )
}
