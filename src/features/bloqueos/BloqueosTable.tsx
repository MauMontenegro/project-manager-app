import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Link2, Trash2 } from 'lucide-react'
import { useDeleteBloqueo } from '@/api/hooks'
import { useProyectoMap } from '@/api/lookups'
import { usePermisos } from '@/auth/AuthProvider'
import { Badge, OrigenBadge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Table, Td, Th } from '@/components/ui/Layout'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime, formatNumber } from '@/lib/format'
import type { Bloqueo } from '@/types/api'
import { CerrarBloqueoModal } from './CerrarBloqueoModal'
import { formatDiasHabiles } from './tiempo'

/** Bloqueos con su duración en tiempo hábil (los abiertos, hasta ahora). Resuelven la persona asignada y quien
 * gestiona el proyecto; eliminar (registros equivocados) solo quien gestiona. Los automáticos no se tocan. */
export function BloqueosTable({ bloqueos, mostrarProyecto, dimmed }: { bloqueos: Bloqueo[]; mostrarProyecto?: boolean; dimmed?: boolean }) {
  const toast = useToast()
  const del = useDeleteBloqueo()
  const permisos = usePermisos()
  const { map: proyectos } = useProyectoMap()
  const [closing, setClosing] = useState<Bloqueo | null>(null)
  const [deleting, setDeleting] = useState<Bloqueo | null>(null)
  const gestiona = (b: Bloqueo) => { const p = proyectos.get(b.id_proyecto); return !!p && permisos.gestionaProyecto(p) }

  return (
    <>
      <Table>
        <thead>
          <tr>
            <Th>Tarea</Th><Th>Causa</Th><Th>Origen · quién lo destraba</Th><Th>Desde</Th><Th className="text-right">Tiempo hábil</Th><Th>Estado</Th>
            <Th><span className="sr-only">Acciones</span></Th>
          </tr>
        </thead>
        <tbody className={dimmed ? 'opacity-60 transition-opacity' : ''}>
          {bloqueos.map((b) => {
            const abierto = !b.fecha_fin_bloqueo
            const puede = !b.automatico && (gestiona(b) || (b.id_usuario_tarea != null && permisos.esYo(b.id_usuario_tarea)))
            const enlace = b.id_tarea ? `/proyectos/${b.id_proyecto}?tarea=${b.id_tarea}` : `/proyectos/${b.id_proyecto}`
            return (
              <tr key={b.id_bloqueo} className={cn(!abierto && 'text-muted')}>
                <Td className="max-w-72">
                  <Link to={enlace} className="block truncate font-medium text-fg hover:text-brand hover:underline">
                    {b.titulo_tarea ?? `Etapa: ${b.nombre_etapa ?? '—'}`}
                  </Link>
                  <p className="truncate text-xs text-muted">
                    {mostrarProyecto && `${b.nombre_proyecto} · `}{b.nombre_usuario_tarea ?? (b.titulo_tarea ? '' : 'toda la etapa')}
                  </p>
                  {b.descripcion && <p className="mt-0.5 line-clamp-2 text-xs text-muted" title={b.descripcion}>{b.descripcion}</p>}
                  {b.nota_resolucion && <p className="mt-0.5 line-clamp-2 text-xs text-ok" title={b.nota_resolucion}>✓ {b.nota_resolucion}</p>}
                </Td>
                <Td className="whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 font-medium text-fg">
                    {b.automatico && <Link2 className="size-3.5 text-muted" aria-label="Automático" />}{b.causa_raiz}
                  </span>
                  {b.automatico && <p className="text-xs text-muted">Automático</p>}
                </Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <OrigenBadge value={b.responsable_origen} />
                    {b.responsable_resolucion && <span className="max-w-44 truncate text-xs" title={b.responsable_resolucion}>{b.responsable_resolucion}</span>}
                  </div>
                  {b.fecha_compromiso && (
                    <p className={cn('mt-0.5 flex items-center gap-1 text-xs', b.compromiso_vencido ? 'font-medium text-danger' : 'text-muted')}>
                      {b.compromiso_vencido && <AlertTriangle className="size-3.5" aria-hidden />}
                      Compromiso {formatDate(b.fecha_compromiso)}{b.compromiso_vencido && ' · vencido'}
                    </p>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-muted">
                  {formatDateTime(b.fecha_inicio_bloqueo)}
                  {b.fecha_fin_bloqueo && <span className="block text-xs">→ {formatDateTime(b.fecha_fin_bloqueo)}</span>}
                </Td>
                <Td className="text-right whitespace-nowrap tabular-nums">
                  <span className={cn('font-medium', abierto ? 'text-fg' : '')}>{formatDiasHabiles(b.dias_impacto)}</span>
                  <span className="block text-xs text-muted">{formatNumber(b.horas_impacto, 1)} h</span>
                </Td>
                <Td>{abierto ? <Badge tone="danger" dot>Abierto</Badge> : <Badge tone="ok" dot>Resuelto</Badge>}</Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    {abierto && puede && <Button size="sm" icon={<CheckCircle2 className="size-4" />} onClick={() => setClosing(b)}>Resolver</Button>}
                    {!b.automatico && gestiona(b) && (
                      <IconButton label="Eliminar registro equivocado" onClick={() => setDeleting(b)}><Trash2 className="size-4" /></IconButton>
                    )}
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
        <p>Úsalo solo si el registro fue un error: se borra y deja de contar en el tiempo bloqueado. Si el bloqueo fue real, márcalo como resuelto.</p>
      </ConfirmDialog>
    </>
  )
}
