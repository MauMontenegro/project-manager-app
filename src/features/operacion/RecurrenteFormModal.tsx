import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { useActualizarRecurrente, useCrearRecurrente, useEtiquetas, useUsuarios } from '@/api/hooks'
import { useAuth, usePermisos } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { SelectField, TextArea, TextField } from '@/components/ui/Field'
import { FormError } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { emptyToNull, num, todayISO } from '@/lib/format'
import { EtiquetasSelector } from '@/features/proyectos/Etiquetas'
import { NuevaEtiqueta } from '@/features/proyectos/NuevaEtiqueta'
import { esDepartamentoProyecto, FRECUENCIAS, type Frecuencia, type TareaRecurrente } from '@/types/api'

interface FormValues {
  titulo: string
  descripcion: string
  id_usuario: string
  frecuencia: Frecuencia
  horas_por_periodo: string
  fecha_inicio: string
  fecha_fin: string
  etiquetas: number[]
}

const required = 'Este campo es obligatorio'
const DIAS_ATRAS_MAX = 31

export const explicacionFrecuencia: Record<Frecuencia, string> = {
  Diaria: 'Una tarea por cada día laborable del calendario.',
  Semanal: 'Una tarea por semana, del lunes al último día laborable.',
  Mensual: 'Una tarea por mes, del día 1 al último día laborable.',
}

