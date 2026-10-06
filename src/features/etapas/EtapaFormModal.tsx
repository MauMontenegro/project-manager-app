import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { useCreateEtapa } from '@/api/hooks'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { FormError } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { emptyToNull } from '@/lib/format'
import { NOMBRES_ETAPA, type NombreEtapa } from '@/types/api'

interface FormValues {
  nombre_etapa: NombreEtapa
  orden_secuencia: string
  horas_estimadas: string
  fecha_inicio_est: string
  fecha_fin_est: string
}

export function EtapaFormModal({ idProyecto, sugeridoOrden, onClose }: {
  idProyecto: number; sugeridoOrden: number; onClose: () => void
}) {
  const formId = useId()
  const toast = useToast()
  const mutation = useCreateEtapa(idProyecto)
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      nombre_etapa: NOMBRES_ETAPA[Math.min(sugeridoOrden - 1, NOMBRES_ETAPA.length - 1)],
      orden_secuencia: String(sugeridoOrden), horas_estimadas: '', fecha_inicio_est: '', fecha_fin_est: '',
    },
  })
  const inicio = watch('fecha_inicio_est')

  const onSubmit = (v: FormValues) =>
    mutation.mutate(
      {
        nombre_etapa: v.nombre_etapa,
        orden_secuencia: Number(v.orden_secuencia),
        horas_estimadas: v.horas_estimadas,
        fecha_inicio_est: emptyToNull(v.fecha_inicio_est),
        fecha_fin_est: emptyToNull(v.fecha_fin_est),
      },
      { onSuccess: () => { toast.success('Etapa agregada'); onClose() } },
    )

  return (
    <Modal open onClose={onClose} title="Nueva etapa" description="La etapa inicia en estado “Pendiente”."
      footer={<>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button variant="primary" type="submit" form={formId} loading={mutation.isPending}>Agregar etapa</Button>
      </>}>
      <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <SelectField label="Etapa" required {...register('nombre_etapa')}>
          {NOMBRES_ETAPA.map((n) => <option key={n}>{n}</option>)}
        </SelectField>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField type="number" min={1} step={1} label="Orden en la secuencia" required
            hint="Debe ser único dentro del proyecto." error={errors.orden_secuencia?.message}
            {...register('orden_secuencia', { required: 'Obligatorio', min: { value: 1, message: 'Debe ser mayor a 0' } })} />
          <TextField type="number" min={0} step="0.5" label="Horas estimadas" required error={errors.horas_estimadas?.message}
            {...register('horas_estimadas', { required: 'Obligatorio', min: { value: 0, message: 'No puede ser negativo' } })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField type="date" label="Inicio estimado" {...register('fecha_inicio_est')} />
          <TextField type="date" label="Fin estimado" error={errors.fecha_fin_est?.message}
            {...register('fecha_fin_est', { validate: (v) => !v || !inicio || v >= inicio || 'No puede ser anterior al inicio' })} />
        </div>
        <FormError error={mutation.error} />
      </form>
    </Modal>
  )
}
