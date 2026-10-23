import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Trash2 } from 'lucide-react'
import { useDeleteTarea, useUpdateTarea } from '@/api/hooks'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TextArea, TextField } from '@/components/ui/Field'
import { FormError } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { emptyToNull, num } from '@/lib/format'
import { origenTarea } from '@/features/tareas/fechas'
import type { Tarea } from '@/types/api'

interface FormValues { titulo: string; descripcion: string; horas_asignadas: string; fecha_inicio: string; fecha_fin: string }

const required = 'Este campo es obligatorio'

/** Edita la tarea de un periodo (solo esa; la tarea recurrente no cambia) o la quita. */
export function TareaOperacionModal({ tarea, onClose }: { tarea: Tarea; onClose: () => void }) {
  const formId = useId()
  const toast = useToast()
  const update = useUpdateTarea()
  const del = useDeleteTarea()
  const [quitando, setQuitando] = useState(false)
  const { register, handleSubmit, getValues, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      titulo: tarea.titulo, descripcion: tarea.descripcion ?? '', horas_asignadas: String(num(tarea.horas_asignadas)),
      fecha_inicio: tarea.fecha_inicio, fecha_fin: tarea.fecha_fin,
    },
  })

  const onSubmit = (v: FormValues) => update.mutate({
    id_tarea: tarea.id_tarea, titulo: v.titulo.trim(), descripcion: emptyToNull(v.descripcion.trim()),
    horas_asignadas: v.horas_asignadas, fecha_inicio: v.fecha_inicio, fecha_fin: v.fecha_fin,
  }, { onSuccess: () => { toast.success('Tarea actualizada'); onClose() } })

  return (
    <Modal open onClose={onClose} title="Editar tarea" description={`${origenTarea(tarea)} · solo este periodo`}
      footer={<>
        <Button variant="ghost" className="mr-auto text-danger hover:text-danger" icon={<Trash2 className="size-4" />}
          onClick={() => setQuitando(true)}>Quitar</Button>
        <Button onClick={onClose} disabled={update.isPending}>Cancelar</Button>
        <Button variant="primary" type="submit" form={formId} loading={update.isPending}>Guardar</Button>
      </>}>
      <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <TextField label="Tarea" required maxLength={200} error={errors.titulo?.message}
          {...register('titulo', { validate: (v) => v.trim() !== '' || required })} />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField type="number" min={0} step="0.25" label="Horas" required error={errors.horas_asignadas?.message}
            {...register('horas_asignadas', { required, min: { value: 0, message: 'No puede ser negativo' } })} />
          <TextField type="date" label="Inicio" required error={errors.fecha_inicio?.message} {...register('fecha_inicio', { required })} />
          <TextField type="date" label="Fecha límite" required error={errors.fecha_fin?.message}
            {...register('fecha_fin', { required, validate: (v) => v >= getValues('fecha_inicio') || 'No puede ser anterior al inicio' })} />
        </div>
        <TextArea label="Descripción" rows={3} {...register('descripcion')} />
        <FormError error={update.error} />
      </form>
      {quitando && (
        <ConfirmDialog open danger title="Quitar tarea" confirmLabel="Quitar" loading={del.isPending} error={del.error}
          onClose={() => setQuitando(false)}
          onConfirm={() => del.mutate(tarea.id_tarea, { onSuccess: () => { toast.success('Tarea quitada'); onClose() } })}>
          <p>Se eliminará la tarea de este periodo con sus comentarios (p. ej. un día que no aplica). La tarea recurrente sigue generando las siguientes.</p>
        </ConfirmDialog>
      )}
    </Modal>
  )
}
