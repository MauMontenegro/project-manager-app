import { useId, useMemo, useRef, useState } from 'react'
import { Avatar } from '@/components/ui/Layout'
import { cn } from '@/lib/cn'
import type { Involucrado } from '@/types/api'

const sinAcentos = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Menciones del texto: personas elegidas en el autocompletado cuyo `@Nombre` sigue escrito. */
export function mencionesEnTexto(texto: string, elegidas: Map<number, string>) {
  return [...elegidas].filter(([, nombre]) => texto.includes(`@${nombre}`)).map(([id]) => id)
}

/** Textarea con autocompletado de @menciones: al escribir "@" sugiere a las personas del proyecto. */
export function MencionesInput({ value, onChange, personas, elegidas, onElegir, onEnviar, disabled, placeholder }: {
  value: string
  onChange: (v: string) => void
  personas: Involucrado[]
  /** id → nombre de las personas elegidas en el autocompletado. */
  elegidas: Map<number, string>
  onElegir: (p: Involucrado) => void
  /** Ctrl/⌘ + Enter. */
  onEnviar: () => void
  disabled?: boolean
  placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const listId = useId()
  const [consulta, setConsulta] = useState<{ texto: string; desde: number } | null>(null)
  const [activo, setActivo] = useState(0)

  const sugerencias = useMemo(() => {
    if (!consulta) return []
    const q = sinAcentos(consulta.texto)
    return personas.filter((p) => sinAcentos(p.nombre).split(/\s+/).some((parte) => parte.startsWith(q)) || sinAcentos(p.nombre).startsWith(q)).slice(0, 6)
  }, [consulta, personas])

  // Detecta "@texto" justo antes del cursor (sin espacios dobles ni salto de línea).
  const detectar = (texto: string, cursor: number) => {
    const m = /(^|\s)@([\p{L}\p{N}._-]*(?: [\p{L}\p{N}._-]*)?)$/u.exec(texto.slice(0, cursor))
    setConsulta(m ? { texto: m[2], desde: cursor - m[2].length - 1 } : null)
    setActivo(0)
  }

  const elegir = (p: Involucrado) => {
    if (!consulta || !ref.current) return
    const cursor = ref.current.selectionStart
    const nuevo = `${value.slice(0, consulta.desde)}@${p.nombre} ${value.slice(cursor)}`
    onChange(nuevo)
    onElegir(p)
    setConsulta(null)
    const pos = consulta.desde + p.nombre.length + 2
    requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(pos, pos) })
  }

  const abierto = sugerencias.length > 0

  return (
    <div className="relative">
      <textarea
        ref={ref} rows={3} value={value} disabled={disabled} placeholder={placeholder}
        aria-label="Comentario" role="combobox" aria-expanded={abierto} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={abierto ? `${listId}-${activo}` : undefined}
        onChange={(e) => { onChange(e.target.value); detectar(e.target.value, e.target.selectionStart) }}
        onClick={(e) => detectar(value, e.currentTarget.selectionStart)}
        onBlur={() => setTimeout(() => setConsulta(null), 150)}
        onKeyDown={(e) => {
          if (abierto) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((i) => (i + 1) % sugerencias.length); return }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((i) => (i - 1 + sugerencias.length) % sugerencias.length); return }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); elegir(sugerencias[activo]); return }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setConsulta(null); return }
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onEnviar() }
        }}
        className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted focus:border-brand focus:outline-none disabled:opacity-60"
      />
      {abierto && (
        <ul id={listId} role="listbox" aria-label="Personas del proyecto"
          className="absolute bottom-full left-0 z-10 mb-1 w-72 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
          {sugerencias.map((p, i) => (
            <li key={p.id_usuario} id={`${listId}-${i}`} role="option" aria-selected={i === activo}
              onMouseDown={(e) => { e.preventDefault(); elegir(p) }} onMouseEnter={() => setActivo(i)}
              className={cn('flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm', i === activo && 'bg-brand-soft text-brand')}>
              <Avatar name={p.nombre} className="size-6 text-[10px]" />
              <span className="truncate">{p.nombre}</span>
              {p.es_lider && <span className="ml-auto text-xs text-muted">líder</span>}
              {elegidas.has(p.id_usuario) && <span className="sr-only">(ya mencionada)</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
