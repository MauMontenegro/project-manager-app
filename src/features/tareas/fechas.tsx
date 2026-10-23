import { useConfiguracion } from '@/api/hooks'
import { formatDate, formatHours, todayISO } from '@/lib/format'
import type { EstadoTarea, Tarea } from '@/types/api'

/** Fechas como número de día (UTC) para hacer aritmética sin desfases de zona horaria. */
const MS_DIA = 86_400_000
export const aDia = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d) / MS_DIA
}
export const fechaDe = (dia: number) => new Date(dia * MS_DIA)
/** 0 = domingo … 6 = sábado. */
export const diaSemana = (dia: number) => fechaDe(dia).getUTCDay()
export const hoyDia = () => aDia(todayISO())

/** [inicio, fin] de la tarea en días. Con una sola fecha dura un día; sin fechas, `null`. */
export function rangoTarea(t: Pick<Tarea, 'fecha_inicio' | 'fecha_fin'>): [number, number] | null {
  const a = t.fecha_inicio ?? t.fecha_fin
  const b = t.fecha_fin ?? t.fecha_inicio
  return a && b ? [aDia(a), aDia(b)] : null
}

/** "octubre de 2026" → "Octubre de 2026". */
export const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Periodo de una tarea recurrente: "21/10/2026", "Semana del 19/10/2026" u "Octubre de 2026". */
export function textoPeriodo(t: Pick<Tarea, 'frecuencia' | 'periodo' | 'fecha_inicio'>): string {
  if (!t.periodo) return ''
  if (t.frecuencia === 'Semanal') return `Semana del ${formatDate(t.periodo)}`
  if (t.frecuencia === 'Mensual') {
    return mayuscula(fechaDe(aDia(t.periodo)).toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }))
  }
  return formatDate(t.periodo)
}

/** De dónde viene la tarea: "Proyecto · 2. Diseño" (un subproyecto ya lleva su departamento en el nombre),
 * "Proyecto · General" si es propia de un conjunto, o "Semanal · Semana del 19/10/2026". */
export const origenTarea = (t: Tarea) => t.id_proyecto != null
  ? `${t.nombre_proyecto} · ${t.orden_etapa != null ? `${t.orden_etapa}. ${t.nombre_etapa}` : 'General'}`
  : `${t.frecuencia} · ${textoPeriodo(t)}`

export const vencida = (t: Tarea) => t.estado !== 'Finalizado' && !!t.fecha_fin && t.fecha_fin < todayISO()

/** Color sólido por estado, legible en tema claro y oscuro (mismo en kanban, cronograma y calendario). */
export const tonoBarra: Record<EstadoTarea, string> = {
  Pendiente: 'bg-slate-300 text-slate-900 dark:bg-slate-500 dark:text-white',
  'En progreso': 'bg-blue-500 text-white',
  'En revisión': 'bg-amber-400 text-amber-950',
  Finalizado: 'bg-emerald-500 text-white dark:bg-emerald-600',
}
/** Punto de color del estado (columnas del kanban, filas del cronograma). */
export const puntoEstado: Record<EstadoTarea, string> = {
  Pendiente: 'bg-slate-400', 'En progreso': 'bg-blue-500', 'En revisión': 'bg-amber-400', Finalizado: 'bg-emerald-500',
}

export const resumenTarea = (t: Tarea) =>
  [t.titulo, t.nombre_usuario, formatHours(t.horas_asignadas),
    t.fecha_inicio || t.fecha_fin ? `${formatDate(t.fecha_inicio)} → ${formatDate(t.fecha_fin)}` : 'Sin fechas',
    t.estado + (vencida(t) ? ' · vencida' : '') + (t.bloqueada ? ' · espera dependencias' : '')].join(' · ')

/** Domingos y días desactivados en Configuración. */
export function useDiaInhabil() {
  const config = useConfiguracion()
  const inactivos = new Set(config.data?.dias_inactivos.map(aDia))
  return (dia: number) => diaSemana(dia) === 0 || inactivos.has(dia)
}

export function LeyendaEstados() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Leyenda de estados">
      {(Object.keys(tonoBarra) as EstadoTarea[]).map((e) => (
        <li key={e} className="flex items-center gap-1.5"><span className={`size-3 rounded-sm ${tonoBarra[e]}`} aria-hidden />{e}</li>
      ))}
      <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm ring-2 ring-red-500" aria-hidden />Vencida</li>
    </ul>
  )
}
