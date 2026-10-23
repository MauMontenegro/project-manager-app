import { useState } from 'react'
import { Building2, Plus, Search, Trash2, X } from 'lucide-react'
import { useAreas, useEliminarEmpresas, useEmpresas } from '@/api/hooks'
import { usePermisos } from '@/auth/AuthProvider'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState, ErrorState, FormError, Skeleton } from '@/components/ui/Feedback'
import { Card, PageHeader } from '@/components/ui/Layout'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { AreaFormModal, EmpresaFormModal } from '@/features/organizacion/OrgModals'
import { cn } from '@/lib/cn'
import type { Empresa, EmpresasEliminadas } from '@/types/api'

const sinAcentos = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export default function Organizacion() {
  const empresas = useEmpresas()
  const areas = useAreas()
  const { esAdmin } = usePermisos()
  const [newEmpresa, setNewEmpresa] = useState(false)
  const [newArea, setNewArea] = useState<{ empresa?: number } | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  const [eliminar, setEliminar] = useState<Empresa[] | null>(null)

  const q = sinAcentos(busqueda.trim())
  const visibles = (empresas.data ?? [])
    .filter((e) => !q || sinAcentos(`${e.nombre_empresa} ${e.grupo ?? ''} ${e.division ?? ''}`).includes(q))
    .sort((a, b) => a.nombre_empresa.localeCompare(b.nombre_empresa, 'es', { sensitivity: 'base' }))
  const todasMarcadas = visibles.length > 0 && visibles.every((e) => seleccion.has(e.id_empresa))
  const alternar = (id: number) => setSeleccion((s) => {
    const n = new Set(s)
    if (!n.delete(id)) n.add(id)
    return n
  })
  const marcarVisibles = () => setSeleccion((s) => {
    const n = new Set(s)
    visibles.forEach((e) => (todasMarcadas ? n.delete(e.id_empresa) : n.add(e.id_empresa)))
    return n
  })

  return (
    <>
      <PageHeader title="Organización" description="Empresas y áreas. Son la base para registrar personas y proyectos."
        actions={<>
          <Button icon={<Plus className="size-4" />} disabled={!empresas.data?.length} onClick={() => setNewArea({})}>Nueva área</Button>
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setNewEmpresa(true)}>Nueva empresa</Button>
        </>} />

      {empresas.isPending ? (
        <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
      ) : empresas.isError ? (
        <Card><ErrorState error={empresas.error} onRetry={() => empresas.refetch()} /></Card>
      ) : empresas.data.length === 0 ? (
        <Card>
          <EmptyState icon={<Building2 className="size-6" />} title="Aún no hay empresas"
            description="Crea una empresa y luego sus áreas para poder registrar personas."
            action={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setNewEmpresa(true)}>Nueva empresa</Button>} />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative w-full max-w-sm">
              <span className="sr-only">Buscar empresa</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, grupo o división…"
                className="h-9 w-full rounded-lg border border-border bg-surface pr-3 pl-9 text-sm placeholder:text-muted focus:border-brand focus:outline-none" />
            </label>
            <span className="text-sm text-muted">{visibles.length} de {empresas.data.length} empresas</span>
            {esAdmin && visibles.length > 0 && (
              <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={todasMarcadas} onChange={marcarVisibles} />
                {busqueda ? 'Seleccionar resultados' : 'Seleccionar todas'}
              </label>
            )}
          </div>

          {esAdmin && seleccion.size > 0 && (
            <div className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-brand/40 bg-brand-soft px-4 py-2.5 shadow-sm">
              <span className="text-sm font-medium text-brand">{seleccion.size} seleccionada(s)</span>
              <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={() => setSeleccion(new Set())}>Quitar selección</Button>
              <Button size="sm" variant="danger" className="ml-auto" icon={<Trash2 className="size-4" />}
                onClick={() => setEliminar(empresas.data.filter((e) => seleccion.has(e.id_empresa)))}>Eliminar seleccionadas</Button>
            </div>
          )}

          {visibles.length === 0 ? (
            <Card><EmptyState icon={<Search className="size-6" />} title="Sin resultados" description={`Ninguna empresa coincide con “${busqueda}”.`} /></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visibles.map((e) => {
                const propias = areas.data?.filter((a) => a.id_empresa === e.id_empresa) ?? []
                const marcada = seleccion.has(e.id_empresa)
                return (
                  <Card key={e.id_empresa} className={cn('flex flex-col p-5 transition-colors', marcada && 'border-brand ring-1 ring-brand')}>
                    <div className="flex items-start gap-3">
                      {esAdmin && (
                        <input type="checkbox" className="mt-1 size-4 shrink-0 cursor-pointer accent-[var(--brand)]" checked={marcada}
                          onChange={() => alternar(e.id_empresa)} aria-label={`Seleccionar ${e.nombre_empresa}`} />
                      )}
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate font-semibold">{e.nombre_empresa}</h2>
                        <p className="mt-0.5 text-sm text-muted">{[e.grupo, e.division].filter(Boolean).join(' · ') || 'Sin grupo ni división'}</p>
                      </div>
                      {!e.activo && <Badge>Inactiva</Badge>}
                      {esAdmin && (
                        <IconButton label={`Eliminar ${e.nombre_empresa}`} className="-m-1.5 size-8 text-muted hover:text-danger" onClick={() => setEliminar([e])}>
                          <Trash2 className="size-4" />
                        </IconButton>
                      )}
                    </div>
                    <div className="mt-4 flex-1">
                      <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Áreas ({propias.length})</p>
                      {propias.length ? (
                        <ul className="flex flex-wrap gap-2">
                          {propias.map((a) => (
                            <li key={a.id_area} className="rounded-lg border border-border bg-surface-2/60 px-2.5 py-1.5 text-sm">
                              {a.nombre_area} <span className="ml-1 text-xs text-muted">{a.codigo_area}</span>
                            </li>
                          ))}
                        </ul>
                      ) : <p className="text-sm text-muted">Sin áreas registradas.</p>}
                    </div>
                    <Button size="sm" className="mt-4 self-start" icon={<Plus className="size-4" />} onClick={() => setNewArea({ empresa: e.id_empresa })}>Agregar área</Button>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {newEmpresa && <EmpresaFormModal onClose={() => setNewEmpresa(false)} />}
      {newArea && empresas.data && <AreaFormModal empresas={empresas.data} defaultEmpresa={newArea.empresa} onClose={() => setNewArea(null)} />}
      {eliminar && (
        <EliminarEmpresasDialog empresas={eliminar} numAreas={(id) => areas.data?.filter((a) => a.id_empresa === id).length ?? 0}
          onClose={() => setEliminar(null)}
          onEliminadas={(ids) => setSeleccion((s) => new Set([...s].filter((id) => !ids.includes(id))))} />
      )}
    </>
  )
}

/** Confirma la eliminación y, al terminar, muestra cuáles no se pudieron eliminar y por qué. */
function EliminarEmpresasDialog({ empresas, numAreas, onClose, onEliminadas }: {
  empresas: Empresa[]
  numAreas: (id: number) => number
  onClose: () => void
  onEliminadas: (ids: number[]) => void
}) {
  const toast = useToast()
  const mutation = useEliminarEmpresas()
  const [resultado, setResultado] = useState<EmpresasEliminadas | null>(null)
  const areasTotales = empresas.reduce((n, e) => n + numAreas(e.id_empresa), 0)
  const una = empresas.length === 1

  const confirmar = () => mutation.mutate(empresas.map((e) => e.id_empresa), {
    onSuccess: (r) => {
      onEliminadas(r.eliminadas)
      if (r.no_eliminadas.length === 0) {
        toast.success(una ? `“${empresas[0].nombre_empresa}” eliminada` : `${r.eliminadas.length} empresas eliminadas`)
        onClose()
      } else setResultado(r)
    },
  })

  if (resultado) {
    return (
      <Modal open onClose={onClose} size="md" title={resultado.eliminadas.length ? 'Eliminación parcial' : 'No se eliminó ninguna empresa'}
        description={`${resultado.eliminadas.length} eliminada(s) · ${resultado.no_eliminadas.length} conservada(s) porque están en uso.`}
        footer={<Button variant="primary" onClick={onClose}>Entendido</Button>}>
        <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {resultado.no_eliminadas.map((n) => (
            <li key={n.id_empresa} className="px-3 py-2 text-sm">
              <p className="font-medium">{n.nombre_empresa ?? `Empresa #${n.id_empresa}`}</p>
              <p className="text-xs text-muted">{n.motivo}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">Para eliminarlas, primero quítalas de los proyectos o solicitudes que las usan.</p>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} size="sm" title={una ? 'Eliminar empresa' : `Eliminar ${empresas.length} empresas`}
      footer={<>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button variant="danger" loading={mutation.isPending} onClick={confirmar}>{una ? 'Eliminar empresa' : `Eliminar ${empresas.length}`}</Button>
      </>}>
      <div className="space-y-3 text-sm text-muted">
        {una
          ? <p>Se eliminará <strong className="text-fg">“{empresas[0].nombre_empresa}”</strong> de forma permanente.</p>
          : (
            <ul className="max-h-48 overflow-y-auto rounded-lg border border-border px-3 py-2 text-fg">
              {empresas.map((e) => <li key={e.id_empresa} className="truncate py-0.5">{e.nombre_empresa}</li>)}
            </ul>
          )}
        {areasTotales > 0 && <p>También se eliminarán sus {areasTotales} área(s).</p>}
        <p>Las empresas que estén en uso en proyectos, solicitudes de demanda o compromisos <strong className="text-fg">no se eliminan</strong>; te diremos cuáles y por qué.</p>
        <FormError error={mutation.error} />
      </div>
    </Modal>
  )
}
