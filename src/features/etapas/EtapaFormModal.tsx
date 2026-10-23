import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { useUpdateEtapa } from '@/api/hooks'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { FormError } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { emptyToNull, num } from '@/lib/format'
import type { Etapa } from '@/types/api'

interface FormValues {
  horas_estimadas: string
  fecha_inicio_est: string
  fecha_fin_est: string
}

/** Las cinco etapas se crean con el proyecto: aquí solo se planifican horas y fechas. */
export function EtapaFormModal({ etapa, onClose }: { etapa: Etapa; onClose: () => void }) {
  const formId = useId()
  const toast = useToast()
  const mutation = useUpdateEtapa(etapa.id_proyecto)
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      horas_estimadas: String(num(etapa.horas_estimadas)),
      fecha_inicio_est: etapa.fecha_inicio_est ?? '', fecha_fin_est: etapa.fecha_fin_est ?? '',
    },
  })
  const inicio = watch('fecha_inicio_est')

  const onSubmit = (v: FormValues) =>
    mutation.mutate(
      {
        id_etapa: etapa.id_etapa,
        horas_estimadas: v.horas_estimadas,
        fecha_inicio_est: emptyToNull(v.fecha_inicio_est),
        fecha_fin_est: emptyToNull(v.fecha_fin_est),
      },
      { onSuccess: () => { toast.success('Etapa actualizada'); onClose() } },
    )

  return (
    <Modal open onClose={onClose} title={`${etapa.orden_secuencia}. ${etapa.nombre_etapa}`}
      description={etapa.descripcion ?? undefined}
      footer={<>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button variant="primary" type="submit" form={formId} loading={mutation.isPending}>Guardar</Button>
      </>}>
      <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <TextField type="number" min={0} step="0.5" label="Horas estimadas" required error={errors.horas_estimadas?.message}
          {...register('horas_estimadas', { required: 'Obligatorio', min: { value: 0, message: 'No puede ser negativo' } })} />
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
