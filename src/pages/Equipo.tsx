import { useState } from 'react'
import { Pencil, Plus, UserX, Users, X } from 'lucide-react'
import { useAreas, useDeactivateUsuario, useUsuarios } from '@/api/hooks'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FilterSelect } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Avatar, Card, PageHeader, Table, Td, Th } from '@/components/ui/Layout'
import { useToast } from '@/components/ui/Toast'
import { UsuarioFormModal } from '@/features/usuarios/UsuarioFormModal'
import { formatNumber } from '@/lib/format'
import { useDebounce } from '@/lib/useDebounce'
import { PERFILES_TECNICOS, type PerfilTecnico, type Usuario } from '@/types/api'

export default function Equipo() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const q = useDebounce(search.trim())
  const [perfil, setPerfil] = useState('')
  const [area, setArea] = useState('')
  const [activo, setActivo] = useState('true')
  const [editing, setEditing] = useState<Usuario | 'new' | null>(null)
  const [deactivating, setDeactivating] = useState<Usuario | null>(null)

  const usuarios = useUsuarios({
    q: q || undefined,
    perfil_tecnico: (perfil || undefined) as PerfilTecnico | undefined,
    id_area: area ? Number(area) : undefined,
    activo: activo === '' ? undefined : activo === 'true',
  })
  const areas = useAreas()
  const areaNombre = new Map(areas.data?.map((a) => [a.id_area, a.nombre_area]))
  const deactivate = useDeactivateUsuario()
  const hasFilters = !!(search || perfil || area) || activo !== 'true'
  const clear = () => { setSearch(''); setPerfil(''); setArea(''); setActivo('true') }

  return (
    <>
      <PageHeader title="Equipo" description="Personas disponibles para liderar y ejecutar proyectos."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Nueva persona</Button>} />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
          <input
            type="search" aria-label="Buscar por nombre o correo" placeholder="Buscar por nombre o correo…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-[var(--ring)] focus:outline-none sm:w-64"
          />
          <FilterSelect label="Perfil técnico" value={perfil} onChange={setPerfil}>
            <option value="">Todos los perfiles</option>
            {PERFILES_TECNICOS.map((p) => <option key={p}>{p}</option>)}
          </FilterSelect>
          <FilterSelect label="Área" value={area} onChange={setArea}>
            <option value="">Todas las áreas</option>
            {areas.data?.map((a) => <option key={a.id_area} value={a.id_area}>{a.nombre_area}</option>)}
          </FilterSelect>
          <FilterSelect label="Estado" value={activo} onChange={setActivo}>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
            <option value="">Todos</option>
          </FilterSelect>
          {hasFilters && <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={clear}>Restablecer</Button>}
        </div>

        {usuarios.isPending ? (
          <div className="space-y-3 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : usuarios.isError ? (
          <ErrorState error={usuarios.error} onRetry={() => usuarios.refetch()} />
        ) : usuarios.data.length === 0 ? (
          <EmptyState icon={<Users className="size-6" />} title="No se encontraron personas"
            description={hasFilters ? 'Prueba ajustando los filtros.' : 'Agrega a la primera persona del equipo.'} />
        ) : (
          <Table>
            <thead>
              <tr><Th>Persona</Th><Th>Perfil</Th><Th>Área</Th><Th className="text-right">Capacidad</Th><Th>Estado</Th><Th><span className="sr-only">Acciones</span></Th></tr>
            </thead>
            <tbody className={usuarios.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
              {usuarios.data.map((u) => (
                <tr key={u.id_usuario}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={u.nombre} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{u.nombre}</p>
                        <p className="truncate text-xs text-muted">{u.correo}</p>
                      </div>
                    </div>
                  </Td>
                  <Td><Badge tone={u.perfil_tecnico === 'Líder' ? 'brand' : 'neutral'}>{u.perfil_tecnico}</Badge></Td>
                  <Td className="text-muted">{areaNombre.get(u.id_area) ?? '—'}</Td>
                  <Td className="text-right whitespace-nowrap tabular-nums">{formatNumber(u.capacidad_horas_semanales, 1)} h/sem</Td>
                  <Td>{u.activo ? <Badge tone="ok" dot>Activo</Badge> : <Badge tone="neutral" dot>Inactivo</Badge>}</Td>
                  <Td>
                    <div className="flex justify-end">
                      <IconButton label={`Editar a ${u.nombre}`} onClick={() => setEditing(u)}><Pencil className="size-4" /></IconButton>
                      {u.activo && <IconButton label={`Dar de baja a ${u.nombre}`} onClick={() => setDeactivating(u)}><UserX className="size-4" /></IconButton>}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {editing && <UsuarioFormModal usuario={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deactivating} title="Dar de baja a la persona" confirmLabel="Dar de baja" danger
        loading={deactivate.isPending} error={deactivate.error}
        onClose={() => { setDeactivating(null); deactivate.reset() }}
        onConfirm={() => deactivating && deactivate.mutate(deactivating.id_usuario, {
          onSuccess: () => { toast.success('Persona dada de baja'); setDeactivating(null) },
        })}
      >
        <p><strong className="text-fg">{deactivating?.nombre}</strong> quedará inactivo y no podrá ser líder ni asignarse a nuevas etapas. Podrás reactivarlo editando su perfil.</p>
      </ConfirmDialog>
    </>
  )
}
