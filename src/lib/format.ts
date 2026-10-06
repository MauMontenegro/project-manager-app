const dateFmt = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

/** Fecha `YYYY-MM-DD` sin desfase por zona horaria. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return dateFmt.format(new Date(y, m - 1, d)).replace('.', '')
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return dateTimeFmt.format(new Date(value)).replace(/\./g, '')
}

export function num(value: string | number | null | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function formatNumber(value: string | number | null | undefined, digits = 0): string {
  return num(value).toLocaleString('es-MX', { maximumFractionDigits: digits, minimumFractionDigits: 0 })
}

export function formatHours(value: string | number | null | undefined): string {
  return `${formatNumber(value, 1)} h`
}

export function formatDays(value: string | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const n = num(value)
  return `${formatNumber(n, 2)} ${n === 1 ? 'día' : 'días'}`
}

export function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** `datetime-local` (hora local) → ISO UTC con zona, requerido por el backend. */
export function localToISO(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined
}

/** ISO UTC → valor para `datetime-local`. */
export function isoToLocal(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

/** Cadena vacía → null, para campos opcionales. */
export function emptyToNull(v: string | undefined): string | null {
  return v && v.trim() !== '' ? v : null
}
