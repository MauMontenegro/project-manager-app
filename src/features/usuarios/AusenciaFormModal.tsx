import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { useCreateAusencia } from '@/api/hooks'
import { Button } from '@/components/ui/Button'
import { SelectField, TextArea, TextField } from '@/components/ui/Field'
import { FormError } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { emptyToNull, todayISO } from '@/lib/format'
import { TIPOS_AUSENCIA, type TipoAusencia } from '@/types/api'

interface FormValues { tipo: TipoAusencia; fecha_inicio: string; fecha_fin: string; nota: string }

export function AusenciaFormModal({ idUsuario, nombre, onClose }: { idUsuario: number; nombre: string; onClose: () => void }) {
  const formId = useId()
  const toast = useToast()
  const mutation = useCreateAusencia(idUsuario)
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: { tipo: 'Vacaciones', fecha_inicio: todayISO(), fecha_fin: todayISO(), nota: '' },
  })
  const inicio = watch('fecha_inicio')

  return (
    <Modal open onClose={onClose} size="sm" title="Registrar ausencia" description={`${nombre} · descuenta su capacidad en esas fechas.`}
      footer={<>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button variant="primary" type="submit" form={formId} loading={mutation.isPending}>Registrar</Button>
      </>}>
      <form id={formId} noValidate className="space-y-4"
        onSubmit={handleSubmit((v) => mutation.mutate(
          { tipo: v.tipo, fecha_inicio: v.fecha_inicio, fecha_fin: v.fecha_fin, nota: emptyToNull(v.nota) },
          { onSuccess: () => { toast.success('Ausencia registrada'); onClose() } },
        ))}>
        <SelectField label="Tipo" required {...register('tipo')}>
          {TIPOS_AUSENCIA.map((t) => <option key={t}>{t}</option>)}
        </SelectField>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField type="date" label="Desde" required error={errors.fecha_inicio?.message} {...register('fecha_inicio', { required: 'Obligatorio' })} />
          <TextField type="date" label="Hasta" required min={inicio} error={errors.fecha_fin?.message}
            {...register('fecha_fin', { required: 'Obligatorio', validate: (v) => v >= inicio || 'No puede ser anterior a «Desde»' })} />
        </div>
        <TextArea label="Nota" rows={2} maxLength={500} {...register('nota')} />
        <FormError error={mutation.error} />
      </form>
    </Modal>
  )
}
