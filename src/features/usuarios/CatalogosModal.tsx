import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Check, Combine, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  useCreatePuesto, useDeletePuesto, useDeleteSkill, useMergeSkill, usePuestos, useRenameSkill, useSkills,
} from '@/api/hooks'
import { usePermisos } from '@/auth/AuthProvider'
import { Button, IconButton } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { EmptyState, ErrorState, FormError, Skeleton } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { Tabs } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import type { SkillCatalogo } from '@/types/api'

type Tab = 'puestos' | 'skills'

/** Catálogos del Equipo: puestos y skills. Editables por Administrador y Gerentes. */
export function CatalogosModal({ onClose, inicial = 'puestos' }: { onClose: () => void; inicial?: Tab }) {
  const [tab, setTab] = useState<Tab>(inicial)
  const puestos = usePuestos()
  const skills = useSkills()
  return (
    <Modal open onClose={onClose} size="md" title="Catálogos del Equipo" footer={<Button onClick={onClose}>Cerrar</Button>}>
      <div className="space-y-4">
        <Tabs label="Catálogos" value={tab} onChange={setTab}
          tabs={[{ id: 'puestos', label: 'Puestos', count: puestos.data?.length }, { id: 'skills', label: 'Skills', count: skills.data?.length }]} />
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'puestos' ? <PuestosPanel /> : <SkillsPanel />}
        </div>
      </div>
    </Modal>
  )
}

function PuestosPanel() {
  const formId = useId()
  const toast = useToast()
  const { gestionaEquipo } = usePermisos()
  const puestos = usePuestos()
  const create = useCreatePuesto()
  const remove = useDeletePuesto()
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ defaultValues: { nombre_puesto: '' } })

  const onSubmit = handleSubmit((v) =>
    create.mutate({ nombre_puesto: v.nombre_puesto.trim() }, {
      onSuccess: (p) => { toast.success(`Puesto «${p.nombre_puesto}» agregado`); reset() },
    }))

  return (
    <div className="space-y-4">
      {gestionaEquipo && (
        <form id={formId} onSubmit={onSubmit} noValidate className="flex items-start gap-2">
          <TextField label="Nuevo puesto" maxLength={100} placeholder="Ej.: Arquitecto de Soluciones" fieldClassName="flex-1"
            error={errors.nombre_puesto?.message}
            {...register('nombre_puesto', { validate: (v) => v.trim() !== '' || 'Obligatorio' })} />
          <Button type="submit" variant="primary" className="mt-[26px]" loading={create.isPending} icon={<Plus className="size-4" />}>Agregar</Button>
        </form>
      )}
      <FormError error={create.error ?? remove.error} />
      {puestos.isPending ? <ListaSkeleton /> : puestos.isError ? <ErrorState error={puestos.error} onRetry={() => puestos.refetch()} /> : (
        <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {puestos.data.map((p) => (
            <li key={p.id_puesto} className="flex min-h-11 items-center justify-between py-1 pr-1 pl-3 text-sm">
              {p.nombre_puesto}
              {gestionaEquipo && (
                <IconButton label={`Quitar puesto ${p.nombre_puesto}`} disabled={remove.isPending}
                  onClick={() => remove.mutate(p.id_puesto, { onSuccess: () => toast.success('Puesto eliminado') })}>
                  <Trash2 className="size-4" />
                </IconButton>
              )}
            </li>
          ))}
          {puestos.data.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted">Aún no hay puestos.</li>}
        </ul>
      )}
    </div>
  )
}

function SkillsPanel() {
  const { gestionaEquipo } = usePermisos()
  const skills = useSkills()
  const [filtro, setFiltro] = useState('')
  const rename = useRenameSkill()
  const merge = useMergeSkill()
  const remove = useDeleteSkill()
  const visibles = (skills.data ?? []).filter((s) => s.nombre.toLowerCase().includes(filtro.trim().toLowerCase()))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Los skills se agregan al capturar personas. Aquí puedes unificar variantes (p. ej. «ReactJS» en «React») para que la búsqueda por skill sea confiable.
      </p>
      <input type="search" aria-label="Buscar skill" placeholder="Buscar skill…" value={filtro} onChange={(e) => setFiltro(e.target.value)}
        className="h-9 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-[var(--ring)] focus:outline-none" />
      <FormError error={rename.error ?? merge.error ?? remove.error} />
      {skills.isPending ? <ListaSkeleton /> : skills.isError ? <ErrorState error={skills.error} onRetry={() => skills.refetch()} />
        : skills.data.length === 0 ? <EmptyState title="Sin skills" description="Agrega skills al editar a una persona." /> : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {visibles.map((s) => (
              <SkillRow key={s.id_skill} skill={s} todos={skills.data} editable={gestionaEquipo}
                onRename={(nombre, done) => rename.mutate({ id: s.id_skill, nombre }, { onSuccess: done })}
                onMerge={(id_destino, done) => merge.mutate({ id: s.id_skill, id_destino }, { onSuccess: done })}
                onDelete={() => remove.mutate(s.id_skill)} busy={rename.isPending || merge.isPending || remove.isPending} />
            ))}
            {visibles.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted">Sin coincidencias.</li>}
          </ul>
        )}
    </div>
  )
}