const haceDias = (n: number) => {
  const d = new Date(`${todayISO()}T12:00:00`)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

/** Crea o edita una tarea recurrente. Al editar, los cambios aplican a las tareas que se generen después. */
export function RecurrenteFormModal({ recurrente, onClose }: { recurrente?: TareaRecurrente; onClose: () => void }) {
  const editing = !!recurrente
  const formId = useId()
  const toast = useToast()
  const { sesion } = useAuth()
  const permisos = usePermisos()
  const crear = useCrearRecurrente()
  const actualizar = useActualizarRecurrente()
  const mutation = editing ? actualizar : crear
  const personas = useUsuarios({ activo: true })
  const todasEtiquetas = useEtiquetas()

  // Responsables posibles: uno mismo y, si gestiona, las personas de su departamento (el Administrador, todas).
  const responsables = (personas.data ?? []).filter((u) => u.tipo_recurso !== 'Activo'
    && (u.id_usuario === sesion?.id_usuario || permisos.gestionaDepartamento(u.departamento)))

  const { register, handleSubmit, watch, setValue, getValues, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      titulo: recurrente?.titulo ?? '',
      descripcion: recurrente?.descripcion ?? '',
      id_usuario: recurrente ? String(recurrente.id_usuario) : sesion?.id_usuario ? String(sesion.id_usuario) : '',
      frecuencia: recurrente?.frecuencia ?? 'Semanal',
      horas_por_periodo: recurrente ? String(num(recurrente.horas_por_periodo)) : '',
      fecha_inicio: recurrente?.fecha_inicio ?? todayISO(),
      fecha_fin: recurrente?.fecha_fin ?? '',
      etiquetas: recurrente?.etiquetas.map((e) => e.id_etiqueta) ?? [],
    },
  })
  const frecuencia = watch('frecuencia')
  const inicio = watch('fecha_inicio')
  const etiquetas = watch('etiquetas')
  const responsable = personas.data?.find((u) => u.id_usuario === Number(watch('id_usuario')))
  // Etiquetas del departamento del responsable (de todos si su departamento no tiene catálogo, p. ej. Dirección).
  const depto = esDepartamentoProyecto(responsable?.departamento) ? responsable.departamento : null
  const opciones = todasEtiquetas.data?.filter((e) => !depto || e.departamento === depto) ?? []

  const onSubmit = (v: FormValues) => {
    const etiquetasValidas = v.etiquetas.filter((id) => opciones.some((e) => e.id_etiqueta === id))
    const comun = {
      titulo: v.titulo.trim(), descripcion: emptyToNull(v.descripcion.trim()), id_usuario: Number(v.id_usuario),
      horas_por_periodo: v.horas_por_periodo, fecha_fin: emptyToNull(v.fecha_fin), etiquetas: etiquetasValidas,
    }
    const done = () => { toast.success(editing ? 'Tarea recurrente actualizada' : 'Tarea recurrente creada'); onClose() }
    if (editing) return actualizar.mutate({ id_recurrente: recurrente!.id_recurrente, ...comun }, { onSuccess: done })
    crear.mutate({ ...comun, frecuencia: v.frecuencia, fecha_inicio: v.fecha_inicio }, { onSuccess: done })
  }

  return (
    <Modal open onClose={onClose} size="lg" title={editing ? 'Editar tarea recurrente' : 'Nueva tarea recurrente'}
      description={editing ? 'Los cambios aplican a las tareas que se generen después; las ya generadas se editan una por una.'
        : 'Genera una tarea por periodo para su responsable, con su propio estatus, horas y comentarios.'}
      footer={<>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button variant="primary" type="submit" form={formId} loading={mutation.isPending}>{editing ? 'Guardar cambios' : 'Crear'}</Button>
      </>}>
      <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <TextField label="Tarea" required maxLength={200} data-autofocus placeholder="p. ej. Revisar respaldos de servidores"
          error={errors.titulo?.message} {...register('titulo', { validate: (v) => v.trim() !== '' || required })} />

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-fg">Frecuencia <span className="text-danger" aria-hidden>*</span></legend>
          <div role="radiogroup" className="inline-flex rounded-lg border border-border bg-surface p-0.5">
            {FRECUENCIAS.map((f) => (
              <button key={f} type="button" role="radio" aria-checked={frecuencia === f} disabled={editing}
                onClick={() => setValue('frecuencia', f)}
                className={cn('rounded-md px-4 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed',
                  frecuencia === f ? 'bg-brand-soft text-brand' : 'text-muted hover:text-fg disabled:hover:text-muted')}>
                {f}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">{explicacionFrecuencia[frecuencia]}{editing && ' La frecuencia no se cambia: crea otra tarea recurrente.'}</p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          {responsables.length > 1 ? (
            <SelectField key={`resp-${personas.isSuccess}`} label="Responsable" required error={errors.id_usuario?.message}
              {...register('id_usuario', { required })}>
              <option value="">Selecciona…</option>
              {responsables.map((u) => <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}{u.departamento ? ` · ${u.departamento}` : ''}</option>)}
            </SelectField>
          ) : (
            // Solo puede crearlas para sí: el responsable no se elige (queda en el valor por defecto).
            <TextField label="Responsable" value={responsable?.nombre ?? sesion?.nombre ?? ''} readOnly
              error={errors.id_usuario?.message} />
          )}
          <TextField type="number" min={0} step="0.25" label={`Horas por ${frecuencia === 'Diaria' ? 'día' : frecuencia === 'Semanal' ? 'semana' : 'mes'}`}
            required hint="Cuentan en la carga de operación de la persona." error={errors.horas_por_periodo?.message}
            {...register('horas_por_periodo', { required, min: { value: 0, message: 'No puede ser negativo' } })} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField type="date" label="Desde" required disabled={editing} min={editing ? undefined : haceDias(DIAS_ATRAS_MAX)}
            hint={editing ? undefined : 'Si es anterior a hoy, se generan también los periodos pasados.'} error={errors.fecha_inicio?.message}
            {...register('fecha_inicio', {
              required,
              validate: (v) => editing || v >= haceDias(DIAS_ATRAS_MAX) || `No más de ${DIAS_ATRAS_MAX} días atrás`,
            })} />
          <TextField type="date" label="Hasta" min={inicio} hint="Vacío = sin fin." error={errors.fecha_fin?.message}
            {...register('fecha_fin', { validate: (v) => !v || v >= getValues('fecha_inicio') || 'No puede ser anterior al inicio' })} />
        </div>

        <TextArea label="Descripción" rows={2} placeholder="Pasos, criterios o notas para cada periodo" {...register('descripcion')} />

        <div>
          <p className="mb-1.5 text-[13px] font-medium text-fg">Etiquetas</p>
          <EtiquetasSelector label="Etiquetas de la tarea" opciones={opciones} value={etiquetas}
            onChange={(ids) => setValue('etiquetas', ids, { shouldDirty: true })}
            vacio={depto && !permisos.gestionaDepartamentoProyecto(depto) ? `${depto} aún no tiene etiquetas.` : undefined} />
          {depto && permisos.gestionaDepartamentoProyecto(depto) && (
            <NuevaEtiqueta departamentos={[depto]} sugerido={opciones.length}
              onCreada={(id) => setValue('etiquetas', [...getValues('etiquetas'), id], { shouldDirty: true })} />
          )}
        </div>

        <FormError error={mutation.error} />
      </form>
    </Modal>
  )
}
