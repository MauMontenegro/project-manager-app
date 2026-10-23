import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { useCreateBloqueo, useEtapas, useProyectos, useTareasProyecto } from '@/api/hooks'
import { usePermisos } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { SelectField, TextArea, TextField } from '@/components/ui/Field'
import { FormError } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { isoToLocal, localToISO, todayISO } from '@/lib/format'
import {
  aplanarProyectos, CAUSAS_RAIZ, ESTADOS_FINALES, RESPONSABLES_ORIGEN, type CausaRaiz, type ResponsableOrigen, type Tarea,
} from '@/types/api'

interface FormValues {
  id_proyecto: string
  id_tarea: string
  id_etapa: string
  causa_raiz: CausaRaiz
  responsable_origen: ResponsableOrigen
  descripcion: string
  responsable_resolucion: string
  fecha_compromiso: string
  inicio: string
}

/** Reporta un bloqueo de una tarea (o, sin tarea, de una etapa). Con `tarea`, queda fija; con `idProyecto`, el
 * proyecto. Lo reporta la persona asignada o quien gestiona el proyecto; no cambia el estatus de la tarea. */
export function BloqueoFormModal({ idProyecto, tarea, onClose }: { idProyecto?: number; tarea?: Tarea; onClose: () => void }) {
  const formId = useId()
  const toast = useToast()
  const permisos = usePermisos()
  const mutation = useCreateBloqueo()
  const proyectos = useProyectos({ limit: 200 })
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      id_proyecto: String(tarea?.id_proyecto ?? idProyecto ?? ''), id_tarea: tarea ? String(tarea.id_tarea) : '', id_etapa: '',
      causa_raiz: CAUSAS_RAIZ[0], responsable_origen: 'DTI', descripcion: '', responsable_resolucion: '', fecha_compromiso: '',
      inicio: isoToLocal(new Date().toISOString()),
    },
  })
  const proyectoSel = Number(watch('id_proyecto')) || 0
  const tareaSel = watch('id_tarea')
  const sinTarea = tareaSel === 'ninguna'
  const proyecto = aplanarProyectos(proyectos.data?.items ?? []).find((p) => p.id_proyecto === proyectoSel)
  const gestiona = !!proyecto && permisos.gestionaProyecto(proyecto)
  const etapas = useEtapas(sinTarea ? proyectoSel : 0)
  const tareas = useTareasProyecto(tarea ? 0 : proyectoSel)
  // Se pueden bloquear las tareas abiertas propias o, quien gestiona el proyecto, cualquiera.
  const opciones = (tareas.data ?? []).filter((t) => t.estado !== 'Finalizado' && (gestiona || permisos.esYo(t.id_usuario)))

  const onSubmit = (v: FormValues) => mutation.mutate(
    {
      ...(sinTarea ? { id_proyecto: Number(v.id_proyecto), id_etapa: Number(v.id_etapa) } : { id_tarea: Number(v.id_tarea) }),
      causa_raiz: v.causa_raiz, responsable_origen: v.responsable_origen,
      descripcion: v.descripcion.trim() || null, responsable_resolucion: v.responsable_resolucion.trim() || null,
      fecha_compromiso: v.fecha_compromiso || null, fecha_inicio_bloqueo: localToISO(v.inicio),
    },
    { onSuccess: () => { toast.success('Bloqueo reportado: la tarea queda marcada y su tiempo empieza a contar'); onClose() } },
  )

  return (
    <Modal open onClose={onClose} size="lg" title="Reportar bloqueo"
      description={tarea ? `«${tarea.titulo}» quedará marcada como bloqueada hasta que se resuelva. Su estatus no cambia.`
        : 'La tarea quedará marcada como bloqueada hasta que se resuelva. Su estatus no cambia.'}
      footer={<>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button variant="primary" type="submit" form={formId} loading={mutation.isPending}>Reportar</Button>
      </>}>
      <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {!tarea && <>
          <SelectField label="Proyecto" required disabled={!!idProyecto} error={errors.id_proyecto?.message}
            {...register('id_proyecto', { required: 'Obligatorio', onChange: () => { setValue('id_tarea', ''); setValue('id_etapa', '') } })}>
            <option value="">Selecciona un proyecto…</option>
            {aplanarProyectos(proyectos.data?.items ?? [])
              .filter((p) => !ESTADOS_FINALES.includes(p.estado_proyecto))
              .map((p) => <option key={p.id_proyecto} value={p.id_proyecto}>{p.nombre_proyecto}</option>)}
          </SelectField>
          <SelectField key={`t-${opciones.length}`} label="Tarea bloqueada" required disabled={!proyectoSel} error={errors.id_tarea?.message}
            hint={proyectoSel && !tareas.isPending && opciones.length === 0 ? 'No hay tareas abiertas que puedas bloquear en este proyecto.' : undefined}
            {...register('id_tarea', { required: 'Obligatorio', onChange: () => setValue('id_etapa', '') })}>
            <option value="">{proyectoSel ? 'Selecciona una tarea…' : 'Primero elige un proyecto'}</option>
            {opciones.map((t) => (
              <option key={t.id_tarea} value={t.id_tarea}>
                {t.titulo} · {t.nombre_usuario}{t.orden_etapa != null ? ` · ${t.orden_etapa}. ${t.nombre_etapa}` : ''}
              </option>
            ))}
            {gestiona && !proyecto?.es_conjunto && <option value="ninguna">Ninguna: afecta a toda una etapa</option>}
          </SelectField>
          {sinTarea && (
            <SelectField label="Etapa afectada" required error={errors.id_etapa?.message} {...register('id_etapa', { required: 'Obligatorio' })}>
              <option value="">Selecciona una etapa…</option>
              {etapas.data?.map((e) => <option key={e.id_etapa} value={e.id_etapa}>{e.orden_secuencia}. {e.nombre_etapa}</option>)}
            </SelectField>
          )}
        </>}
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Causa" required {...register('causa_raiz')}>
            {CAUSAS_RAIZ.map((c) => <option key={c}>{c}</option>)}
          </SelectField>
          <SelectField label="Origen" required hint="De quién depende destrabarlo." {...register('responsable_origen')}>
            {RESPONSABLES_ORIGEN.map((r) => <option key={r}>{r}</option>)}
          </SelectField>
        </div>
        <TextArea label="¿Qué está pasando?" rows={2} maxLength={2000} placeholder="p. ej. No tenemos accesos al servidor de pruebas"
          {...register('descripcion')} />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Quién lo destraba" maxLength={150} placeholder="Persona, área o empresa" {...register('responsable_resolucion')} />
          <TextField type="date" label="Compromiso de solución" min={todayISO()} {...register('fecha_compromiso')} />
          <TextField type="datetime-local" label="Bloqueada desde" required error={errors.inicio?.message}
            max={isoToLocal(new Date().toISOString())}
            {...register('inicio', { required: 'Obligatorio' })} />
        </div>
        <p className="text-xs text-muted">
          El tiempo bloqueado se cuenta en días y horas hábiles del calendario laboral, desde el inicio hasta que se marque como resuelto.
          Las esperas por dependencias se registran solas.
        </p>
        <FormError error={mutation.error} />
      </form>
    </Modal>
  )
}
