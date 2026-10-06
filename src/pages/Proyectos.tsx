import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FolderKanban, Plus, X } from 'lucide-react'
import { useEmpresas, useProyectos, useUsuarios } from '@/api/hooks'
import { useUsuarioMap } from '@/api/lookups'
import { EstadoBadge, SemaforoBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { FilterSelect } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Card, PageHeader, Table, Td, Th } from '@/components/ui/Layout'
import { Pagination } from '@/components/ui/Pagination'
import { formatDate } from '@/lib/format'
import { ProyectoFormModal } from '@/features/proyectos/ProyectoFormModal'
import {
  ESTADOS_PROYECTO, SEMAFOROS, type EstadoProyecto, type ProyectosFiltro, type Semaforo,
} from '@/types/api'

const LIMIT = 20

export default function Proyectos() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  const semaforo = params.get('semaforo') ?? ''
  const estado = params.get('estado') ?? ''
  const empresa = params.get('empresa') ?? ''
  const lider = params.get('lider') ?? ''
  const offset = Number(params.get('offset') ?? 0)

  const filtro: ProyectosFiltro = {
    limit: LIMIT, offset,
    semaforo: (semaforo || undefined) as Semaforo | undefined,
    estado: (estado || undefined) as EstadoProyecto | undefined,
    id_empresa: empresa ? Number(empresa) : undefined,
    lider_id: lider ? Number(lider) : undefined,
  }
  const q = useProyectos(filtro)
  const empresas = useEmpresas()
  const lideres = useUsuarios({ perfil_tecnico: 'Líder' })
  const { map: usuarios } = useUsuarioMap()

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    next.delete('offset')
    setParams(next, { replace: true })
  }
  const setOffset = (o: number) => {
    const next = new URLSearchParams(params)
    if (o) next.set('offset', String(o)); else next.delete('offset')
    setParams(next, { replace: true })
  }
  const hasFilters = !!(semaforo || estado || empresa || lider)

  return (
    <>
      <PageHeader title="Proyectos" description="Portafolio completo de proyectos."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nuevo proyecto</Button>} />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
          <FilterSelect label="Filtrar por semáforo" value={semaforo} onChange={(v) => set('semaforo', v)}>
            <option value="">Todos los semáforos</option>
            {SEMAFOROS.map((s) => <option key={s}>{s}</option>)}
          </FilterSelect>
          <FilterSelect label="Filtrar por estado" value={estado} onChange={(v) => set('estado', v)}>
            <option value="">Todos los estados</option>
            {ESTADOS_PROYECTO.map((s) => <option key={s}>{s}</option>)}
          </FilterSelect>
          <FilterSelect label="Filtrar por empresa" value={empresa} onChange={(v) => set('empresa', v)}>
            <option value="">Todas las empresas</option>
            {empresas.data?.map((e) => <option key={e.id_empresa} value={e.id_empresa}>{e.nombre_empresa}</option>)}
          </FilterSelect>
          <FilterSelect label="Filtrar por líder" value={lider} onChange={(v) => set('lider', v)}>
            <option value="">Todos los líderes</option>
            {lideres.data?.map((u) => <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>)}
          </FilterSelect>
          {hasFilters && (
            <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={() => setParams({}, { replace: true })}>Limpiar</Button>
          )}
        </div>

        {q.isPending ? (
          <div className="space-y-3 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.data.items.length === 0 ? (
          <EmptyState icon={<FolderKanban className="size-6" />}
            title={hasFilters ? 'Ningún proyecto coincide' : 'Aún no hay proyectos'}
            description={hasFilters ? 'Prueba con otros filtros.' : 'Crea el primero para comenzar.'}
            action={hasFilters ? <Button onClick={() => setParams({}, { replace: true })}>Limpiar filtros</Button>
              : <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nuevo proyecto</Button>} />
        ) : (
          <>
            <Table>
              <thead>
                <tr><Th>Proyecto</Th><Th>Líder</Th><Th>Estado</Th><Th>Semáforo</Th><Th>Fecha comprometida</Th></tr>
              </thead>
              <tbody className={q.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
                {q.data.items.map((p) => (
                  <tr key={p.id_proyecto} className="cursor-pointer hover:bg-surface-2/60" onClick={() => navigate(`/proyectos/${p.id_proyecto}`)}>
                    <Td className="max-w-sm">
                      <Link to={`/proyectos/${p.id_proyecto}`} className="font-medium text-fg hover:text-brand hover:underline" onClick={(e) => e.stopPropagation()}>
                        {p.nombre_proyecto}
                      </Link>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted">{p.objetivo}</p>
                    </Td>
                    <Td className="whitespace-nowrap">{usuarios.get(p.lider_id)?.nombre ?? '—'}</Td>
                    <Td><EstadoBadge value={p.estado_proyecto} /></Td>
                    <Td><SemaforoBadge value={p.semaforo} /></Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(p.fecha_comprometida)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination total={q.data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
          </>
        )}
      </Card>

      {creating && <ProyectoFormModal onClose={() => setCreating(false)} onSaved={(p) => navigate(`/proyectos/${p.id_proyecto}`)} />}
    </>
  )
}
