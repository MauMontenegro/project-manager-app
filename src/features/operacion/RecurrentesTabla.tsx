import { useState } from 'react'
import { Pause, Pencil, Play, Plus, Repeat, Trash2 } from 'lucide-react'
import { useActualizarRecurrente, useEliminarRecurrente, useTareasRecurrentes } from '@/api/hooks'
import { useUsuarioMap } from '@/api/lookups'
import { useAuth, usePermisos } from '@/auth/AuthProvider'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FilterSelect } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Card, Table, Td, Th } from '@/components/ui/Layout'
import { useToast } from '@/components/ui/Toast'
import { formatDate, formatHours } from '@/lib/format'
import { EtiquetasList } from '@/features/proyectos/Etiquetas'
import type { TareaRecurrente, TareasRecurrentesFiltro } from '@/types/api'
import { RecurrenteFormModal } from './RecurrenteFormModal'

/** Quién puede mover y editar las tareas o recurrentes de una persona: ella misma, el Gerente de su departamento o el Administrador. */
export function useGestionaPersona() {
  const { sesion } = useAuth()
  const { gestionaDepartamento } = usePermisos()
  const { map: usuarios } = useUsuarioMap()
  return (idUsuario: number) => sesion?.id_usuario === idUsuario || gestionaDepartamento(usuarios.get(idUsuario)?.departamento)
}

/** Tareas recurrentes (plantillas) de una persona: editar, pausar, reanudar o eliminar. */
export function RecurrentesTabla({ filtro, onCrear }: { filtro: TareasRecurrentesFiltro; onCrear: () => void }) {
  const [estado, setEstado] = useState<'' | 'activas' | 'pausadas'>('')
  const q = useTareasRecurrentes({ ...filtro, activa: estado === '' ? undefined : estado === 'activas' })
  const { map: usuarios } = useUsuarioMap()
  const gestiona = useGestionaPersona()
  const toast = useToast()
  const actualizar = useActualizarRecurrente()
  const eliminar = useEliminarRecurrente()
  const [editando, setEditando] = useState<TareaRecurrente | null>(null)
  const [borrando, setBorrando] = useState<TareaRecurrente | null>(null)

  const alternar = (r: TareaRecurrente) => actualizar.mutate({ id_recurrente: r.id_recurrente, activa: !r.activa }, {
    onSuccess: () => toast.success(r.activa ? `“${r.titulo}” pausada` : `“${r.titulo}” reanudada`),
    onError: (e) => toast.error(e.message),
  })

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
        <FilterSelect label="Filtrar por estado" value={estado} onChange={(v) => setEstado(v as typeof estado)}>
          <option value="">Activas y pausadas</option>
          <option value="activas">Activas</option>
          <option value="pausadas">Pausadas</option>
        </FilterSelect>
      </div>
      {q.isPending ? <div className="space-y-3 p-4"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
        : q.data.length === 0 ? (
          <EmptyState icon={<Repeat className="size-6" />} title="Sin tareas recurrentes"
            description="Define la operación del día a día: revisiones diarias, reportes semanales, cierres mensuales…"
            action={<Button variant="primary" icon={<Plus className="size-4" />} onClick={onCrear}>Nueva tarea recurrente</Button>} />
        ) : (
          <Table>
            <thead>
              <tr><Th>Tarea</Th><Th>Responsable</Th><Th>Frecuencia</Th><Th className="text-right">Horas</Th><Th>Vigencia</Th><Th className="text-right">Abiertas</Th><Th>Estado</Th><Th><span className="sr-only">Acciones</span></Th></tr>
            </thead>
            <tbody>
              {q.data.map((r) => {
                const puede = gestiona(r.id_usuario)
                return (
                  <tr key={r.id_recurrente} className={r.activa ? undefined : 'text-muted'}>
                    <Td className="max-w-sm">
                      <p className="font-medium">{r.titulo}</p>
                      {r.descripcion && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{r.descripcion}</p>}
                      <EtiquetasList etiquetas={r.etiquetas} className="mt-1.5" />
                    </Td>
                    <Td className="whitespace-nowrap">{usuarios.get(r.id_usuario)?.nombre ?? '—'}</Td>
                    <Td><Badge tone="info"><Repeat className="size-3" aria-hidden />{r.frecuencia}</Badge></Td>
                    <Td className="text-right whitespace-nowrap tabular-nums">{formatHours(r.horas_por_periodo)}</Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(r.fecha_inicio)} – {r.fecha_fin ? formatDate(r.fecha_fin) : 'sin fin'}</Td>
                    <Td className="text-right tabular-nums">{r.tareas_abiertas}</Td>
                    <Td>{r.activa ? <Badge tone="ok" dot>Activa</Badge> : <Badge tone="neutral" dot>Pausada</Badge>}</Td>
                    <Td className="whitespace-nowrap">
                      {puede && (
                        <div className="flex justify-end gap-0.5">
                          <IconButton label={`Editar “${r.titulo}”`} className="size-8" onClick={() => setEditando(r)}><Pencil className="size-4" /></IconButton>
                          <IconButton label={r.activa ? `Pausar “${r.titulo}”` : `Reanudar “${r.titulo}”`} className="size-8"
                            disabled={actualizar.isPending} onClick={() => alternar(r)}>
                            {r.activa ? <Pause className="size-4" /> : <Play className="size-4" />}
                          </IconButton>
                          <IconButton label={`Eliminar “${r.titulo}”`} className="size-8 hover:text-danger" onClick={() => setBorrando(r)}><Trash2 className="size-4" /></IconButton>
                        </div>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      {editando && <RecurrenteFormModal recurrente={editando} onClose={() => setEditando(null)} />}
      {borrando && (
        <ConfirmDialog open danger title="Eliminar tarea recurrente" confirmLabel="Eliminar" loading={eliminar.isPending}
          error={eliminar.error} onClose={() => { eliminar.reset(); setBorrando(null) }}
          onConfirm={() => eliminar.mutate(borrando.id_recurrente, {
            onSuccess: () => { toast.success(`“${borrando.titulo}” eliminada`); setBorrando(null) },
          })}>
          <p>Se eliminará <strong className="text-fg">“{borrando.titulo}”</strong> junto con <strong className="text-fg">todas</strong> las tareas que generó y sus comentarios.</p>
          <p>Si solo quieres que deje de generar tareas y conservar el historial, mejor <em>páusala</em>.</p>
        </ConfirmDialog>
      )}
    </Card>
  )
}
