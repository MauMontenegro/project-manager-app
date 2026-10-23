import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-xl border border-border bg-surface shadow-sm', className)}>{children}</section>
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function PageHeader({ title, description, actions, back }: {
  title: string; description?: string; actions?: ReactNode; back?: ReactNode
}) {
  return (
    <div className="mb-6">
      {back && <div className="mb-3">{back}</div>}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export function ProgressBar({ value, tone = 'brand', label }: { value: number; tone?: 'brand' | 'ok' | 'warn' | 'danger'; label: string }) {
  const pct = Math.max(0, Math.min(100, value))
  const color = { brand: 'bg-brand', ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-danger' }[tone]
  return (
    <div
      role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
  return (
    <span
      aria-hidden
      className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand', className)}
    >
      {initials}
    </span>
  )
}

export function DescriptionList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="text-xs font-medium tracking-wide text-muted uppercase">{i.label}</dt>
          <dd className="mt-1 text-sm text-fg">{i.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Tabla responsiva con scroll horizontal en móvil. */
export function Table({ children }: { children: ReactNode }) {
  return (
    // `relative`: los elementos absolutos (p. ej. `sr-only`) quedan dentro del área con scroll
    // y no ensanchan la página en móvil.
    <div className="relative overflow-x-auto">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  )
}
export const Th = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <th scope="col" className={cn('border-b border-border bg-surface-2/60 px-4 py-2.5 text-xs font-medium tracking-wide whitespace-nowrap text-muted uppercase', className)}>{children}</th>
)
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cn('border-b border-border px-4 py-3 align-middle', className)}>{children}</td>
)
