import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Boxes, Check, Plus } from 'lucide-react'
import { useEquiposTrabajo } from '@/api/hooks'
import { usePermisos } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Avatar, Card, PageHeader } from '@/components/ui/Layout'
import { cn } from '@/lib/cn'
import { EquipoTrabajoFormModal } from '@/features/equipos-trabajo/EquipoTrabajoFormModal'
import { useEquipoTrabajoActivo } from '@/features/equipos-trabajo/EquipoTrabajoActivo'
import type { EquipoTrabajo } from '@/types/api'

export default function EquiposTrabajo() {
  const q = useEquiposTrabajo()
  const { gestionaEquipo } = usePermisos()
  const [creando, setCreando] = useState(false)

  return (
    <>
      <PageHeader title="Equipos de trabajo"
        description="Agrupan a personas de cualquier departamento y los proyectos de una línea de negocio. Elige uno en la barra lateral para filtrar toda la app."
        actions={gestionaEquipo && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreando(true)}>Nuevo equipo</Button>} />

      {q.isPending ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
        : q.isError ? <Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>
        : q.data.length === 0 ? (
          <Card>
            <EmptyState icon={<Boxes className="size-6" />} title="Aún no hay equipos de trabajo"
              description="Crea uno por cada línea de negocio que atiende la DTI (p. ej. Servicios Corporativos, Combustibles) y asígnale personas y proyectos."
              action={gestionaEquipo && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreando(true)}>Nuevo equipo</Button>} />
          </Card>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {q.data.map((e) => <TarjetaEquipo key={e.id_equipo_trabajo} e={e} />)}
          </ul>
        )}
      {creando && <EquipoTrabajoFormModal onClose={() => setCreando(false)} />}
    </>
  )
}

function TarjetaEquipo({ e }: { e: EquipoTrabajo }) {
  const { id, elegir } = useEquipoTrabajoActivo()
  const activo = id === e.id_equipo_trabajo
  const deptos = [...e.miembros.reduce((m, p) => m.set(p.departamento ?? 'Sin departamento', (m.get(p.departamento ?? 'Sin departamento') ?? 0) + 1), new Map<string, number>())]
  const MAX = 6
  return (
    <li>
      <Card className={cn('relative flex h-full flex-col overflow-hidden', activo && 'ring-2 ring-brand')}>
        <span className="h-1.5" style={{ background: e.color }} aria-hidden />
        <div className="flex flex-1 flex-col gap-3 p-5">
          <div>
            <Link to={`/equipos-trabajo/${e.id_equipo_trabajo}`} className="text-base font-semibold after:absolute after:inset-0 hover:text-brand hover:underline">{e.nombre}</Link>
            {e.descripcion && <p className="mt-1 line-clamp-2 text-sm text-muted">{e.descripcion}</p>}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {e.miembros.slice(0, MAX).map((m) => <span key={m.id_usuario} title={m.nombre} className="rounded-full ring-2 ring-surface"><Avatar name={m.nombre} className="size-7 text-[10px]" /></span>)}
            </div>
            <span className="text-xs text-muted">
              {e.miembros.length === 0 ? 'Sin personas' : `${e.miembros.length} persona(s)`}
              {e.miembros.length > MAX && ` · +${e.miembros.length - MAX}`}
            </span>
          </div>
          {deptos.length > 0 && <p className="text-xs text-muted">{deptos.map(([d, n]) => `${n} ${d}`).join(' · ')}</p>}
          <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
            <Dato label="Proyectos abiertos" valor={e.proyectos_abiertos} />
            <Dato label="En riesgo" valor={e.proyectos_en_riesgo} alerta={e.proyectos_en_riesgo > 0} />
            <Dato label="Bloqueos abiertos" valor={e.bloqueos_abiertos} alerta={e.bloqueos_abiertos > 0} />
          </dl>
          <Button size="sm" variant={activo ? 'primary' : 'secondary'} className="relative z-10" icon={activo ? <Check className="size-4" /> : undefined}
            onClick={() => elegir(activo ? null : e.id_equipo_trabajo)}>
            {activo ? 'Filtrando la app por este equipo' : 'Filtrar la app por este equipo'}
          </Button>
        </div>
      </Card>
    </li>
  )
}

function Dato({ label, valor, alerta }: { label: string; valor: number; alerta?: boolean }) {
  return (
    <div>
      <dd className={cn('text-lg font-semibold tabular-nums', alerta && 'text-danger')}>{valor}</dd>
      <dt className="text-[11px] text-muted">{label}</dt>
    </div>
  )
}
