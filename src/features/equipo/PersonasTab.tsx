import { useEquipoTrabajoActivo } from '@/features/equipos-trabajo/EquipoTrabajoActivo'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, UserX, Users, X } from 'lucide-react'
import { useDeactivateUsuario, usePuestos, useSkills, useUsuarios } from '@/api/hooks'
import { usePermisos } from '@/auth/AuthProvider'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FilterSelect } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Card, Table, Td, Th } from '@/components/ui/Layout'
import { SkillChip } from '@/components/ui/SkillsInput'
import { useToast } from '@/components/ui/Toast'
import { UtilizacionBar } from '@/components/ui/Utilizacion'
import { useDebounce } from '@/lib/useDebounce'
import {
  DEPARTAMENTOS, NIVELES_SKILL, TIPOS_RECURSO, type CapacidadPersona, type Departamento, type NivelSkill, type TipoRecurso,
  type Usuario,
} from '@/types/api'
import { RecursoAvatar } from './RecursoAvatar'

const MAX_SKILLS_VISIBLES = 3

export function PersonasTab({ capacidad, onEdit }: { capacidad: Map<number, CapacidadPersona>; onEdit: (u: Usuario) => void }) {
  const toast = useToast()
  const permisos = usePermisos()
  const [search, setSearch] = useState('')
  const q = useDebounce(search.trim())
  const [puesto, setPuesto] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [tipo, setTipo] = useState('')
  const [skill, setSkill] = useState('')
  const [nivel, setNivel] = useState('')
  const [activo, setActivo] = useState('true')
  const [deactivating, setDeactivating] = useState<Usuario | null>(null)

  const usuarios = useUsuarios({
    q: q || undefined,
    id_puesto: puesto ? Number(puesto) : undefined,
    departamento: (departamento || undefined) as Departamento | undefined,
    tipo_recurso: (tipo || undefined) as TipoRecurso | undefined,
    skill: skill || undefined,
    nivel_min: (skill && nivel ? nivel : undefined) as NivelSkill | undefined,
    activo: activo === '' ? undefined : activo === 'true',
  })
  const puestos = usePuestos()
  // Con un equipo de trabajo activo, solo sus personas.
  const { id: equipoActivo, miembros } = useEquipoTrabajoActivo()
  const visibles = (usuarios.data ?? []).filter((u) => equipoActivo == null || miembros.has(u.id_usuario))
  const skills = useSkills()
  const puestoNombre = new Map(puestos.data?.map((p) => [p.id_puesto, p.nombre_puesto]))
  const deactivate = useDeactivateUsuario()
  const hasFilters = !!(search || puesto || departamento || tipo || skill) || activo !== 'true'
  const clear = () => { setSearch(''); setPuesto(''); setDepartamento(''); setTipo(''); setSkill(''); setNivel(''); setActivo('true') }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
        <input
          type="search" aria-label="Buscar por nombre o correo" placeholder="Buscar por nombre o correo…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-[var(--ring)] focus:outline-none sm:w-60"
        />
        <FilterSelect label="Departamento" value={departamento} onChange={setDepartamento}>
          <option value="">Todos los departamentos</option>
          {DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}
        </FilterSelect>
        <FilterSelect label="Puesto" value={puesto} onChange={setPuesto}>
          <option value="">Todos los puestos</option>
          {puestos.data?.map((p) => <option key={p.id_puesto} value={p.id_puesto}>{p.nombre_puesto}</option>)}
        </FilterSelect>
        <FilterSelect label="Tipo de recurso" value={tipo} onChange={setTipo}>
          <option value="">Todos los tipos</option>
          {TIPOS_RECURSO.map((t) => <option key={t}>{t}</option>)}
        </FilterSelect>
        <FilterSelect label="Skill" value={skill} onChange={setSkill}>
          <option value="">Todos los skills</option>
          {skills.data?.map((s) => <option key={s.id_skill}>{s.nombre}</option>)}
        </FilterSelect>
        {skill && (
          <FilterSelect label="Nivel mínimo" value={nivel} onChange={setNivel}>
            <option value="">Cualquier nivel</option>
            {NIVELES_SKILL.map((n) => <option key={n} value={n}>{n} o más</option>)}
          </FilterSelect>
        )}
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
      ) : visibles.length === 0 ? (
        <EmptyState icon={<Users className="size-6" />} title="No se encontraron recursos"
          description={hasFilters ? 'Prueba ajustando los filtros.' : 'Agrega a la primera persona del equipo.'} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Recurso</Th><Th>Puesto</Th><Th>Departamento</Th><Th>Skills</Th><Th>Carga esta semana</Th><Th>Estado</Th>
              <Th><span className="sr-only">Acciones</span></Th>
            </tr>
          </thead>
          <tbody className={usuarios.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
            {visibles.map((u) => {
              const editable = permisos.gestionaDepartamento(u.departamento)
              return (
                <tr key={u.id_usuario} className="group hover:bg-surface-2/50">
                  <Td>
                    <div className="flex items-center gap-3">
                      <RecursoAvatar usuario={u} />
                      <div className="min-w-0">
                        <Link to={`/equipo/${u.id_usuario}`} className="block truncate font-medium hover:text-brand hover:underline">{u.nombre}</Link>
                        <p className="truncate text-xs text-muted">
                          {u.tipo_recurso === 'Activo' ? 'Activo' : u.tipo_recurso === 'Externo' ? `Externo · ${u.proveedor ?? ''}` : u.correo}
                        </p>
                      </div>
                    </div>
                  </Td>
                  <Td>{u.id_puesto ? (puestoNombre.get(u.id_puesto) ?? '—') : u.tipo_recurso === 'Activo' ? <span className="text-muted">—</span> : <Badge tone="warn">Sin asignar</Badge>}</Td>
                  <Td className="whitespace-nowrap text-muted">{u.departamento ?? <Badge tone="warn">Sin asignar</Badge>}</Td>
                  <Td>
                    {u.skills.length === 0 ? <span className="text-muted">—</span> : (
                      <div className="flex max-w-72 flex-wrap gap-1">
                        {u.skills.slice(0, MAX_SKILLS_VISIBLES).map((s) => (
                          <SkillChip key={s.nombre} skill={s} highlight={s.nombre.toLowerCase() === skill.toLowerCase()} />
                        ))}
                        {u.skills.length > MAX_SKILLS_VISIBLES && (
                          <span title={u.skills.slice(MAX_SKILLS_VISIBLES).map((s) => s.nombre).join(', ')}>
                            <Badge>+{u.skills.length - MAX_SKILLS_VISIBLES}</Badge>
                          </span>
                        )}
                      </div>
                    )}
                  </Td>
                  <Td>{u.activo ? <UtilizacionBar semana={capacidad.get(u.id_usuario)?.semanas[0]} /> : <span className="text-muted">—</span>}</Td>
                  <Td>{u.activo ? <Badge tone="ok" dot>Activo</Badge> : <Badge tone="neutral" dot>Inactivo</Badge>}</Td>
                  <Td>
                    {editable && (
                      <div className="flex justify-end">
                        <IconButton label={`Editar a ${u.nombre}`} onClick={() => onEdit(u)}><Pencil className="size-4" /></IconButton>
                        {u.activo && !permisos.esYo(u.id_usuario) && (
                          <IconButton label={`Dar de baja a ${u.nombre}`} onClick={() => setDeactivating(u)}><UserX className="size-4" /></IconButton>
                        )}
                      </div>
                    )}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}

      <ConfirmDialog
        open={!!deactivating} title="Dar de baja" confirmLabel="Dar de baja" danger
        loading={deactivate.isPending} error={deactivate.error}
        onClose={() => { setDeactivating(null); deactivate.reset() }}
        onConfirm={() => deactivating && deactivate.mutate(deactivating.id_usuario, {
          onSuccess: () => { toast.success(`${deactivating.nombre} dado de baja`); setDeactivating(null) },
        })}
      >
        <p><strong className="text-fg">{deactivating?.nombre}</strong> quedará inactivo y no podrá liderar ni asignarse a nuevas etapas. Puedes reactivarlo editándolo.</p>
      </ConfirmDialog>
    </Card>
  )
}
