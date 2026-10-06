import { useState } from 'react'
import { CheckCircle2, Trash2 } from 'lucide-react'
import { useDeleteBloqueo } from '@/api/hooks'
import { Badge, OrigenBadge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Table, Td, Th } from '@/components/ui/Layout'
import { useToast } from '@/components/ui/Toast'
import { formatDateTime, formatDays } from '@/lib/format'
import type { Bloqueo, Etapa } from '@/types/api'
import { CerrarBloqueoModal } from './CerrarBloqueoModal'

export function BloqueosTable({ bloqueos, etapas, proyectoNombre, dimmed }: {
  bloqueos: Bloqueo[]
  etapas: Map<number, Etapa>
  /** Si se entrega, se muestra la columna Proyecto. */
  proyectoNombre?: (id: number) => string
  dimmed?: boolean
}) {
  const toast = useToast()
  const del = useDeleteBloqueo()
  const [closing, setClosing] = useState<Bloqueo | null>(null)
  const [deleting, setDeleting] = useState<Bloqueo | null>(null)

  return (
    <>
      <Table>
        <thead>
          <tr>
            {proyectoNombre && <Th>Proyecto</Th>}
            <Th>Causa raíz</Th><Th>Etapa</Th><Th>Origen</Th><Th>Inicio</Th><Th>Estado</Th><Th>Impacto</Th><Th><span className="sr-only">Acciones</span></Th>
          </tr>
        </thead>
        <tbody className={dimmed ? 'opacity-60 transition-opacity' : ''}>
          {bloqueos.map((b) => {
            const abierto = !b.fecha_fin_bloqueo
            return (
              <tr key={b.id_bloqueo}>
                {proyectoNombre && <Td className="max-w-48 truncate font-medium">{proyectoNombre(b.id_proyecto)}</Td>}
                <Td className="font-medium whitespace-nowrap">{b.causa_raiz}</Td>
                <Td className="whitespace-nowrap text-muted">{etapas.get(b.id_etapa)?.nombre_etapa ?? `#${b.id_etapa}`}</Td>
                <Td><OrigenBadge value={b.responsable_origen} /></Td>
                <Td className="whitespace-nowrap text-muted">{formatDateTime(b.fecha_inicio_bloqueo)}</Td>
                <Td>{abierto ? <Badge tone="warn" dot>Abierto</Badge> : <Badge tone="ok" dot>Resuelto</Badge>}</Td>
                <Td className="whitespace-nowrap tabular-nums">{formatDays(b.dias_impacto)}</Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    {abierto && <Button size="sm" icon={<CheckCircle2 className="size-4" />} onClick={() => setClosing(b)}>Resolver</Button>}
                    <IconButton label="Eliminar bloqueo" onClick={() => setDeleting(b)}><Trash2 className="size-4" /></IconButton>
                  </div>
                </Td>
              </tr>
            )
          })}
        </tbody>
      </Table>

      {closing && <CerrarBloqueoModal bloqueo={closing} onClose={() => setClosing(null)} />}
      <ConfirmDialog
        open={!!deleting} title="Eliminar bloqueo" confirmLabel="Eliminar" danger loading={del.isPending} error={del.error}
        onClose={() => { setDeleting(null); del.reset() }}
        onConfirm={() => deleting && del.mutate(deleting.id_bloqueo, {
          onSuccess: () => { toast.success('Bloqueo eliminado'); setDeleting(null) },
        })}
      >
        <p>Se eliminará de forma permanente el bloqueo “{deleting?.causa_raiz}”. Esta acción no se puede deshacer.</p>
      </ConfirmDialog>
    </>
  )
}
