import { useId, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { useCapacidad, useCreateAsignacion, usePuestos, useUsuarios } from '@/api/hooks'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { FormError } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { formatSemana, lunesISO } from '@/lib/capacidad'
import { num } from '@/lib/format'
import { fechaFinProyecto, type Etapa, type Proyecto, type Usuario } from '@/types/api'

interface FormValues {
  id_usuario: string
  id_etapa: string
  perfil_requerido: string
}

const MS_SEMANA = 7 * 24 * 3600 * 1000

/** Semanas (1–26) desde hoy que abarca la etapa (o, sin fechas, el proyecto); sin fin se proyectan 12. */
function horizonte(etapa: Etapa | undefined, proyecto: Proyecto): { desde: string; semanas: number } {
  const desde = lunesISO()
  const fin = etapa?.fecha_fin_est ?? fechaFinProyecto(proyecto)
  if (!fin) return { desde, semanas: 12 }
  const semanas = Math.ceil((new Date(`${fin}T00:00`).getTime() - new Date(`${desde}T00:00`).getTime() + 1) / MS_SEMANA)
  return { desde, semanas: Math.min(26, Math.max(1, semanas)) }
}

export function AsignacionFormModal({ proyecto, etapas, onClose }: {
  proyecto: Proyecto; etapas: Etapa[]; onClose: () => void
}) {
  const formId = useId()
  const toast = useToast()
  const mutation = useCreateAsignacion(proyecto.id_proyecto)
  const usuarios = useUsuarios({ activo: true })
  const puestos = usePuestos()
  const puestoNombre = new Map(puestos.data?.map((p) => [p.id_puesto, p.nombre_puesto]))
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: { id_usuario: '', id_etapa: etapas[0] ? String(etapas[0].id_etapa) : '', perfil_requerido: '' },
  })

  const [idUsuario, idEtapa] = watch(['id_usuario', 'id_etapa'])
  const persona = usuarios.data?.find((u) => String(u.id_usuario) === idUsuario)
  const etapa = etapas.find((e) => String(e.id_etapa) === idEtapa)

  const onSubmit = (v: FormValues) =>
    mutation.mutate(
      {
        id_usuario: Number(v.id_usuario),
        id_etapa: Number(v.id_etapa),
        perfil_requerido: v.perfil_requerido.trim(),
      },
      { onSuccess: () => { toast.success('Recurso asignado'); onClose() } },
    )

  return (
    <Modal open onClose={onClose} title="Asignar recurso" description="La asignación indica quién participa en la etapa y con qué rol. Su carga se calcula con las tareas que se le asignen."
      footer={<>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button variant="primary" type="submit" form={formId} loading={mutation.isPending}>Asignar</Button>
      </>}>
      <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <SelectField label="Etapa" required error={errors.id_etapa?.message} {...register('id_etapa', { required: 'Obligatorio' })}>
          {etapas.map((e) => <option key={e.id_etapa} value={e.id_etapa}>{e.orden_secuencia}. {e.nombre_etapa}</option>)}
        </SelectField>
        <SelectField label="Recurso" required error={errors.id_usuario?.message}
          {...register('id_usuario', {
            required: 'Obligatorio',
            onChange: (e) => {
              const u = usuarios.data?.find((x) => String(x.id_usuario) === e.target.value)
              const puesto = u?.id_puesto ? puestoNombre.get(u.id_puesto) : undefined
              if (puesto) setValue('perfil_requerido', puesto)
            },
          })}>
          <option value="">Selecciona un recurso…</option>
          {usuarios.data?.map((u) => (
            <option key={u.id_usuario} value={u.id_usuario}>
              {u.nombre}{u.id_puesto && puestoNombre.has(u.id_puesto) ? ` · ${puestoNombre.get(u.id_puesto)}` : u.tipo_recurso === 'Activo' ? ' · Activo' : ''}
            </option>
          ))}
        </SelectField>
        <TextField label="Rol desempeñado" required maxLength={100} error={errors.perfil_requerido?.message}
          {...register('perfil_requerido', { validate: (v) => v.trim() !== '' || 'Obligatorio' })} />
        {persona && <CargaActual persona={persona} etapa={etapa} proyecto={proyecto} />}
        <FormError error={mutation.error} />
      </form>
    </Modal>
  )
}

const ESTILO = {
  ok: { caja: 'border-ok/30 bg-ok-soft', icono: 'text-ok' },
  warn: { caja: 'border-warn/30 bg-warn-soft', icono: 'text-warn' },
  danger: { caja: 'border-danger/30 bg-danger-soft', icono: 'text-danger' },
} as const

/** Carga actual de la persona (por sus tareas) en el periodo de la etapa, para decidir si conviene asignarla. */
function CargaActual({ persona, etapa, proyecto }: { persona: Usuario; etapa?: Etapa; proyecto: Proyecto }) {
  const { desde, semanas } = horizonte(etapa, proyecto)
  const cap = useCapacidad({ id_usuario: persona.id_usuario, desde, semanas })
  const pico = useMemo(() => {
    let peor: { semana: string; pct: number } | null = null
    for (const s of cap.data?.[0]?.semanas ?? []) {
      const disp = num(s.horas_disponibles)
      const pct = disp > 0 ? (num(s.horas_asignadas) / disp) * 100 : num(s.horas_asignadas) > 0 ? Infinity : 0
      if (!peor || pct > peor.pct) peor = { semana: s.inicio, pct }
    }
    return peor
  }, [cap.data])

  if (cap.isPending || !pico) return <div className="h-14 animate-pulse rounded-lg bg-surface-2" />
  const libre = pico.pct === 0
  const tono = pico.pct > 100 ? 'danger' : pico.pct >= 85 ? 'warn' : 'ok'
  const Icono = libre ? Info : tono === 'ok' ? CheckCircle2 : AlertTriangle
  return (
    <div role="status" className={cn('flex gap-3 rounded-lg border p-3 text-sm',
      libre ? 'border-border bg-surface-2/50' : ESTILO[tono].caja)}>
      <Icono className={cn('mt-0.5 size-4 shrink-0', libre ? 'text-muted' : ESTILO[tono].icono)} aria-hidden />
      <p className="text-fg">
        {libre ? `${persona.nombre} no tiene tareas en las próximas ${semanas} semanas.`
          : <>Semana más cargada de {persona.nombre} en el periodo ({formatSemana(pico.semana)}): <strong className="tabular-nums">{Number.isFinite(pico.pct) ? `${Math.round(pico.pct)} %` : 'sin capacidad'}</strong>.</>}
        <span className="block text-xs text-muted">Su carga sube conforme se le asignen tareas con horas y fechas.</span>
      </p>
    </div>
  )
}
