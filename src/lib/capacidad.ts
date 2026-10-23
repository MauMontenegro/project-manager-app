import { num } from '@/lib/format'
import type { NivelSkill, SemanaCapacidad } from '@/types/api'

/** Bandas de utilización (estado de salud de la carga). El texto acompaña siempre al color. */
export type Banda = 'disponible' | 'saludable' | 'al-limite' | 'sobrecarga' | 'ausente'

export const BANDAS: Record<Banda, { label: string; tone: 'brand' | 'ok' | 'warn' | 'danger' | 'neutral'; cell: string }> = {
  disponible: { label: 'Disponible (< 50 %)', tone: 'brand', cell: 'bg-brand-soft text-brand' },
  saludable: { label: 'Saludable (50–85 %)', tone: 'ok', cell: 'bg-ok-soft text-ok' },
  'al-limite': { label: 'Al límite (85–100 %)', tone: 'warn', cell: 'bg-warn-soft text-warn' },
  sobrecarga: { label: 'Sobreasignado (> 100 %)', tone: 'danger', cell: 'bg-danger text-white dark:text-[#1b0b0a]' },
  ausente: { label: 'Ausente / sin capacidad', tone: 'neutral', cell: 'bg-neutral-soft text-muted' },
}

export function bandaDe(utilizacion: number | null, horasAsignadas = 0): Banda {
  if (utilizacion === null) return horasAsignadas > 0 ? 'sobrecarga' : 'ausente'
  if (utilizacion > 100) return 'sobrecarga'
  if (utilizacion >= 85) return 'al-limite'
  if (utilizacion >= 50) return 'saludable'
  return 'disponible'
}

export const bandaSemana = (s: SemanaCapacidad) =>
  bandaDe(s.utilizacion === null ? null : num(s.utilizacion), num(s.horas_asignadas))

/** Utilización como texto: "93 %", o el motivo cuando no hay horas disponibles esa semana. */
export function formatUtilizacion(s: SemanaCapacidad): string {
  if (s.utilizacion === null) return s.dias_ausencia > 0 ? 'Ausente' : num(s.horas_asignadas) > 0 ? 'Sin cap.' : '—'
  return `${Math.round(num(s.utilizacion))} %`
}

/** Semana sin nada asignado (y sin ausencia): se pinta tenue para que destaque la carga. */
export const semanaLibre = (s: SemanaCapacidad) => num(s.horas_asignadas) === 0 && s.dias_ausencia === 0

export const NIVEL_PUNTOS: Record<NivelSkill, number> = { Básico: 1, Intermedio: 2, Experto: 3 }

/** Lunes de la semana de `d` en formato YYYY-MM-DD. */
export function lunesISO(d = new Date(), semanas = 0): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7) + semanas * 7)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}

const semanaFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' })
export function formatSemana(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return semanaFmt.format(new Date(y, m - 1, d)).replace('.', '')
}
