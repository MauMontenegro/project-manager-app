import { useId } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { useCreateProyecto, useEmpresas, useUpdateProyecto, useUsuarios } from '@/api/hooks'
import { Button } from '@/components/ui/Button'
import { SelectField, TextArea, TextField } from '@/components/ui/Field'
import { FormError } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { emptyToNull } from '@/lib/format'
import {
  NIVELES_IMPACTO, SEMAFOROS, type NivelImpacto, type ProyectoDetalle, type Semaforo,
} from '@/types/api'

interface FormValues {
  nombre_proyecto: string
  problema_oportunidad: string
  objetivo: string
  alcance: string
  fuera_de_alcance: string
  lider_id: string
  fecha_tentativa: string
  fecha_comprometida: string
  semaforo: Semaforo
  empresas: Array<{ id_empresa: string; nivel_impacto: NivelImpacto; notas_impacto: string }>
}

const required = 'Este campo es obligatorio'
const notBlank = (v: string) => v.trim() !== '' || required

/** Crea un proyecto o, si recibe `proyecto`, edita sus campos editables. */
export function ProyectoFormModal({ proyecto, onClose, onSaved }: {
  proyecto?: ProyectoDetalle
  onClose: () => void
  onSaved?: (p: ProyectoDetalle) => void
}) {
  const editing = !!proyecto
  const formId = useId()
  const toast = useToast()
  const create = useCreateProyecto()
  const update = useUpdateProyecto(proyecto?.id_proyecto ?? 0)
  const mutation = editing ? update : create

  const lideres = useUsuarios({ perfil_tecnico: 'Líder', activo: true })
  const empresas = useEmpresas()

  const { register, handleSubmit, control, setError, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      nombre_proyecto: proyecto?.nombre_proyecto ?? '',
      problema_oportunidad: proyecto?.problema_oportunidad ?? '',
      objetivo: proyecto?.objetivo ?? '',
      alcance: proyecto?.alcance ?? '',
      fuera_de_alcance: proyecto?.fuera_de_alcance ?? '',
      lider_id: proyecto ? String(proyecto.lider_id) : '',
      fecha_tentativa: proyecto?.fecha_tentativa ?? '',
      fecha_comprometida: proyecto?.fecha_comprometida ?? '',
      semaforo: proyecto?.semaforo ?? 'Verde',
      empresas: [],
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'empresas' })

  const onSubmit = (v: FormValues) => {
    const base = {
      nombre_proyecto: v.nombre_proyecto.trim(),
      problema_oportunidad: v.problema_oportunidad.trim(),
      objetivo: v.objetivo.trim(),
      alcance: v.alcance.trim(),
      fuera_de_alcance: v.fuera_de_alcance.trim(),
      lider_id: Number(v.lider_id),
      fecha_tentativa: emptyToNull(v.fecha_tentativa),
      fecha_comprometida: emptyToNull(v.fecha_comprometida),
      semaforo: v.semaforo,
    }
    const done = (p: ProyectoDetalle) => {
      toast.success(editing ? 'Proyecto actualizado' : 'Proyecto creado')
      onSaved?.(p)
      onClose()
    }

    if (editing) return update.mutate(base, { onSuccess: done })

    const ids = v.empresas.map((e) => e.id_empresa)
    const dup = ids.findIndex((id, i) => ids.indexOf(id) !== i)
    if (dup >= 0) return setError(`empresas.${dup}.id_empresa`, { message: 'Empresa repetida' })

    create.mutate(
      {
        ...base,
        empresas_impactadas: v.empresas.map((e) => ({
          id_empresa: Number(e.id_empresa),
          nivel_impacto: e.nivel_impacto,
          notas_impacto: emptyToNull(e.notas_impacto),
        })),
      },
      { onSuccess: done },
    )
  }

  return (
    <Modal
      open onClose={onClose} size="lg"
      title={editing ? 'Editar proyecto' : 'Nuevo proyecto'}
      description={editing ? 'El estado se cambia desde el detalle del proyecto.' : 'El proyecto iniciará en estado “Iniciación”.'}
      footer={
        <>
          <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
          <Button variant="primary" type="submit" form={formId} loading={mutation.isPending}>
            {editing ? 'Guardar cambios' : 'Crear proyecto'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <TextField label="Nombre del proyecto" required maxLength={200}
          error={errors.nombre_proyecto?.message}
          {...register('nombre_proyecto', { validate: notBlank })} />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Líder" required error={errors.lider_id?.message}
            hint={lideres.data?.length === 0 ? 'No hay usuarios activos con perfil Líder.' : undefined}
            {...register('lider_id', { required })}>
            <option value="">Selecciona un líder…</option>
            {lideres.data?.map((u) => <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>)}
          </SelectField>
          <SelectField label="Semáforo" {...register('semaforo')}>
            {SEMAFOROS.map((s) => <option key={s}>{s}</option>)}
          </SelectField>
        </div>

        <TextArea label="Problema u oportunidad" required error={errors.problema_oportunidad?.message}
          {...register('problema_oportunidad', { validate: notBlank })} />
        <TextArea label="Objetivo" required error={errors.objetivo?.message}
          {...register('objetivo', { validate: notBlank })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextArea label="Alcance" required error={errors.alcance?.message}
            {...register('alcance', { validate: notBlank })} />
          <TextArea label="Fuera de alcance" required error={errors.fuera_de_alcance?.message}
            {...register('fuera_de_alcance', { validate: notBlank })} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField type="date" label="Fecha tentativa" {...register('fecha_tentativa')} />
          <TextField type="date" label="Fecha comprometida" {...register('fecha_comprometida')} />
        </div>

        {!editing && (
          <fieldset className="space-y-3">
            <div className="flex items-center justify-between">
              <legend className="text-[13px] font-medium text-fg">Empresas impactadas</legend>
              <Button size="sm" icon={<Plus className="size-4" />} disabled={!empresas.data?.length}
                onClick={() => append({ id_empresa: '', nivel_impacto: 'Medio', notas_impacto: '' })}>
                Agregar
              </Button>
            </div>
            {fields.length === 0 && <p className="text-sm text-muted">Opcional. Agrega las empresas que se verán afectadas.</p>}
            {fields.map((f, i) => (
              <div key={f.id} className="grid gap-3 rounded-lg border border-border bg-surface-2/40 p-3 sm:grid-cols-[1fr_9rem_auto]">
                <SelectField label="Empresa" required error={errors.empresas?.[i]?.id_empresa?.message}
                  {...register(`empresas.${i}.id_empresa`, { required })}>
                  <option value="">Selecciona…</option>
                  {empresas.data?.map((e) => <option key={e.id_empresa} value={e.id_empresa}>{e.nombre_empresa}</option>)}
                </SelectField>
                <SelectField label="Impacto" {...register(`empresas.${i}.nivel_impacto`)}>
                  {NIVELES_IMPACTO.map((n) => <option key={n}>{n}</option>)}
                </SelectField>
                <div className="flex items-end">
                  <Button variant="ghost" aria-label="Quitar empresa" onClick={() => remove(i)}><Trash2 className="size-4" /></Button>
                </div>
                <TextField fieldClassName="sm:col-span-3" label="Notas de impacto" {...register(`empresas.${i}.notas_impacto`)} />
              </div>
            ))}
          </fieldset>
        )}

        <FormError error={mutation.error} />
      </form>
    </Modal>
  )
}
