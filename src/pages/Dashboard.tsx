import { Link } from 'react-router-dom'
import { AlertOctagon, ArrowRight, FolderKanban, Plus } from 'lucide-react'
import { useState } from 'react'
import { AvisoEquipoTrabajo, useEquipoTrabajoActivo } from '@/features/equipos-trabajo/EquipoTrabajoActivo'
import { useBloqueos, useProyectos, useProyectosTotal } from '@/api/hooks'
import { useProyectoMap, useUsuarioMap } from '@/api/lookups'
import { Badge, EstadoBadge, SemaforoBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Card, CardHeader, PageHeader } from '@/components/ui/Layout'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime } from '@/lib/format'
import { ProyectoFormModal } from '@/features/proyectos/ProyectoFormModal'
import { usePermisos } from '@/auth/AuthProvider'
import { DEPARTAMENTOS_PROYECTO, SEMAFOROS, type Semaforo } from '@/types/api'

const semaforoColor: Record<Semaforo, { bar: string; text: string }> = {
  Verde: { bar: 'bg-ok', text: 'text-ok' },
  Amarillo: { bar: 'bg-warn', text: 'text-warn' },
  Rojo: { bar: 'bg-danger', text: 'text-danger' },
}

function Kpi({ label, value, loading, tone, to }: {
  label: string; value?: number | string; loading: boolean; tone?: string; to?: string
}) {
  const body = (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm transition-colors hover:border-border-strong">
      <p className="text-sm text-muted">{label}</p>
      {loading ? <Skeleton className="mt-2 h-9 w-16" /> : <p className={cn('mt-1 text-3xl font-semibold tabular-nums', tone)}>{value}</p>}
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

export default function Dashboard() {
  const { creaProyectos } = usePermisos()
  const [creating, setCreating] = useState(false)
  // Equipo de trabajo activo (selector global): acota todo el panel.
  const equipo = useEquipoTrabajoActivo()
  const f = { id_equipo_trabajo: equipo.id ?? undefined }
  const total = useProyectosTotal({ ...f })
  const verde = useProyectosTotal({ ...f, semaforo: 'Verde' })
  const amarillo = useProyectosTotal({ ...f, semaforo: 'Amarillo' })
  const rojo = useProyectosTotal({ ...f, semaforo: 'Rojo' })
  const semaforoQ = { Verde: verde, Amarillo: amarillo, Rojo: rojo }
  const deptosQ = DEPARTAMENTOS_PROYECTO.map((d) => ({ departamento: d, q: useProyectosTotal({ ...f, departamento: d }) })) // eslint-disable-line react-hooks/rules-of-hooks
  const activos = useProyectosTotal({ ...f, estado: 'Activo' })

  const recientes = useProyectos({ ...f, limit: 6 })
  const criticos = useProyectos({ ...f, semaforo: 'Rojo', limit: 5 })
  const bloqueos = useBloqueos({ ...f, abierto: true, limit: 200 })
  const { map: usuarios } = useUsuarioMap()
  const { map: proyectos } = useProyectoMap()

  const anyError = total.error ?? recientes.error
  const maxDepto = Math.max(1, ...deptosQ.map((x) => x.q.data ?? 0))
  const semTotal = SEMAFOROS.reduce((a, s) => a + (semaforoQ[s].data ?? 0), 0)
  const bloqueosCount = bloqueos.data?.length ?? 0

  return (
    <>
      <PageHeader
        title="Panel de portafolio"
        description="Resumen del estado de salud de los proyectos."
        actions={creaProyectos && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nuevo proyecto</Button>}
      />

      <AvisoEquipoTrabajo que="el portafolio" />
      {anyError ? (
        <Card><ErrorState error={anyError} onRetry={() => { total.refetch(); recientes.refetch() }} /></Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Proyectos" value={total.data} loading={total.isPending} to="/proyectos?espacio=todos" />
            <Kpi label="En rojo" value={rojo.data} loading={rojo.isPending} tone="text-danger" to="/proyectos?espacio=todos&semaforo=Rojo" />
            <Kpi label="Activos" value={activos.data} loading={activos.isPending} to="/proyectos?espacio=todos&estado=Activo" />
            <Kpi
              label="Bloqueos abiertos" to="/bloqueos"
              value={bloqueosCount >= 200 ? '200+' : bloqueosCount} loading={bloqueos.isPending}
              tone={bloqueosCount > 0 ? 'text-warn' : undefined}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Salud del portafolio" subtitle="Distribución por semáforo" />
              <div className="space-y-5 p-5">
                <div
                  role="img" aria-label={SEMAFOROS.map((s) => `${s}: ${semaforoQ[s].data ?? 0}`).join(', ')}
                  className="flex h-3 overflow-hidden rounded-full bg-surface-2"
                >
                  {SEMAFOROS.map((s) => {
                    const n = semaforoQ[s].data ?? 0
                    return n > 0 && <div key={s} className={semaforoColor[s].bar} style={{ width: `${(n / semTotal) * 100}%` }} />
                  })}
                </div>
                <ul className="grid grid-cols-3 gap-3">
                  {SEMAFOROS.map((s) => (
                    <li key={s}>
                      <Link to={`/proyectos?espacio=todos&semaforo=${s}`} className="block rounded-lg p-2 -m-2 hover:bg-surface-2">
                        <SemaforoBadge value={s} />
                        <p className={cn('mt-2 text-2xl font-semibold tabular-nums', semaforoColor[s].text)}>{semaforoQ[s].data ?? '–'}</p>
                        <p className="text-xs text-muted">{semTotal ? Math.round(((semaforoQ[s].data ?? 0) / semTotal) * 100) : 0}%</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            <Card>
              <CardHeader title="Proyectos por departamento" subtitle="Los conjuntos cuentan en cada departamento participante" />
              <ul className="space-y-3 p-5">
                {deptosQ.map(({ departamento, q }, i) => (
                  <li key={departamento}>
                    <Link to={`/proyectos?espacio=${['infraestructura', 'procesos', 'desarrollo'][i]}`} className="group grid grid-cols-[minmax(0,12rem)_1fr_2rem] items-center gap-3 text-sm">
                      <span className="truncate text-muted group-hover:text-fg">{departamento}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                        <span className="block h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${((q.data ?? 0) / maxDepto) * 100}%` }} />
                      </span>
                      <span className="text-right font-medium tabular-nums">{q.data ?? '–'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Requieren atención" subtitle="Proyectos en rojo"
                action={<Link to="/proyectos?espacio=todos&semaforo=Rojo" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">Ver todos <ArrowRight className="size-4" /></Link>} />
              {criticos.isPending ? <div className="space-y-3 p-5"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
                : criticos.data?.items.length ? (
                  <ul className="divide-y divide-border">
                    {criticos.data.items.map((p) => (
                      <li key={p.id_proyecto}>
                        <Link to={`/proyectos/${p.id_proyecto}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{p.nombre_proyecto}</p>
                            <p className="truncate text-xs text-muted">{p.semaforo_motivo ?? `${usuarios.get(p.lider_id)?.nombre ?? '—'} · Compromiso ${formatDate(p.fecha_comprometida)}`}</p>
                          </div>
                          <EstadoBadge value={p.estado_proyecto} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : <EmptyState title="Sin proyectos en rojo" description="Todo el portafolio está bajo control." />}
            </Card>

            <Card>
              <CardHeader title="Bloqueos abiertos" subtitle="Más recientes primero"
                action={<Link to="/bloqueos" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">Ver todos <ArrowRight className="size-4" /></Link>} />
              {bloqueos.isPending ? <div className="space-y-3 p-5"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
                : bloqueos.data?.length ? (
                  <ul className="divide-y divide-border">
                    {bloqueos.data.slice(0, 5).map((b) => (
                      <li key={b.id_bloqueo}>
                        <Link to={`/proyectos/${b.id_proyecto}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2">
                          <div className="flex min-w-0 items-center gap-3">
                            <AlertOctagon className="size-4 shrink-0 text-warn" aria-hidden />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{b.causa_raiz}</p>
                              <p className="truncate text-xs text-muted">{proyectos.get(b.id_proyecto)?.nombre_proyecto ?? `Proyecto #${b.id_proyecto}`} · desde {formatDateTime(b.fecha_inicio_bloqueo)}</p>
                            </div>
                          </div>
                          <Badge tone="neutral">{b.responsable_origen}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : <EmptyState title="Sin bloqueos abiertos" description="No hay interrupciones activas." />}
            </Card>
          </div>

          <Card>
            <CardHeader title="Proyectos recientes"
              action={<Link to="/proyectos?espacio=todos" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">Ver portafolio <ArrowRight className="size-4" /></Link>} />
            {recientes.isPending ? <div className="space-y-3 p-5"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
              : recientes.data?.items.length ? (
                <ul className="divide-y divide-border">
                  {recientes.data.items.map((p) => (
                    <li key={p.id_proyecto}>
                      <Link to={`/proyectos/${p.id_proyecto}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p.nombre_proyecto}</p>
                          <p className="text-xs text-muted">{usuarios.get(p.lider_id)?.nombre ?? '—'}</p>
                        </div>
                        <div className="flex items-center gap-2"><EstadoBadge value={p.estado_proyecto} /><SemaforoBadge value={p.semaforo} /></div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<FolderKanban className="size-6" />} title="Aún no hay proyectos"
                  description="Crea el primero para comenzar a gestionar tu portafolio."
                  action={creaProyectos && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nuevo proyecto</Button>} />
              )}
          </Card>
        </div>
      )}

      {creating && <ProyectoFormModal onClose={() => setCreating(false)} />}
    </>
  )
}
