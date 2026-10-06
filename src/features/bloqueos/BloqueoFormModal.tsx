import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { useCreateBloqueo, useEtapas, useProyectos } from '@/api/hooks'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { FormError } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { isoToLocal, localToISO } from '@/lib/format'
import { CAUSAS_RAIZ, RESPONSABLES_ORIGEN, type CausaRaiz, type ResponsableOrigen } from '@/types/api'

interface FormValues {
  id_proyecto: string
  id_etapa: string
  causa_raiz: CausaRaiz
  responsable_origen: ResponsableOrigen
  inicio: string
  fin: string
}

/** Reporta un bloqueo. Si recibe `idProyecto`, el proyecto queda fijo. */
export function BloqueoFormModal({ idProyecto, onClose }: { idProyecto?: number; onClose: () => void }) {
  const formId = useId()
  const toast = useToast()
  const mutation = useCreateBloqueo()
  const proyectos = useProyectos({ limit: 200 })
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      id_proyecto: idProyecto ? String(idProyecto) : '', id_etapa: '', causa_raiz: CAUSAS_RAIZ[0],
      responsable_origen: 'DTI', inicio: isoToLocal(new Date().toISOString()), fin: '',
    },
  })
  const proyectoSel = Number(watch('id_proyecto')) || 0
  const inicio = watch('inicio')
  const etapas = useEtapas(proyectoSel)

  const onSubmit = (v: FormValues) =>
    mutation.mutate(
      {
        id_proyecto: Number(v.id_proyecto),
        id_etapa: Number(v.id_etapa),
        causa_raiz: v.causa_raiz,
        responsable_origen: v.responsable_origen,
        fecha_inicio_bloqueo: localToISO(v.inicio),
        fecha_fin_bloqueo: localToISO(v.fin) ?? null,
      },
      { onSuccess: () => { toast.success('Bloqueo reportado'); onClose() } },
    )

  return (
    <Modal open onClose={onClose} title="Reportar bloqueo" description="Sin fecha de fin, el bloqueo queda abierto."
      footer={<>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button variant="primary" type="submit" form={formId} loading={mutation.isPending}>Reportar</Button>
      </>}>
      <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <SelectField label="Proyecto" required disabled={!!idProyecto} error={errors.id_proyecto?.message}
          {...register('id_proyecto', { required: 'Obligatorio', onChange: () => setValue('id_etapa', '') })}>
          <option value="">Selecciona un proyecto…</option>
          {proyectos.data?.items.map((p) => <option key={p.id_proyecto} value={p.id_proyecto}>{p.nombre_proyecto}</option>)}
        </SelectField>
        <SelectField label="Etapa afectada" required disabled={!proyectoSel} error={errors.id_etapa?.message}
          hint={proyectoSel && etapas.data?.length === 0 ? 'Este proyecto aún no tiene etapas.' : undefined}
          {...register('id_etapa', { required: 'Obligatorio' })}>
          <option value="">{proyectoSel ? 'Selecciona una etapa…' : 'Primero elige un proyecto'}</option>
          {etapas.data?.map((e) => <option key={e.id_etapa} value={e.id_etapa}>{e.orden_secuencia}. {e.nombre_etapa}</option>)}
        </SelectField>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Causa raíz" required {...register('causa_raiz')}>
            {CAUSAS_RAIZ.map((c) => <option key={c}>{c}</option>)}
          </SelectField>
          <SelectField label="Responsable de origen" required {...register('responsable_origen')}>
            {RESPONSABLES_ORIGEN.map((r) => <option key={r}>{r}</option>)}
          </SelectField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField type="datetime-local" label="Inicio" required error={errors.inicio?.message}
            {...register('inicio', { required: 'Obligatorio' })} />
          <TextField type="datetime-local" label="Fin (opcional)" error={errors.fin?.message}
            {...register('fin', { validate: (v) => !v || !inicio || v >= inicio || 'No puede ser anterior al inicio' })} />
        </div>
        <FormError error={mutation.error} />
      </form>
    </Modal>
  )
}
