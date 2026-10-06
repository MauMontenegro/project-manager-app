import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { useCreateAsignacion, useUsuarios } from '@/api/hooks'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { FormError } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import type { Etapa } from '@/types/api'

interface FormValues {
  id_usuario: string
  id_etapa: string
  perfil_requerido: string
  horas_asignadas: string
  porcentaje_utilizacion: string
}

export function AsignacionFormModal({ idProyecto, etapas, onClose }: {
  idProyecto: number; etapas: Etapa[]; onClose: () => void
}) {
  const formId = useId()
  const toast = useToast()
  const mutation = useCreateAsignacion(idProyecto)
  const usuarios = useUsuarios({ activo: true })
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: { id_usuario: '', id_etapa: etapas[0] ? String(etapas[0].id_etapa) : '', perfil_requerido: '', horas_asignadas: '', porcentaje_utilizacion: '' },
  })

  const onSubmit = (v: FormValues) =>
    mutation.mutate(
      {
        id_usuario: Number(v.id_usuario),
        id_etapa: Number(v.id_etapa),
        perfil_requerido: v.perfil_requerido.trim(),
        horas_asignadas: v.horas_asignadas,
        porcentaje_utilizacion: v.porcentaje_utilizacion,
      },
      { onSuccess: () => { toast.success('Recurso asignado'); onClose() } },
    )

  return (
    <Modal open onClose={onClose} title="Asignar recurso" description="Un usuario solo puede asignarse una vez por etapa."
      footer={<>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button variant="primary" type="submit" form={formId} loading={mutation.isPending}>Asignar</Button>
      </>}>
      <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <SelectField label="Etapa" required error={errors.id_etapa?.message} {...register('id_etapa', { required: 'Obligatorio' })}>
          {etapas.map((e) => <option key={e.id_etapa} value={e.id_etapa}>{e.orden_secuencia}. {e.nombre_etapa}</option>)}
        </SelectField>
        <SelectField label="Persona" required error={errors.id_usuario?.message}
          {...register('id_usuario', {
            required: 'Obligatorio',
            onChange: (e) => {
              const u = usuarios.data?.find((x) => String(x.id_usuario) === e.target.value)
              if (u) setValue('perfil_requerido', u.perfil_tecnico)
            },
          })}>
          <option value="">Selecciona una persona…</option>
          {usuarios.data?.map((u) => <option key={u.id_usuario} value={u.id_usuario}>{u.nombre} · {u.perfil_tecnico}</option>)}
        </SelectField>
        <TextField label="Rol desempeñado" required maxLength={100} error={errors.perfil_requerido?.message}
          {...register('perfil_requerido', { validate: (v) => v.trim() !== '' || 'Obligatorio' })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField type="number" step="0.5" label="Horas asignadas" required error={errors.horas_asignadas?.message}
            {...register('horas_asignadas', { required: 'Obligatorio', validate: (v) => Number(v) > 0 || 'Debe ser mayor a 0' })} />
          <TextField type="number" step="1" label="Utilización (%)" required error={errors.porcentaje_utilizacion?.message}
            {...register('porcentaje_utilizacion', {
              required: 'Obligatorio',
              validate: (v) => (Number(v) >= 0 && Number(v) <= 100) || 'Debe estar entre 0 y 100',
            })} />
        </div>
        <FormError error={mutation.error} />
      </form>
    </Modal>
  )
}
