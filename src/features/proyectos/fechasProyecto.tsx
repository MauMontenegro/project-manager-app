import { formatDate, num } from '@/lib/format'
import { ESTADOS_FINALES, fechaFinProyecto, type ProyectoBase, type Semaforo } from '@/types/api'
import { aDia, hoyDia } from '@/features/tareas/fechas'

export const cerrado = (p: ProyectoBase) => ESTADOS_FINALES.includes(p.estado_proyecto)

/** [inicio, fin] del proyecto en días: del inicio a la entrega (comprometida o, si no hay, tentativa); si ya
 * cerró, hasta su cierre real. Sin inicio o sin fin, `null`. */
export function rangoProyecto(p: ProyectoBase): [number, number] | null {
  const fin = (cerrado(p) && p.fecha_real_cierre) || fechaFinProyecto(p)
  if (!p.fecha_inicio || !fin) return null
  const a = aDia(p.fecha_inicio)
  return [a, Math.max(a, aDia(fin))]
}

/** Días de retraso: abierto y con la entrega ya vencida (0 si va en tiempo o no tiene entrega). */
export function diasRetraso(p: ProyectoBase): number {
  const fin = fechaFinProyecto(p)
  return !cerrado(p) && fin ? Math.max(hoyDia() - aDia(fin), 0) : 0
}

/** Color por semáforo (pista y relleno de avance); los cerrados van en gris. */
export function tonoProyecto(p: Pick<ProyectoBase, 'semaforo' | 'estado_proyecto'>): { pista: string; relleno: string; punto: string } {
  if (ESTADOS_FINALES.includes(p.estado_proyecto)) return { pista: 'bg-slate-400/25', relleno: 'bg-slate-400 dark:bg-slate-500', punto: 'bg-slate-400' }
  return TONO_SEMAFORO[p.semaforo]
}
const TONO_SEMAFORO: Record<Semaforo, { pista: string; relleno: string; punto: string }> = {
  Verde: { pista: 'bg-emerald-500/25', relleno: 'bg-emerald-500', punto: 'bg-emerald-500' },
  Amarillo: { pista: 'bg-amber-400/30', relleno: 'bg-amber-400', punto: 'bg-amber-400' },
  Rojo: { pista: 'bg-red-500/25', relleno: 'bg-red-500', punto: 'bg-red-500' },
}

export const resumenProyecto = (p: ProyectoBase) => [
  p.nombre_proyecto, p.estado_proyecto, `Semáforo ${p.semaforo}`, `Avance ${Math.round(num(p.porcentaje_avance))} %`,
  `${formatDate(p.fecha_inicio)} → ${formatDate(fechaFinProyecto(p))}`,
  ...(diasRetraso(p) ? [`${diasRetraso(p)} días de retraso`] : []),
].join(' · ')

export function LeyendaProyectos({ conAvance = true }: { conAvance?: boolean }) {
  const items = [
    { clase: TONO_SEMAFORO.Verde.punto, texto: 'En tiempo' },
    { clase: TONO_SEMAFORO.Amarillo.punto, texto: 'En riesgo' },
    { clase: TONO_SEMAFORO.Rojo.punto, texto: 'Crítico' },
    { clase: 'bg-slate-400', texto: 'Cerrado' },
  ]
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-label="Leyenda">
      {items.map((i) => <li key={i.texto} className="flex items-center gap-1.5"><span className={`size-3 rounded-sm ${i.clase}`} aria-hidden />{i.texto}</li>)}
      {conAvance && (
        <li className="flex items-center gap-1.5">
          <span className="flex h-3 w-6 overflow-hidden rounded-sm bg-emerald-500/25" aria-hidden><span className="w-1/2 bg-emerald-500" /></span>Avance
        </li>
      )}
      <li className="flex items-center gap-1.5"><span className="size-2.5 rotate-45 bg-amber-500 ring-1 ring-surface" aria-hidden />Entrega comprometida</li>
      <li className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-red-500" aria-hidden />Retraso</li>
    </ul>
  )
}
