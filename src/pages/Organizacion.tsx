import { useState } from 'react'
import { Building2, Plus } from 'lucide-react'
import { useAreas, useEmpresas } from '@/api/hooks'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Card, PageHeader } from '@/components/ui/Layout'
import { AreaFormModal, EmpresaFormModal } from '@/features/organizacion/OrgModals'

export default function Organizacion() {
  const empresas = useEmpresas()
  const areas = useAreas()
  const [newEmpresa, setNewEmpresa] = useState(false)
  const [newArea, setNewArea] = useState<{ empresa?: number } | null>(null)

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
        <div className="grid gap-4 md:grid-cols-2">
          {empresas.data.map((e) => {
            const propias = areas.data?.filter((a) => a.id_empresa === e.id_empresa) ?? []
            return (
              <Card key={e.id_empresa} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{e.nombre_empresa}</h2>
                    <p className="mt-0.5 text-sm text-muted">{[e.grupo, e.division].filter(Boolean).join(' · ') || 'Sin grupo ni división'}</p>
                  </div>
                  {!e.activo && <Badge>Inactiva</Badge>}
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

      {newEmpresa && <EmpresaFormModal onClose={() => setNewEmpresa(false)} />}
      {newArea && empresas.data && <AreaFormModal empresas={empresas.data} defaultEmpresa={newArea.empresa} onClose={() => setNewArea(null)} />}
    </>
  )
}
