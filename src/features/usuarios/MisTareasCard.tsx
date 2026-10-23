import { Link } from 'react-router-dom'
import { ArrowRight, Lock } from 'lucide-react'
import { useTareasPersona } from '@/api/hooks'
import { ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Card, CardHeader } from '@/components/ui/Layout'
import { origenTarea, puntoEstado, vencida } from '@/features/tareas/fechas'
import { cn } from '@/lib/cn'
import { formatDate, formatHours, num } from '@/lib/format'
import { enlaceTarea, ESTADOS_TAREA } from '@/types/api'

/** Resumen de las tareas de quien inició sesión: conteo por estado y las próximas a vencer. */
export function MisTareasCard() {
  const q = useTareasPersona()
  const abiertas = q.data?.filter((t) => t.estado !== 'Finalizado') ?? []
  const vencidas = abiertas.filter(vencida).length
  const horas = abiertas.reduce((s, t) => s + num(t.horas_asignadas), 0)
  const proximas = [...abiertas].sort((a, b) => (a.fecha_fin ?? '9999').localeCompare(b.fecha_fin ?? '9999')).slice(0, 5)

  return (
    <Card>
      <CardHeader title="Mis tareas" subtitle={q.data ? `${abiertas.length} abiertas · ${formatHours(horas)} por hacer${vencidas ? ` · ${vencidas} vencida(s)` : ''}` : undefined}
        action={<Link to="/tareas" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">Ver tablero <ArrowRight className="size-4" /></Link>} />
      <div className="p-5">
        {q.isPending ? <Skeleton className="h-32" /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
          <>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ESTADOS_TAREA.map((e) => (
                <li key={e} className="rounded-lg border border-border px-3 py-2">
                  <p className="flex items-center gap-1.5 text-xs text-muted"><span className={cn('size-2 rounded-full', puntoEstado[e])} />{e}</p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums">{q.data.filter((t) => t.estado === e).length}</p>
                </li>
              ))}
            </ul>
            {proximas.length === 0 ? (
              <p className="mt-4 text-sm text-muted">{q.data.length ? 'Todas tus tareas están finalizadas. 🎉' : 'No tienes tareas asignadas.'}</p>
            ) : (
              <>
                <p className="mt-5 mb-2 text-xs font-medium tracking-wide text-muted uppercase">Próximas a vencer</p>
                <ul className="divide-y divide-border">
                  {proximas.map((t) => (
                    <li key={t.id_tarea}>
                      <Link to={enlaceTarea(t)} className="flex items-center gap-3 py-2 hover:text-brand">
                        <span className={cn('size-2.5 shrink-0 rounded-full', puntoEstado[t.estado])} title={t.estado} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{t.titulo}</span>
                          <span className="block truncate text-xs text-muted">{origenTarea(t)}</span>
                        </span>
                        {t.bloqueada && <Lock className="size-3.5 shrink-0 text-warn" aria-label="Espera dependencias" />}
                        <span className={cn('shrink-0 text-xs tabular-nums', vencida(t) ? 'font-medium text-red-500' : 'text-muted')}>
                          {t.fecha_fin ? `${vencida(t) ? 'Venció' : 'Vence'} ${formatDate(t.fecha_fin)}` : 'Sin fecha'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </Card>
  )
}
