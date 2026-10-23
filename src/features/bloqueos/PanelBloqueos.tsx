import { Link } from 'react-router-dom'
import { AlertOctagon, CalendarClock, Hourglass, TimerReset } from 'lucide-react'
import { useResumenBloqueos } from '@/api/hooks'
import { ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Card, CardHeader } from '@/components/ui/Layout'
import { cn } from '@/lib/cn'
import { formatDate, formatNumber, num } from '@/lib/format'
import type { DepartamentoProyecto, ResumenBloqueos } from '@/types/api'
import { formatDesfase, formatDiasHabiles } from './tiempo'

/** Seguimiento de bloqueos y desfases de un proyecto (un conjunto, con sus subproyectos), un departamento o todo el
 * portafolio: indicadores, por qué y de quién dependen los bloqueos, de dónde sale el desfase y las tareas más atrasadas. */
export function PanelBloqueos({ idProyecto, departamento, idEquipoTrabajo, porProyecto }: {
  idProyecto?: number
  departamento?: DepartamentoProyecto
  idEquipoTrabajo?: number
  /** Muestra el reparto por proyecto (vista de portafolio o de conjunto). */
  porProyecto?: boolean
}) {
  const q = useResumenBloqueos({ id_proyecto: idProyecto, departamento, id_equipo_trabajo: idEquipoTrabajo })
  if (q.isPending) return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
  if (q.isError) return <Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>
  const r = q.data
  const sinDatos = r.bloqueos_periodo === 0 && r.desfase.total === 0

  return (
    <div className={cn('space-y-4', q.isPlaceholderData && 'opacity-60 transition-opacity')}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador icono={AlertOctagon} titulo="Bloqueos abiertos" valor={String(r.abiertos)} alerta={r.abiertos > 0}
          detalle={[
            r.tareas_bloqueadas ? `${r.tareas_bloqueadas} tarea(s) detenida(s)` : 'Ninguna tarea detenida',
            r.abiertos_automaticos ? `${r.abiertos_automaticos} por dependencias` : null,
            r.compromisos_vencidos ? `${r.compromisos_vencidos} con compromiso vencido` : null,
          ]} />
        <Indicador icono={Hourglass} titulo="Tiempo bloqueado" valor={formatDiasHabiles(r.dias_bloqueo)}
          detalle={[`${formatNumber(r.horas_bloqueo, 1)} h hábiles · ${r.bloqueos_periodo} bloqueo(s)`, 'Suma por tarea; bloqueos simultáneos de una tarea cuentan una vez']} />
        <Indicador icono={TimerReset} titulo="Resolución promedio"
          valor={r.promedio_resolucion_dias == null ? '—' : formatDiasHabiles(r.promedio_resolucion_dias)}
          detalle={['De los bloqueos ya resueltos']} />
        <Indicador icono={CalendarClock} titulo="Desfase acumulado" valor={r.desfase.total ? `+${r.desfase.total} días hábiles` : 'En tiempo'}
          alerta={r.desfase.total > 0}
          detalle={[`${r.tareas_con_desfase.length} tarea(s) con atraso vs. su plan original`]} />
      </div>

      {sinDatos ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          Sin bloqueos ni desfases registrados. Cuando una tarea se bloquee o se retrase su fecha límite, aquí verás por qué y cuánto tiempo costó.
        </p>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title="¿Por qué se bloquea?" subtitle="Días hábiles por causa" />
              <Barras vacio="Sin bloqueos." items={r.por_causa.map((c) => ({
                etiqueta: c.clave, valor: num(c.dias), texto: formatDiasHabiles(c.dias, true), detalle: `${c.bloqueos} bloqueo(s)`,
              }))} />
            </Card>
            <Card>
              <CardHeader title="¿De quién depende?" subtitle="Días hábiles por origen del bloqueo" />
              <Barras vacio="Sin bloqueos." items={r.por_origen.map((c) => ({
                etiqueta: c.clave, valor: num(c.dias), texto: formatDiasHabiles(c.dias, true), detalle: `${c.bloqueos} bloqueo(s)`,
              }))} />
            </Card>
            <Card>
              <CardHeader title="¿De dónde sale el desfase?" subtitle={`${r.desfase.total} días hábiles de atraso vs. plan original`} />
              <Desglose r={r} />
            </Card>
          </div>

          {r.tareas_con_desfase.length > 0 && (
            <Card>
              <CardHeader title="Tareas más atrasadas" subtitle="Fecha límite original contra la real (o la vigente / hoy, si sigue abierta)" />
              <ul className="divide-y divide-border">
                {r.tareas_con_desfase.map((t) => (
                  <li key={t.id_tarea} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <Link to={`/proyectos/${t.id_proyecto}?tarea=${t.id_tarea}`} className="block truncate font-medium hover:text-brand hover:underline">{t.titulo}</Link>
                      <p className="truncate text-xs text-muted">{porProyecto && `${t.nombre_proyecto} · `}{t.nombre_usuario} · {t.estado}</p>
                    </div>
                    <span className="text-xs text-muted tabular-nums">{formatDate(t.fecha_fin_base)} → {formatDate(t.fecha_fin)}</span>
                    {num(t.dias_bloqueada) > 0 && <span className="text-xs text-muted tabular-nums">{formatDiasHabiles(t.dias_bloqueada, true)} bloqueada</span>}
                    <span className="w-14 text-right font-semibold text-danger tabular-nums">{formatDesfase(t.desfase_dias)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {porProyecto && r.por_proyecto.length > 0 && (
            <Card>
              <CardHeader title="Por proyecto" subtitle="Días hábiles bloqueados y desfase acumulado" />
              <ul className="divide-y divide-border">
                {r.por_proyecto.map((p) => (
                  <li key={p.id_proyecto} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm">
                    <Link to={`/proyectos/${p.id_proyecto}?tab=bloqueos`} className="min-w-0 flex-1 truncate font-medium hover:text-brand hover:underline">{p.nombre_proyecto}</Link>
                    {p.abiertos > 0 && <span className="text-xs font-medium text-danger">{p.abiertos} abierto(s)</span>}
                    <span className="w-24 text-right text-xs text-muted tabular-nums">{formatDiasHabiles(p.dias, true)} bloqueado</span>
                    <span className={cn('w-14 text-right font-semibold tabular-nums', p.desfase_dias > 0 ? 'text-danger' : 'text-muted')}>{formatDesfase(p.desfase_dias)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function Indicador({ icono: Icono, titulo, valor, detalle, alerta }: {
  icono: typeof AlertOctagon; titulo: string; valor: string; detalle: (string | null)[]; alerta?: boolean
}) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted"><Icono className={cn('size-4', alerta && 'text-danger')} aria-hidden />{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
      {detalle.filter(Boolean).map((d) => <p key={d} className="text-xs text-muted">{d}</p>)}
    </Card>
  )
}

/** Barras horizontales de una sola serie (un solo color), ordenadas de mayor a menor, con el valor a la derecha. */
function Barras({ items, vacio }: { items: { etiqueta: string; valor: number; texto: string; detalle?: string; tono?: string }[]; vacio: string }) {
  if (!items.length) return <p className="px-5 py-6 text-sm text-muted">{vacio}</p>
  const max = Math.max(...items.map((i) => Math.abs(i.valor)), 0.01)
  return (
    <ul className="space-y-2.5 px-5 py-4">
      {items.map((i) => (
        <li key={i.etiqueta} title={`${i.etiqueta}: ${i.texto}${i.detalle ? ` · ${i.detalle}` : ''}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{i.etiqueta}</span>
            <span className="shrink-0 font-medium tabular-nums">{i.texto}{i.detalle && <span className="ml-1.5 text-xs font-normal text-muted">{i.detalle}</span>}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div className={cn('h-full rounded-full', i.tono ?? 'bg-brand')} style={{ width: `${Math.max((Math.abs(i.valor) / max) * 100, i.valor ? 2 : 0)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Desfase = reprogramaciones por bloqueo (por origen) + reprogramaciones sin bloqueo + ejecución (término vs. fecha vigente). */
function Desglose({ r }: { r: ResumenBloqueos }) {
  const d = r.desfase
  const items = [
    ...d.por_bloqueo.map((b) => ({ etiqueta: `Reprogramado por bloqueo · ${b.clave}`, valor: num(b.dias), texto: `${num(b.dias)} d`, detalle: `${b.bloqueos} cambio(s)` })),
    ...(d.reprogramado_sin_bloqueo ? [{ etiqueta: 'Reprogramado sin bloqueo', valor: d.reprogramado_sin_bloqueo, texto: `${d.reprogramado_sin_bloqueo} d`, detalle: 'estimación u otros motivos' }] : []),
    ...(d.ejecucion ? [{
      etiqueta: d.ejecucion > 0 ? 'Fuera de la fecha vigente' : 'Adelanto vs. fecha vigente', valor: d.ejecucion,
      texto: `${d.ejecucion > 0 ? '' : '−'}${Math.abs(d.ejecucion)} d`, detalle: d.ejecucion > 0 ? 'vencidas o terminadas tarde' : 'terminaron antes',
      tono: d.ejecucion > 0 ? 'bg-brand' : 'bg-ok',
    }] : []),
  ]
  return <Barras vacio="Sin desfases: las tareas van según su plan original." items={items} />
}
