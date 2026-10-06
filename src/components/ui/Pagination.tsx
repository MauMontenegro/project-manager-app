import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'

export function Pagination({ total, limit, offset, onChange }: {
  total: number; limit: number; offset: number; onChange: (offset: number) => void
}) {
  if (total <= limit) return null
  const from = offset + 1
  const to = Math.min(offset + limit, total)
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
      <p className="text-sm text-muted">
        <span className="font-medium text-fg">{from}–{to}</span> de <span className="font-medium text-fg">{total}</span>
      </p>
      <div className="flex gap-2">
        <Button size="sm" icon={<ChevronLeft className="size-4" />} disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>Anterior</Button>
        <Button size="sm" disabled={to >= total} onClick={() => onChange(offset + limit)}>
          Siguiente <ChevronRight className="size-4" />
        </Button>
      </div>
    </nav>
  )
}
