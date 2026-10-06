import { cn } from '@/lib/cn'

export interface TabDef<T extends string> { id: T; label: string; count?: number }

export function Tabs<T extends string>({ tabs, value, onChange, label }: {
  tabs: TabDef<T>[]; value: T; onChange: (id: T) => void; label: string
}) {
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
    onChange(next.id)
    document.getElementById(`tab-${next.id}`)?.focus()
  }
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t, i) => {
        const active = t.id === value
        return (
          <button
            key={t.id} id={`tab-${t.id}`} role="tab" aria-selected={active} aria-controls={`panel-${t.id}`}
            tabIndex={active ? 0 : -1} onClick={() => onChange(t.id)} onKeyDown={(e) => onKey(e, i)}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
              active ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-fg',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn('rounded-full px-1.5 py-px text-xs', active ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-muted')}>{t.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
