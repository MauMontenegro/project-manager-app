import { cn } from '@/lib/cn'
import { BANDAS, bandaSemana, formatUtilizacion } from '@/lib/capacidad'
import { formatHours, num } from '@/lib/format'
import type { SemanaCapacidad } from '@/types/api'

const barColor = { brand: 'bg-brand', ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-danger', neutral: 'bg-muted/40' }

/** Barra compacta de carga de una semana: % + barra (topa en 100, se marca el exceso). */
export function UtilizacionBar({ semana, className }: { semana?: SemanaCapacidad; className?: string }) {
  if (!semana) return <span className="text-muted">—</span>
  const banda = BANDAS[bandaSemana(semana)]
  const pct = semana.utilizacion === null ? (num(semana.horas_asignadas) > 0 ? 100 : 0) : Math.min(100, num(semana.utilizacion))
  return (
    <div
      className={cn('flex min-w-28 items-center gap-2', className)}
      title={`${banda.label}\n${formatHours(semana.horas_asignadas)} asignadas de ${formatHours(semana.horas_disponibles)} disponibles${semana.dias_ausencia ? `\n${semana.dias_ausencia} día(s) de ausencia` : ''}`}
    >
      <div role="meter" aria-label="Utilización esta semana" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
        aria-valuetext={`${formatUtilizacion(semana)} · ${banda.label}`}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div className={cn('h-full rounded-full', barColor[banda.tone])} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('w-11 text-right text-xs font-medium tabular-nums', banda.tone === 'danger' ? 'text-danger' : 'text-muted')}>
        {formatUtilizacion(semana)}
      </span>
    </div>
  )
}
