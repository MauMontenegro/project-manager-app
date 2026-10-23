import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, Search } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Capa flotante anclada a un elemento (en un portal, para que no la recorte un contenedor con scroll). Se cierra con
 * Escape, al hacer clic fuera o al desplazar la página, y devuelve el foco al ancla. */
export function Popover({ anchor, onClose, width = 240, children, label }: {
  anchor: HTMLElement; onClose: () => void; width?: number; children: ReactNode; label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect()
    const alto = ref.current?.offsetHeight ?? 240
    const abajo = r.bottom + 4 + alto <= window.innerHeight - 8 || r.top < alto + 12
    setPos({
      top: abajo ? r.bottom + 4 : r.top - alto - 4,
      left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
    })
  }, [anchor, width])

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !anchor.contains(t)) onClose()
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); anchor.focus() }
    }
    // Desplazar fuera de la capa la cerraría desalineada: mejor cerrarla.
    const scroll = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    window.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', tecla)
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', onClose)
    }
  }, [anchor, onClose])

  return createPortal(
    <div ref={ref} role="dialog" aria-label={label}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width }}
      className="animate-pop-in fixed z-[60] overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
      {children}
    </div>,
    document.body,
  )
}

export interface Opcion<T> { valor: T; label: string; contenido?: ReactNode; ayuda?: string; deshabilitada?: boolean }

/** Lista de opciones navegable con teclado (flechas, Enter, Escape) y, si son muchas, con búsqueda. */
export function MenuOpciones<T>({ anchor, opciones, actual, onElegir, onClose, label, width, buscar }: {
  anchor: HTMLElement; opciones: Opcion<T>[]; actual?: T; onElegir: (v: T) => void; onClose: () => void
  label: string; width?: number; buscar?: boolean
}) {
  const [texto, setTexto] = useState('')
  const visibles = useMemo(() => {
    const q = texto.trim().toLowerCase()
    return q ? opciones.filter((o) => o.label.toLowerCase().includes(q)) : opciones
  }, [opciones, texto])
  const [activa, setActiva] = useState(() => Math.max(0, opciones.findIndex((o) => o.valor === actual)))
  const listaRef = useRef<HTMLUListElement>(null)
  const entradaRef = useRef<HTMLInputElement>(null)

  useEffect(() => { (buscar ? entradaRef.current : listaRef.current)?.focus() }, [buscar])
  useEffect(() => { setActiva((a) => Math.min(a, Math.max(visibles.length - 1, 0))) }, [visibles.length])
  useEffect(() => { listaRef.current?.querySelector(`[data-i="${activa}"]`)?.scrollIntoView({ block: 'nearest' }) }, [activa])

  const elegir = (o: Opcion<T> | undefined) => {
    if (!o || o.deshabilitada) return
    onElegir(o.valor)
    onClose()
    anchor.focus()
  }
  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiva((a) => Math.min(a + 1, visibles.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiva((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); elegir(visibles[activa]) }
    else if (e.key === 'Tab') onClose()
  }

  return (
    <Popover anchor={anchor} onClose={onClose} width={width} label={label}>
      {buscar && (
        <div className="relative border-b border-border">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input ref={entradaRef} value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={teclas} placeholder="Buscar…"
            aria-label={`Buscar en ${label}`} aria-controls="menu-opciones" aria-activedescendant={visibles[activa] ? `op-${activa}` : undefined}
            className="h-9 w-full bg-transparent pr-2 pl-8 text-sm focus:outline-none" />
        </div>
      )}
      <ul ref={listaRef} id="menu-opciones" role="listbox" aria-label={label} tabIndex={buscar ? -1 : 0} onKeyDown={buscar ? undefined : teclas}
        aria-activedescendant={buscar ? undefined : visibles[activa] ? `op-${activa}` : undefined}
        className="max-h-64 overflow-y-auto p-1 focus:outline-none">
        {visibles.length === 0 && <li className="px-2.5 py-2 text-sm text-muted">Sin coincidencias</li>}
        {visibles.map((o, i) => (
          <li key={String(o.valor)} id={`op-${i}`} data-i={i} role="option" aria-selected={o.valor === actual} aria-disabled={o.deshabilitada}
            onMouseEnter={() => setActiva(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(o)}
            className={cn('flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm',
              i === activa && 'bg-surface-2', o.deshabilitada && 'cursor-not-allowed opacity-50')}>
            <span className="min-w-0 flex-1">
              {o.contenido ?? <span className="block truncate">{o.label}</span>}
              {o.ayuda && <span className="block truncate text-xs text-muted">{o.ayuda}</span>}
            </span>
            {o.valor === actual && <Check className="size-4 shrink-0 text-brand" aria-hidden />}
          </li>
        ))}
      </ul>
    </Popover>
  )
}
