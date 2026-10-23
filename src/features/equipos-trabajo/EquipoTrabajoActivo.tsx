import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Settings2 } from 'lucide-react'
import { useEquiposTrabajo } from '@/api/hooks'
import { cn } from '@/lib/cn'
import type { EquipoTrabajo } from '@/types/api'

const CLAVE = 'equipoTrabajoActivo'

interface Contexto {
  /** Equipo de trabajo elegido en el selector global; `null` = todos. */
  id: number | null
  equipo: EquipoTrabajo | null
  /** Ids de sus personas (vacío si no hay equipo elegido). */
  miembros: Set<number>
  elegir: (id: number | null) => void
}

const EquipoTrabajoContext = createContext<Contexto>({ id: null, equipo: null, miembros: new Set(), elegir: () => {} })

function leer(): number | null {
  try { return Number(localStorage.getItem(CLAVE)) || null } catch { return null }
}

/** Equipo de trabajo activo para toda la app (se recuerda en este navegador). Filtra Proyectos, Panel, Bloqueos,
 * Mis tareas y Equipo. Si el equipo guardado ya no existe, vuelve a "Todos". */
export function EquipoTrabajoProvider({ children }: { children: ReactNode }) {
  const [guardado, setGuardado] = useState<number | null>(leer)
  const equipos = useEquiposTrabajo()
  const equipo = equipos.data?.find((e) => e.id_equipo_trabajo === guardado) ?? null
  // Mientras carga la lista se respeta lo guardado; ya cargada, un id inexistente cuenta como "Todos".
  const id = equipos.isSuccess && !equipo ? null : guardado
  const valor = useMemo<Contexto>(() => ({
    id, equipo,
    miembros: new Set(equipo?.miembros.map((m) => m.id_usuario)),
    elegir: (nuevo) => {
      setGuardado(nuevo)
      try { if (nuevo) localStorage.setItem(CLAVE, String(nuevo)); else localStorage.removeItem(CLAVE) } catch { /* modo privado */ }
    },
  }), [id, equipo])
  return <EquipoTrabajoContext.Provider value={valor}>{children}</EquipoTrabajoContext.Provider>
}

export const useEquipoTrabajoActivo = () => useContext(EquipoTrabajoContext)

/** Selector global (barra lateral). */
export function SelectorEquipoTrabajo({ onNavigate }: { onNavigate?: () => void }) {
  const { id, equipo, elegir } = useEquipoTrabajoActivo()
  const equipos = useEquiposTrabajo()
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-2">
      <div className="mb-1 flex items-center justify-between px-1">
        <label htmlFor="selector-equipo-trabajo" className="text-[11px] font-medium tracking-wide text-muted uppercase">Equipo de trabajo</label>
        <Link to="/equipos-trabajo" onClick={onNavigate} title="Equipos de trabajo" aria-label="Ver equipos de trabajo"
          className="rounded p-0.5 text-muted hover:bg-surface-2 hover:text-fg"><Settings2 className="size-3.5" /></Link>
      </div>
      <div className="relative">
        <span className={cn('pointer-events-none absolute top-1/2 left-2.5 size-2.5 -translate-y-1/2 rounded-full', !equipo && 'border border-muted')}
          style={equipo ? { background: equipo.color } : undefined} aria-hidden />
        <select id="selector-equipo-trabajo" value={id ?? ''} onChange={(e) => elegir(Number(e.target.value) || null)}
          className="w-full appearance-none truncate rounded-md border border-border bg-surface py-1.5 pr-7 pl-7 text-sm font-medium text-fg focus:border-brand focus:outline-none">
          <option value="">Todos los equipos</option>
          {equipos.data?.map((e) => <option key={e.id_equipo_trabajo} value={e.id_equipo_trabajo}>{e.nombre}</option>)}
        </select>
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted" aria-hidden>▾</span>
      </div>
    </div>
  )
}

/** Aviso en las páginas filtradas por el equipo activo, con opción a quitar el filtro. */
export function AvisoEquipoTrabajo({ que }: { que: string }) {
  const { equipo, elegir } = useEquipoTrabajoActivo()
  if (!equipo) return null
  return (
    <p className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-sm">
      <span className="size-2.5 rounded-full" style={{ background: equipo.color }} aria-hidden />
      <span>Mostrando {que} de <Link to={`/equipos-trabajo/${equipo.id_equipo_trabajo}`} className="font-medium hover:underline">{equipo.nombre}</Link></span>
      <button type="button" onClick={() => elegir(null)} className="ml-auto text-xs font-medium text-brand hover:underline">Ver todos</button>
    </p>
  )
}
