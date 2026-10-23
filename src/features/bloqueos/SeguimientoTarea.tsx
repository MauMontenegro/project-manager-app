import { useState } from 'react'
import { AlertOctagon, CheckCircle2, Flag, Link2 } from 'lucide-react'
import { useBloqueos, useLineaBase, useReprogramaciones } from '@/api/hooks'
import { usePermisos } from '@/auth/AuthProvider'
import { Badge, OrigenBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { FormError } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime, formatNumber, num } from '@/lib/format'
import { ESTADOS_FINALES, type Bloqueo, type Tarea } from '@/types/api'
import { BloqueoFormModal } from './BloqueoFormModal'
import { CerrarBloqueoModal } from './CerrarBloqueoModal'
import { formatDesfase, formatDiasHabiles } from './tiempo'

/** En el detalle de una tarea de proyecto: sus bloqueos (reportar / resolver) y su plan contra lo real (desfase,
 * reprogramaciones y nueva línea base). `gestiona`: quien gestiona el proyecto. */
export function SeguimientoTarea({ tarea, gestiona }: { tarea: Tarea; gestiona: boolean }) {
  const { esYo } = usePermisos()
  const bloqueos = useBloqueos({ id_tarea: tarea.id_tarea, limit: 100 })
  const [reportando, setReportando] = useState(false)
  const [resolviendo, setResolviendo] = useState<Bloqueo | null>(null)
  const abierta = tarea.estado !== 'Finalizado' && !(tarea.estado_proyecto && ESTADOS_FINALES.includes(tarea.estado_proyecto))
  const puede = gestiona || esYo(tarea.id_usuario)
  const lista = bloqueos.data ?? []

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-lg border border-border p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium">Bloqueos</h3>
            <p className="text-xs text-muted">
              {num(tarea.dias_bloqueada) > 0
                ? `${formatDiasHabiles(tarea.dias_bloqueada)} (${formatNumber(tarea.horas_bloqueada, 1)} h) bloqueada en total`
                : 'Nunca se ha bloqueado'}
            </p>
          </div>
          {abierta && puede && (
            <Button size="sm" icon={<AlertOctagon className="size-4" />} onClick={() => setReportando(true)}>Reportar</Button>
          )}
        </div>
        {lista.length > 0 && (
          <ul className="mt-3 space-y-2">
            {lista.map((b) => {
              const abierto = !b.fecha_fin_bloqueo
              return (
                <li key={b.id_bloqueo} className={cn('rounded-md border px-2.5 py-2 text-sm', abierto ? 'border-danger/40 bg-danger-soft/50' : 'border-border')}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {b.automatico && <Link2 className="size-3.5 text-muted" aria-label="Automático" />}
                    <span className="font-medium">{b.causa_raiz}</span>
                    <OrigenBadge value={b.responsable_origen} />
                    <span className="ml-auto text-xs font-medium tabular-nums">{formatDiasHabiles(b.dias_impacto, true)}</span>
                  </div>
                  {b.descripcion && <p className="mt-0.5 text-xs text-muted">{b.descripcion}</p>}
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDateTime(b.fecha_inicio_bloqueo)} → {abierto ? 'sigue abierto' : formatDateTime(b.fecha_fin_bloqueo)}
                    {b.responsable_resolucion && ` · lo destraba ${b.responsable_resolucion}`}
                  </p>
                  {b.fecha_compromiso && abierto && (
                    <p className={cn('text-xs', b.compromiso_vencido ? 'font-medium text-danger' : 'text-muted')}>
                      Compromiso {formatDate(b.fecha_compromiso)}{b.compromiso_vencido && ' · vencido'}
                    </p>
                  )}
                  {b.nota_resolucion && <p className="mt-0.5 text-xs text-ok">✓ {b.nota_resolucion}</p>}
                  {abierto && !b.automatico && puede && (
                    <Button size="sm" variant="ghost" className="mt-1 -ml-2" icon={<CheckCircle2 className="size-4" />} onClick={() => setResolviendo(b)}>
                      Marcar como resuelto
                    </Button>
                  )}
                  {abierto && b.automatico && <p className="mt-0.5 text-xs text-muted">Se cierra solo cuando terminen sus dependencias.</p>}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <PlanVsReal tarea={tarea} gestiona={gestiona && abierta} />

      {reportando && <BloqueoFormModal tarea={tarea} onClose={() => setReportando(false)} />}
      {resolviendo && <CerrarBloqueoModal bloqueo={resolviendo} onClose={() => setResolviendo(null)} />}
    </div>
  )
}

function PlanVsReal({ tarea, gestiona }: { tarea: Tarea; gestiona: boolean }) {
  const toast = useToast()
  const reps = useReprogramaciones(tarea.id_tarea)
  const lineaBase = useLineaBase()
  const [rebase, setRebase] = useState(false)
  const [motivo, setMotivo] = useState('')
  const desfase = tarea.desfase_dias ?? 0
  const cambiada = tarea.fecha_fin_base && tarea.fecha_fin_base !== tarea.fecha_fin

  return (
    <section className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">Plan vs. real</h3>
          <p className="text-xs text-muted">Desfase en días hábiles contra la fecha límite original</p>
        </div>
        <Badge tone={desfase > 0 ? 'danger' : desfase < 0 ? 'ok' : 'neutral'}>{formatDesfase(desfase)}</Badge>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div><dt className="text-xs text-muted">Fecha límite original</dt><dd className="font-medium tabular-nums">{formatDate(tarea.fecha_fin_base)}</dd></div>
        <div>
          <dt className="text-xs text-muted">Vigente</dt>
          <dd className={cn('font-medium tabular-nums', cambiada && 'text-warn')}>{formatDate(tarea.fecha_fin)}</dd>
        </div>
      </dl>
      {(reps.data?.length ?? 0) > 0 && (
        <ol className="mt-3 space-y-1.5 border-l border-border pl-3">
          {reps.data!.map((r) => (
            <li key={r.id_reprogramacion} className="text-xs">
              <p className="flex flex-wrap items-center gap-1">
                {r.es_linea_base ? <><Flag className="size-3.5 text-brand" aria-hidden /><span className="font-medium">Nueva línea base</span></>
                  : <span className={cn('font-medium tabular-nums', r.dias_habiles > 0 ? 'text-danger' : r.dias_habiles < 0 ? 'text-ok' : '')}>
                      {formatDate(r.fin_antes)} → {formatDate(r.fin_despues)} ({formatDesfase(r.dias_habiles)})
                    </span>}
                <span className="text-muted">· {r.actor_nombre}, {formatDateTime(r.fecha)}</span>
              </p>
              {(r.motivo || r.causa_bloqueo) && (
                <p className="text-muted">{r.motivo}{r.causa_bloqueo && <span className="text-danger"> · por bloqueo: {r.causa_bloqueo}</span>}</p>
              )}
            </li>
          ))}
        </ol>
      )}
      {gestiona && (rebase ? (
        <form className="mt-3 space-y-2" onSubmit={(e) => {
          e.preventDefault()
          if (motivo.trim().length >= 3) lineaBase.mutate({ id_tarea: tarea.id_tarea, motivo: motivo.trim() }, {
            onSuccess: () => { toast.success('Nueva línea base: el desfase se mide desde las fechas vigentes'); setRebase(false); setMotivo('') },
          })
        }}>
          <TextField label="Motivo de la nueva línea base" required value={motivo} onChange={(e) => setMotivo(e.target.value)}
            hint="p. ej. cambio de alcance acordado con el cliente. Queda en el historial." />
          <div className="flex gap-2">
            <Button size="sm" variant="primary" type="submit" loading={lineaBase.isPending} disabled={motivo.trim().length < 3}>Fijar</Button>
            <Button size="sm" variant="ghost" onClick={() => setRebase(false)}>Cancelar</Button>
          </div>
          <FormError error={lineaBase.error} />
        </form>
      ) : cambiada && (
        <Button size="sm" variant="ghost" className="mt-2 -ml-2" icon={<Flag className="size-4" />} onClick={() => setRebase(true)}>
          Fijar fechas vigentes como nuevo plan
        </Button>
      ))}
    </section>
  )
}
