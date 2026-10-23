import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Network } from 'lucide-react'
import { usePuestos, useUsuarios } from '@/api/hooks'
import { Badge } from '@/components/ui/Badge'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Card } from '@/components/ui/Layout'
import { UtilizacionBar } from '@/components/ui/Utilizacion'
import { cn } from '@/lib/cn'
import type { CapacidadPersona, Rol, Usuario } from '@/types/api'
import { RecursoAvatar } from './RecursoAvatar'

interface Nodo { persona: Usuario; hijos: Nodo[] }

const PESO_ROL: Record<Rol, number> = { Administrador: 0, Gerente: 1, Líder: 2, Usuario: 3 }
const ordenar = (a: Nodo, b: Nodo) =>
  PESO_ROL[a.persona.rol] - PESO_ROL[b.persona.rol] || b.hijos.length - a.hijos.length || a.persona.nombre.localeCompare(b.persona.nombre)

/** Árbol a partir de «reporta a». Quien no reporta a nadie activo queda como raíz. */
function construirArbol(personas: Usuario[]): Nodo[] {
  const nodos = new Map(personas.map((p) => [p.id_usuario, { persona: p, hijos: [] as Nodo[] }]))
  const raices: Nodo[] = []
  for (const nodo of nodos.values()) {
    const jefe = nodo.persona.id_jefe ? nodos.get(nodo.persona.id_jefe) : undefined
    if (jefe) jefe.hijos.push(nodo)
    else raices.push(nodo)
  }
  const ordenarRec = (lista: Nodo[]) => { lista.sort(ordenar); lista.forEach((n) => ordenarRec(n.hijos)) }
  ordenarRec(raices)
  return raices
}

const contar = (n: Nodo): number => n.hijos.reduce((acc, h) => acc + 1 + contar(h), 0)

export function OrganigramaTab({ capacidad }: { capacidad: Map<number, CapacidadPersona> }) {
  const usuarios = useUsuarios({ activo: true })
  const puestos = usePuestos()
  const puestoNombre = new Map(puestos.data?.map((p) => [p.id_puesto, p.nombre_puesto]))
  const raices = useMemo(
    () => construirArbol((usuarios.data ?? []).filter((u) => u.tipo_recurso !== 'Activo')),
    [usuarios.data],
  )
  const sinJefe = raices.filter((r) => r.hijos.length === 0 && r.persona.rol === 'Usuario')
  const cabezas = raices.filter((r) => !sinJefe.includes(r))

  if (usuarios.isPending) return <Card className="space-y-3 p-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}</Card>
  if (usuarios.isError) return <Card><ErrorState error={usuarios.error} onRetry={() => usuarios.refetch()} /></Card>
  if (raices.length === 0) return <Card><EmptyState icon={<Network className="size-6" />} title="Sin personas activas" /></Card>

  const rama = (nodo: Nodo, nivel: number) => (
    <Rama key={nodo.persona.id_usuario} nodo={nodo} nivel={nivel} capacidad={capacidad} puestoNombre={puestoNombre} render={rama} />
  )

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <ul role="tree" aria-label="Organigrama de la DTI" className="space-y-1">{cabezas.map((n) => rama(n, 0))}</ul>
      </Card>
      {sinJefe.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-fg">Sin jefe asignado</h2>
          <p className="mt-0.5 mb-3 text-xs text-muted">Edita a estas personas e indica a quién reportan para completar la estructura.</p>
          <ul role="tree" aria-label="Personas sin jefe" className="grid gap-1 sm:grid-cols-2">{sinJefe.map((n) => rama(n, 0))}</ul>
        </Card>
      )}
    </div>
  )
}

function Rama({ nodo, nivel, capacidad, puestoNombre, render }: {
  nodo: Nodo
  nivel: number
  capacidad: Map<number, CapacidadPersona>
  puestoNombre: Map<number, string>
  render: (n: Nodo, nivel: number) => React.ReactNode
}) {
  const [abierto, setAbierto] = useState(nivel < 2)
  const { persona, hijos } = nodo
  const total = contar(nodo)
  return (
    <li role="treeitem" aria-expanded={hijos.length ? abierto : undefined} aria-selected={false}>
      <div className="group flex items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-surface-2/60">
        {hijos.length > 0 ? (
          <button type="button" onClick={() => setAbierto((a) => !a)} aria-label={abierto ? `Contraer equipo de ${persona.nombre}` : `Expandir equipo de ${persona.nombre}`}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
            <ChevronDown className={cn('size-4 transition-transform', !abierto && '-rotate-90')} />
          </button>
        ) : <span className="size-6 shrink-0" />}
        <RecursoAvatar usuario={persona} className={cn(persona.rol !== 'Usuario' && 'ring-2 ring-brand/40')} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link to={`/equipo/${persona.id_usuario}`} className="truncate text-sm font-medium text-fg hover:text-brand hover:underline">{persona.nombre}</Link>
            {persona.rol !== 'Usuario' && <Badge tone="brand">{persona.rol}</Badge>}
            {persona.tipo_recurso === 'Externo' && <Badge tone="warn">Externo</Badge>}
          </div>
          <p className="truncate text-xs text-muted">
            {(persona.id_puesto && puestoNombre.get(persona.id_puesto)) || '—'} · {persona.departamento ?? 'Sin departamento'}
            {total > 0 && ` · ${total} ${total === 1 ? 'persona' : 'personas'} a cargo`}
          </p>
        </div>
        <UtilizacionBar semana={capacidad.get(persona.id_usuario)?.semanas[0]} className="hidden w-36 shrink-0 sm:flex" />
      </div>
      {hijos.length > 0 && abierto && (
        <ul role="group" className="ml-[1.1rem] space-y-1 border-l border-border pl-4">{hijos.map((h) => render(h, nivel + 1))}</ul>
      )}
    </li>
  )
}