function SkillRow({ skill, todos, editable, busy, onRename, onMerge, onDelete }: {
  skill: SkillCatalogo
  todos: SkillCatalogo[]
  editable: boolean
  busy: boolean
  onRename: (nombre: string, done: () => void) => void
  onMerge: (id: number, done: () => void) => void
  onDelete: () => void
}) {
  const toast = useToast()
  const [modo, setModo] = useState<'ver' | 'renombrar' | 'fusionar' | 'eliminar'>('ver')
  const [nombre, setNombre] = useState(skill.nombre)
  const [destino, setDestino] = useState('')
  const cerrar = () => setModo('ver')
  const control = 'h-8 min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-brand focus:ring-2 focus:ring-[var(--ring)] focus:outline-none'

  return (
    <li className="flex min-h-11 items-center gap-2 py-1 pr-1 pl-3 text-sm">
      {modo === 'renombrar' ? (
        <form className="flex flex-1 items-center gap-1" onSubmit={(e) => {
          e.preventDefault()
          if (nombre.trim() && nombre.trim() !== skill.nombre) onRename(nombre.trim(), () => { toast.success('Skill renombrado'); cerrar() })
          else cerrar()
        }}>
          <input autoFocus aria-label="Nuevo nombre" value={nombre} maxLength={50} onChange={(e) => setNombre(e.target.value)} className={control} />
          <IconButton label="Guardar" type="submit" disabled={busy}><Check className="size-4" /></IconButton>
          <IconButton label="Cancelar" onClick={cerrar}><X className="size-4" /></IconButton>
        </form>
      ) : modo === 'fusionar' ? (
        <form className="flex flex-1 items-center gap-1" onSubmit={(e) => {
          e.preventDefault()
          if (destino) onMerge(Number(destino), () => { toast.success(`«${skill.nombre}» fusionado`); cerrar() })
        }}>
          <span className="shrink-0 text-muted">{skill.nombre} →</span>
          <select autoFocus aria-label="Fusionar en" value={destino} onChange={(e) => setDestino(e.target.value)} className={control}>
            <option value="">Elige el skill que se conserva…</option>
            {todos.filter((t) => t.id_skill !== skill.id_skill).map((t) => <option key={t.id_skill} value={t.id_skill}>{t.nombre}</option>)}
          </select>
          <IconButton label="Fusionar" type="submit" disabled={busy || !destino}><Check className="size-4" /></IconButton>
          <IconButton label="Cancelar" onClick={cerrar}><X className="size-4" /></IconButton>
        </form>
      ) : modo === 'eliminar' ? (
        <div className="flex flex-1 items-center justify-between gap-2">
          <span className="text-danger">¿Quitar «{skill.nombre}» de {skill.personas} persona(s)?</span>
          <div className="flex gap-1">
            <Button size="sm" variant="danger" loading={busy} onClick={onDelete}>Eliminar</Button>
            <Button size="sm" onClick={cerrar}>No</Button>
          </div>
        </div>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate">{skill.nombre}</span>
          <span className="text-xs text-muted tabular-nums">{skill.personas} {skill.personas === 1 ? 'persona' : 'personas'}</span>
          {editable && (
            <div className="flex">
              <IconButton label={`Renombrar ${skill.nombre}`} onClick={() => setModo('renombrar')}><Pencil className="size-4" /></IconButton>
              <IconButton label={`Fusionar ${skill.nombre} en otro`} onClick={() => setModo('fusionar')}><Combine className="size-4" /></IconButton>
              <IconButton label={`Eliminar ${skill.nombre}`} onClick={() => setModo('eliminar')}><Trash2 className="size-4" /></IconButton>
            </div>
          )}
        </>
      )}
    </li>
  )
}

const ListaSkeleton = () => <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
