import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, FolderKanban, Pencil, Trash2, Users } from 'lucide-react'
import { useCapacidad, useEliminarEquipoTrabajo, useEquiposTrabajo, useProyectos } from '@/api/hooks'
import { useUsuarioMap } from '@/api/lookups'
import { usePermisos } from '@/auth/AuthProvider'
import { EstadoBadge, SemaforoBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState, ErrorState, Skeleton, Spinner } from '@/components/ui/Feedback'
import { Avatar, Card, CardHeader, PageHeader, ProgressBar } from '@/components/ui/Layout'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { formatDate, num } from '@/lib/format'
import { PanelBloqueos } from '@/features/bloqueos/PanelBloqueos'
import { useEquipoTrabajoActivo } from '@/features/equipos-trabajo/EquipoTrabajoActivo'
import { EquipoTrabajoFormModal } from '@/features/equipos-trabajo/EquipoTrabajoFormModal'
import { ConjuntoBadge, DepartamentoBadge } from '@/features/proyectos/Etiquetas'
import { ESTADOS_FINALES, fechaFinProyecto } from '@/types/api'

/** Un equipo de trabajo: sus proyectos, sus personas con su carga de esta semana y sus bloqueos y desfases. */
export default function EquipoTrabajoDetalle() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const toast = useToast()
  const equipos = useEquiposTrabajo()
  const { gestionaEquipo } = usePermisos()
  const { id: activo, elegir } = useEquipoTrabajoActivo()
  const [editando, setEditando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const eliminar = useEliminarEquipoTrabajo()
  const proyectos = useProyectos({ id_equipo_trabajo: id, limit: 200 })
  const { map: usuarios } = useUsuarioMap()
  const e = equipos.data?.find((x) => x.id_equipo_trabajo === id)
  const capacidad = useCapacidad({ semanas: 1 }, !!e)
  const cargaDe = new Map(capacidad.data?.map((c) => [c.id_usuario, c.semanas[0]]))

  if (equipos.isPending) return <Spinner label="Cargando equipo de trabajo…" />
  if (equipos.isError) return <Card><ErrorState error={equipos.error} onRetry={() => equipos.refetch()} /></Card>
  if (!e) return <Card><EmptyState icon={<Users className="size-6" />} title="Este equipo de trabajo no existe" action={<Link to="/equipos-trabajo" className="text-brand hover:underline">Ver equipos de trabajo</Link>} /></Card>

  const items = proyectos.data?.items ?? []
  const abiertos = items.filter((p) => !ESTADOS_FINALES.includes(p.estado_proyecto))
  const cerrados = items.filter((p) => ESTADOS_FINALES.includes(p.estado_proyecto))

  return (
    <>
      <PageHeader
        back={<Link to="/equipos-trabajo" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" /> Equipos de trabajo</Link>}
        title={e.nombre}
        description={e.descripcion ?? undefined}
        actions={<>
          <Button variant={activo === id ? 'primary' : 'secondary'} icon={activo === id ? <Check className="size-4" /> : undefined}
            onClick={() => elegir(activo === id ? null : id)}>{activo === id ? 'Filtrando la app' : 'Filtrar la app por este equipo'}</Button>
          {gestionaEquipo && <Button icon={<Pencil className="size-4" />} onClick={() => setEditando(true)}>Editar</Button>}
          {gestionaEquipo && <Button variant="ghost" className="text-danger hover:text-danger" icon={<Trash2 className="size-4" />} onClick={() => setEliminando(true)}>Eliminar</Button>}
        </>}
      />
      <div className="-mt-3 mb-6 h-1.5 w-24 rounded-full" style={{ background: e.color }} aria-hidden />

      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Proyectos" subtitle={`${abiertos.length} abiertos · ${cerrados.length} cerrados`}
              action={<Link to="/proyectos?espacio=todos" onClick={() => elegir(id)} className="text-sm font-medium text-brand hover:underline">Ver en Proyectos</Link>} />
            {proyectos.isPending ? <div className="space-y-3 p-5"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
              : items.length === 0 ? (
                <EmptyState icon={<FolderKanban className="size-6" />} title="Sin proyectos"
                  description="Asigna proyectos a este equipo desde Editar en cada proyecto, o elige el equipo al crearlo." />
              ) : (
                <ul className="divide-y divide-border">
                  {[...abiertos, ...cerrados].map((p) => (
                    <li key={p.id_proyecto} className={cn('grid gap-2 px-5 py-3 sm:grid-cols-[1fr_8rem_auto] sm:items-center', ESTADOS_FINALES.includes(p.estado_proyecto) && 'opacity-70')}>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={`/proyectos/${p.id_proyecto}`} className="truncate text-sm font-medium hover:text-brand hover:underline">{p.nombre_proyecto}</Link>
                          {p.es_conjunto ? <ConjuntoBadge /> : <DepartamentoBadge value={p.departamento} />}
                        </div>
                        <p className="truncate text-xs text-muted">
                          {usuarios.get(p.lider_id)?.nombre ?? '—'} · {p.es_conjunto ? p.subproyectos.map((s) => s.departamento).join(', ') : p.etapa_actual} · entrega {formatDate(fechaFinProyecto(p))}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1"><ProgressBar label={`Avance de ${p.nombre_proyecto}`} value={num(p.porcentaje_avance)} /></div>
                        <span className="w-9 text-right text-xs text-muted tabular-nums">{Math.round(num(p.porcentaje_avance))}%</span>
                      </div>
                      <div className="flex items-center gap-2"><EstadoBadge value={p.estado_proyecto} /><SemaforoBadge value={p.semaforo} /></div>
                    </li>
                  ))}
                </ul>
              )}
          </Card>

          <Card className="h-fit">
            <CardHeader title="Personas" subtitle="Carga de proyectos de esta semana" />
            {e.miembros.length === 0 ? <p className="p-5 text-sm text-muted">Aún no tiene personas.{gestionaEquipo && ' Agrégalas desde Editar.'}</p> : (
              <ul className="divide-y divide-border">
                {e.miembros.map((m) => {
                  const s = cargaDe.get(m.id_usuario)
                  const pct = s?.utilizacion == null ? null : num(s.utilizacion)
                  return (
                    <li key={m.id_usuario} className="flex items-center gap-3 px-5 py-2.5">
                      <Avatar name={m.nombre} className="size-7 text-[10px]" />
                      <div className="min-w-0 flex-1">
                        <Link to={`/equipo/${m.id_usuario}`} className="block truncate text-sm font-medium hover:text-brand hover:underline">{m.nombre}</Link>
                        <p className="truncate text-xs text-muted">{m.departamento ?? 'Sin departamento'}</p>
                      </div>
                      <span className={cn('text-xs font-medium tabular-nums', pct == null ? 'text-muted' : pct > 100 ? 'text-danger' : pct >= 85 ? 'text-warn' : 'text-fg')}>
                        {pct == null ? '—' : `${Math.round(pct)} %`}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>

        <section>
          <h2 className="mb-3 text-base font-semibold">Bloqueos y desfases</h2>
          <PanelBloqueos idEquipoTrabajo={id} porProyecto />
        </section>
      </div>

      {editando && <EquipoTrabajoFormModal equipo={e} onClose={() => setEditando(false)} />}
      <ConfirmDialog open={eliminando} danger title="Eliminar equipo de trabajo" confirmLabel="Eliminar" loading={eliminar.isPending} error={eliminar.error}
        onClose={() => { eliminar.reset(); setEliminando(false) }}
        onConfirm={() => eliminar.mutate(id, {
          onSuccess: () => { if (activo === id) elegir(null); toast.success(`Equipo «${e.nombre}» eliminado`); navigate('/equipos-trabajo', { replace: true }) },
        })}>
        <p>Se eliminará «{e.nombre}». Sus {e.proyectos} proyecto(s) quedarán sin equipo de trabajo y sus personas no cambian.</p>
      </ConfirmDialog>
    </>
  )
}
