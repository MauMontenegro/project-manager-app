import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Layers, Tag } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import type { DepartamentoProyecto, Etiqueta } from '@/types/api'

/** Colores sugeridos para etiquetas nuevas (se puede elegir cualquier otro). */
export const COLORES_ETIQUETA = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#4b5563']

/** El color va en un punto: el texto conserva el contraste en ambos temas. */
export function EtiquetaChip({ etiqueta, className }: { etiqueta: Etiqueta; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-px text-xs whitespace-nowrap text-fg', className)}>
      <span className="size-2 rounded-full" style={{ backgroundColor: etiqueta.color }} aria-hidden />
      {etiqueta.nombre}
    </span>
  )
}

export function EtiquetasList({ etiquetas, className }: { etiquetas: Etiqueta[]; className?: string }) {
  if (!etiquetas.length) return null
  return (
    <ul aria-label="Etiquetas" className={cn('flex flex-wrap gap-1', className)}>
      {etiquetas.map((e) => <li key={e.id_etiqueta}><EtiquetaChip etiqueta={e} /></li>)}
    </ul>
  )
}

export const DepartamentoBadge = ({ value }: { value: DepartamentoProyecto | null }) =>
  value ? <Badge tone="neutral">{value}</Badge> : <Badge tone="warn">Sin departamento</Badge>

export const ConjuntoBadge = () => (
  <Badge tone="info"><Layers className="size-3" aria-hidden />Conjunto</Badge>
)

/** Filtro de barra: botón que despliega las etiquetas con casillas (selección múltiple). */
export function FiltroEtiquetas({ opciones, value, onChange, vacio }: {
  opciones: Etiqueta[]
  value: number[]
  onChange: (ids: number[]) => void
  /** Qué mostrar si no hay etiquetas (p. ej. dónde crearlas). */
  vacio: ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [abierto])

  const grupos = [...new Set(opciones.map((e) => e.departamento))]
  const elegidas = opciones.filter((e) => value.includes(e.id_etiqueta))
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={abierto} aria-controls={panelId} onClick={() => setAbierto((a) => !a)}
        className={cn('inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface pr-2.5 pl-3 text-sm text-fg',
          'focus:border-brand focus:ring-4 focus:ring-[var(--ring)] focus:outline-none', value.length > 0 && 'border-brand/50 bg-brand-soft/40')}>
        <Tag className="size-4 text-muted" aria-hidden />
        {elegidas.length === 0 ? 'Todas las etiquetas' : elegidas.length === 1 ? elegidas[0].nombre : `${elegidas.length} etiquetas`}
        <ChevronDown className="size-4 text-muted" aria-hidden />
      </button>
      {abierto && (
        <div id={panelId} role="group" aria-label="Filtrar por etiquetas"
          className="absolute left-0 z-20 mt-1 max-h-80 w-64 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg">
          {opciones.length === 0 ? <div className="p-3 text-sm text-muted">{vacio}</div> : <>
            {grupos.map((d) => (
              <div key={d}>
                {grupos.length > 1 && <p className="px-2 pt-2 pb-1 text-xs font-medium text-muted">{d}</p>}
                {opciones.filter((e) => e.departamento === d).map((e) => (
                  <label key={e.id_etiqueta} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2">
                    <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={value.includes(e.id_etiqueta)}
                      onChange={() => toggle(e.id_etiqueta)} />
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: e.color }} aria-hidden />
                    <span className="truncate">{e.nombre}</span>
                  </label>
                ))}
              </div>
            ))}
            {value.length > 0 && (
              <button type="button" onClick={() => onChange([])}
                className="mt-1 w-full rounded-md border-t border-border px-2 py-1.5 text-left text-sm text-muted hover:bg-surface-2 hover:text-fg">
                Quitar filtro de etiquetas
              </button>
            )}
          </>}
        </div>
      )}
    </div>
  )
}

/** Selección múltiple de etiquetas como botones conmutables; agrupa por departamento si hay varios. */
export function EtiquetasSelector({ opciones, value, onChange, label, vacio }: {
  opciones: Etiqueta[]
  value: number[]
  onChange: (ids: number[]) => void
  label: string
  /** Texto cuando no hay opciones. */
  vacio?: string
}) {
  const grupos = [...new Set(opciones.map((e) => e.departamento))]
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  if (!opciones.length) return vacio ? <p className="text-sm text-muted">{vacio}</p> : null
  return (
    <div role="group" aria-label={label} className="space-y-2">
      {grupos.map((d) => (
        <div key={d} className="flex flex-wrap items-center gap-1.5">
          {grupos.length > 1 && <span className="mr-1 text-xs text-muted">{d}:</span>}
          {opciones.filter((e) => e.departamento === d).map((e) => {
            const activa = value.includes(e.id_etiqueta)
            return (
              <button key={e.id_etiqueta} type="button" aria-pressed={activa} onClick={() => toggle(e.id_etiqueta)}
                className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  activa ? 'border-brand bg-brand-soft text-brand' : 'border-border text-muted hover:text-fg')}>
                {activa ? <Check className="size-3" aria-hidden /> : <span className="size-2 rounded-full" style={{ backgroundColor: e.color }} aria-hidden />}
                {e.nombre}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
