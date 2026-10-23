import { formatNumber, num } from '@/lib/format'

/** "2.5 días háb." — el tiempo de bloqueo y el desfase se cuentan en días hábiles del calendario laboral. */
export function formatDiasHabiles(value: string | number | null | undefined, corto = false): string {
  const n = num(value)
  if (corto) return `${formatNumber(n, 1)} d`
  return `${formatNumber(n, 1)} ${n === 1 ? 'día hábil' : 'días hábiles'}`
}

/** "+3 d" / "−2 d" / "En tiempo". */
export function formatDesfase(dias: number | null | undefined): string {
  if (!dias) return 'En tiempo'
  return `${dias > 0 ? '+' : '−'}${Math.abs(dias)} d`
}
