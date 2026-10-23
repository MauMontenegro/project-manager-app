import { AvisoEquipoTrabajo, useEquipoTrabajoActivo } from '@/features/equipos-trabajo/EquipoTrabajoActivo'
import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, BookMarked, Gauge, Plus, UserCheck, Users } from 'lucide-react'
import { useCapacidad } from '@/api/hooks'
import { usePermisos } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Card, PageHeader } from '@/components/ui/Layout'
import { Tabs } from '@/components/ui/Tabs'
import { DisponibilidadTab } from '@/features/equipo/DisponibilidadTab'
import { OrganigramaTab } from '@/features/equipo/OrganigramaTab'
import { PersonasTab } from '@/features/equipo/PersonasTab'
import { CatalogosModal } from '@/features/usuarios/CatalogosModal'
import { UsuarioFormModal } from '@/features/usuarios/UsuarioFormModal'
import { cn } from '@/lib/cn'
import { bandaSemana } from '@/lib/capacidad'
import { num } from '@/lib/format'
import type { Usuario } from '@/types/api'

type Vista = 'personas' | 'disponibilidad' | 'organigrama'
const VISTAS: Vista[] = ['personas', 'disponibilidad', 'organigrama']

export default function Equipo() {
  const permisos = usePermisos()
  const [params, setParams] = useSearchParams()
  const vista = (VISTAS.find((v) => v === params.get('vista')) ?? 'personas') as Vista
  const setVista = (v: Vista) => setParams(v === 'personas' ? {} : { vista: v }, { replace: true })
  const [editing, setEditing] = useState<Usuario | 'new' | null>(null)
  const [catalogos, setCatalogos] = useState(false)

  // Una sola consulta de la semana actual alimenta KPIs, tabla y organigrama.
  const semana = useCapacidad({ semanas: 1 })
  const capacidad = useMemo(() => new Map((semana.data ?? []).map((c) => [c.id_usuario, c])), [semana.data])
  // Con un equipo de trabajo activo, los KPIs y las listas son de sus personas.
  const { id: equipoActivo, miembros } = useEquipoTrabajoActivo()
  const kpis = useMemo(() => {
    const semanas = (semana.data ?? []).filter((c) => equipoActivo == null || miembros.has(c.id_usuario)).map((c) => c.semanas[0])
    const disponibles = semanas.reduce((a, s) => a + num(s.horas_disponibles), 0)
    const asignadas = semanas.reduce((a, s) => a + num(s.horas_asignadas), 0)
    return {
      total: semanas.length,
      utilizacion: disponibles > 0 ? Math.round((asignadas / disponibles) * 100) : null,
      sobreasignados: semanas.filter((s) => bandaSemana(s) === 'sobrecarga').length,
      libres: semanas.filter((s) => bandaSemana(s) === 'disponible').length,
      horasLibres: Math.max(0, Math.round(disponibles - asignadas)),
    }
  }, [semana.data, equipoActivo, miembros])

  return (
    <>
      <PageHeader title="Equipo" description="Personas, recursos externos y activos de la DTI: quién es quién, qué sabe y cuánta capacidad tiene."
        actions={<>
          <Button icon={<BookMarked className="size-4" />} onClick={() => setCatalogos(true)}>Catálogos</Button>
          {permisos.gestionaEquipo && (
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Nuevo recurso</Button>
          )}
        </>} />

      <AvisoEquipoTrabajo que="las personas" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Users className="size-4" />} label="Recursos activos" value={kpis.total} loading={semana.isPending} />
        <Kpi icon={<Gauge className="size-4" />} label="Utilización esta semana" loading={semana.isPending}
          value={kpis.utilizacion === null ? '—' : `${kpis.utilizacion} %`} sub="Asignado vs. capacidad planificable" />
        <Kpi icon={<AlertTriangle className="size-4" />} label="Sobreasignados" value={kpis.sobreasignados} loading={semana.isPending}
          tone={kpis.sobreasignados > 0 ? 'danger' : undefined} sub={kpis.sobreasignados > 0 ? 'Más del 100 % de su capacidad' : 'Nadie por encima del 100 %'}
          onClick={kpis.sobreasignados > 0 ? () => setVista('disponibilidad') : undefined} />
        <Kpi icon={<UserCheck className="size-4" />} label="Con disponibilidad" value={kpis.libres} loading={semana.isPending}
          tone="ok" sub={`≈ ${kpis.horasLibres} h libres en el equipo`} onClick={() => setVista('disponibilidad')} />
      </div>

      <div className="mb-4">
        <Tabs label="Vistas del equipo" value={vista} onChange={setVista}
          tabs={[{ id: 'personas', label: 'Personas' }, { id: 'disponibilidad', label: 'Disponibilidad' }, { id: 'organigrama', label: 'Organigrama' }]} />
      </div>
      <div role="tabpanel" id={`panel-${vista}`} aria-labelledby={`tab-${vista}`}>
        {vista === 'personas' && <PersonasTab capacidad={capacidad} onEdit={setEditing} />}
        {vista === 'disponibilidad' && <DisponibilidadTab />}
        {vista === 'organigrama' && <OrganigramaTab capacidad={capacidad} />}
      </div>

      {catalogos && <CatalogosModal onClose={() => setCatalogos(false)} />}
      {editing && <UsuarioFormModal usuario={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function Kpi({ icon, label, value, sub, tone, loading, onClick }: {
  icon: ReactNode; label: string; value: ReactNode; sub?: string; tone?: 'danger' | 'ok'; loading?: boolean; onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Card className="p-0">
      <Tag type={onClick ? 'button' : undefined} onClick={onClick}
        className={cn('flex h-full w-full flex-col gap-1 rounded-xl p-4 text-left', onClick && 'transition-colors hover:bg-surface-2/60 focus-visible:ring-4 focus-visible:ring-[var(--ring)] focus-visible:outline-none')}>
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted">{icon}{label}</span>
        {loading ? <span className="my-1 h-7 w-16 animate-pulse rounded bg-surface-2" /> : (
          <span className={cn('text-2xl font-semibold tracking-tight tabular-nums text-fg', tone === 'danger' && 'text-danger')}>{value}</span>
        )}
        {sub && <span className="text-xs text-muted">{sub}</span>}
      </Tag>
    </Card>
  )
}
