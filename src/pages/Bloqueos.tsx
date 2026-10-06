import { useMemo, useState } from 'react'
import { AlertOctagon, Plus, X } from 'lucide-react'
import { useBloqueos, useProyectos } from '@/api/hooks'
import { useEtapaMap } from '@/api/lookups'
import { Button } from '@/components/ui/Button'
import { FilterSelect } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Card, PageHeader } from '@/components/ui/Layout'
import { BloqueoFormModal } from '@/features/bloqueos/BloqueoFormModal'
import { BloqueosTable } from '@/features/bloqueos/BloqueosTable'
import { CAUSAS_RAIZ, RESPONSABLES_ORIGEN, type BloqueosFiltro, type CausaRaiz, type ResponsableOrigen } from '@/types/api'

const LIMIT = 20

export default function Bloqueos() {
  const [estado, setEstado] = useState<'abiertos' | 'cerrados' | ''>('abiertos')
  const [causa, setCausa] = useState('')
  const [origen, setOrigen] = useState('')
  const [proyecto, setProyecto] = useState('')
  const [offset, setOffset] = useState(0)
  const [creating, setCreating] = useState(false)

  const filtro: BloqueosFiltro = {
    limit: LIMIT, offset,
    abierto: estado === '' ? undefined : estado === 'abiertos',
    causa_raiz: (causa || undefined) as CausaRaiz | undefined,
    responsable_origen: (origen || undefined) as ResponsableOrigen | undefined,
    id_proyecto: proyecto ? Number(proyecto) : undefined,
  }
  const q = useBloqueos(filtro)
  const proyectos = useProyectos({ limit: 200 })
  const nombres = useMemo(() => new Map(proyectos.data?.items.map((p) => [p.id_proyecto, p.nombre_proyecto])), [proyectos.data])
  const etapas = useEtapaMap(q.data?.map((b) => b.id_proyecto) ?? [])

  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setOffset(0) }
  const hasFilters = !!(causa || origen || proyecto) || estado !== 'abiertos'
  const clear = () => { setEstado('abiertos'); setCausa(''); setOrigen(''); setProyecto(''); setOffset(0) }

  return (
    <>
      <PageHeader title="Bloqueos" description="Interrupciones que afectan el avance de las etapas."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Reportar bloqueo</Button>} />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
          <FilterSelect label="Estado del bloqueo" value={estado} onChange={reset((v) => setEstado(v as typeof estado))}>
            <option value="abiertos">Abiertos</option>
            <option value="cerrados">Resueltos</option>
            <option value="">Todos</option>
          </FilterSelect>
          <FilterSelect label="Proyecto" value={proyecto} onChange={reset(setProyecto)}>
            <option value="">Todos los proyectos</option>
            {proyectos.data?.items.map((p) => <option key={p.id_proyecto} value={p.id_proyecto}>{p.nombre_proyecto}</option>)}
          </FilterSelect>
          <FilterSelect label="Causa raíz" value={causa} onChange={reset(setCausa)}>
            <option value="">Todas las causas</option>
            {CAUSAS_RAIZ.map((c) => <option key={c}>{c}</option>)}
          </FilterSelect>
          <FilterSelect label="Responsable de origen" value={origen} onChange={reset(setOrigen)}>
            <option value="">Todos los orígenes</option>
            {RESPONSABLES_ORIGEN.map((r) => <option key={r}>{r}</option>)}
          </FilterSelect>
          {hasFilters && <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={clear}>Restablecer</Button>}
        </div>

        {q.isPending ? (
          <div className="space-y-3 p-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.data.length === 0 && offset === 0 ? (
          <EmptyState icon={<AlertOctagon className="size-6" />} title="No hay bloqueos con estos filtros"
            description={estado === 'abiertos' ? 'No hay interrupciones activas. ¡Buen trabajo!' : 'Prueba ajustando los filtros.'} />
        ) : (
          <>
            <BloqueosTable bloqueos={q.data} etapas={etapas} dimmed={q.isPlaceholderData}
              proyectoNombre={(id) => nombres.get(id) ?? `Proyecto #${id}`} />
            {/* La API no devuelve total en este listado: se pagina con anterior/siguiente. */}
            {(offset > 0 || q.data.length === LIMIT) && (
              <nav aria-label="Paginación" className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                <p className="text-sm text-muted">Mostrando {offset + 1}–{offset + q.data.length}</p>
                <div className="flex gap-2">
                  <Button size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>Anterior</Button>
                  <Button size="sm" disabled={q.data.length < LIMIT} onClick={() => setOffset(offset + LIMIT)}>Siguiente</Button>
                </div>
              </nav>
            )}
          </>
        )}
      </Card>

      {creating && <BloqueoFormModal onClose={() => setCreating(false)} />}
    </>
  )
}
