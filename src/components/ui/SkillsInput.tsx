import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { Field } from '@/components/ui/Field'
import { cn } from '@/lib/cn'
import { NIVEL_PUNTOS } from '@/lib/capacidad'
import { NIVELES_SKILL, type NivelSkill, type SkillAsignada } from '@/types/api'

/** Nivel como 1–3 puntos: la forma (no solo el color) comunica el nivel. */
export function NivelDots({ nivel, className }: { nivel: NivelSkill; className?: string }) {
  return (
    <span className={cn('inline-flex gap-0.5', className)} aria-label={`Nivel ${nivel}`} role="img">
      {[1, 2, 3].map((i) => (
        <span key={i} className={cn('size-1.5 rounded-full', i <= NIVEL_PUNTOS[nivel] ? 'bg-current' : 'bg-current opacity-25')} />
      ))}
    </span>
  )
}

export function SkillChip({ skill, highlight }: { skill: SkillAsignada; highlight?: boolean }) {
  return (
    <span
      title={`${skill.nombre} · ${skill.nivel}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        highlight ? 'bg-brand-soft text-brand' : 'bg-neutral-soft text-muted',
      )}
    >
      {skill.nombre}
      <NivelDots nivel={skill.nivel} />
    </span>
  )
}

const siguiente = (n: NivelSkill) => NIVELES_SKILL[(NIVELES_SKILL.indexOf(n) + 1) % NIVELES_SKILL.length]

/**
 * Captura de skills con nivel. Enter o coma agrega (Intermedio por defecto); clic en los
 * puntos cambia el nivel; Retroceso con el campo vacío quita el último.
 */
export function SkillsInput({ label, value, onChange, suggestions = [], hint, error }: {
  label: string
  value: SkillAsignada[]
  onChange: (skills: SkillAsignada[]) => void
  suggestions?: string[]
  hint?: string
  error?: string
}) {
  const [draft, setDraft] = useState('')
  const has = (n: string) => value.some((s) => s.nombre.toLowerCase() === n.toLowerCase())

  const add = (raw: string) => {
    const nombre = raw.trim()
    if (nombre && !has(nombre)) {
      // Respeta la grafía del catálogo si ya existe ("react" → "React").
      const canonico = suggestions.find((s) => s.toLowerCase() === nombre.toLowerCase()) ?? nombre
      onChange([...value, { nombre: canonico, nivel: 'Intermedio' }])
    }
    setDraft('')
  }
  const remove = (nombre: string) => onChange(value.filter((s) => s.nombre !== nombre))
  const cycle = (nombre: string) => onChange(value.map((s) => (s.nombre === nombre ? { ...s, nivel: siguiente(s.nivel) } : s)))

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(draft)
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      remove(value[value.length - 1].nombre)
    }
  }

  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <div
          className={cn(
            'flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-2 py-1.5 text-sm',
            'transition-shadow focus-within:border-brand focus-within:ring-4 focus-within:ring-[var(--ring)]',
            invalid && 'border-danger',
          )}
        >
          {value.map((s) => (
            <span key={s.nombre} className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-0.5 pr-1 pl-2.5 text-xs font-medium text-brand">
              {s.nombre}
              <button type="button" onClick={() => cycle(s.nombre)} title={`${s.nivel} · clic para cambiar`}
                aria-label={`Nivel de ${s.nombre}: ${s.nivel}. Cambiar nivel`}
                className="ml-0.5 flex items-center gap-1 rounded-full px-1 py-0.5 hover:bg-brand/15 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
                <NivelDots nivel={s.nivel} />
              </button>
              <button type="button" aria-label={`Quitar ${s.nombre}`} onClick={() => remove(s.nombre)}
                className="rounded-full p-0.5 hover:bg-brand/15 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            id={id} aria-invalid={invalid} aria-describedby={describedBy} list={`${id}-sugerencias`}
            value={draft} maxLength={50} placeholder={value.length === 0 ? 'Ej.: Python, Redes, ITIL…' : undefined}
            onChange={(e) => {
              // Elegir una sugerencia del datalist llega como cambio de valor completo.
              const v = e.target.value
              if (suggestions.includes(v) && v.length - draft.length > 1) add(v)
              else setDraft(v)
            }}
            onKeyDown={onKeyDown}
            onBlur={() => add(draft)}
            className="h-7 min-w-32 flex-1 bg-transparent px-1 text-fg placeholder:text-muted/70 focus:outline-none"
          />
          <datalist id={`${id}-sugerencias`}>
            {suggestions.filter((s) => !has(s)).map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
      )}
    </Field>
  )
}
