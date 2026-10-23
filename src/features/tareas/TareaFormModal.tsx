import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { AlertTriangle, Info, Trash2 } from 'lucide-react'
import {
  useAsignaciones, useBloqueos, useCapacidad, useCreateTarea, useDeleteTarea, useEtapas, useInvolucrados, useTareasProyecto,
  useUpdateTarea,
} from '@/api/hooks'
import { useUsuarioMap } from '@/api/lookups'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SelectField, TextArea, TextField } from '@/components/ui/Field'
import { FormError } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { emptyToNull, formatDate, formatHours, num } from '@/lib/format'
import { cn } from '@/lib/cn'
import { formatSemana, lunesISO } from '@/lib/capacidad'
import { fechaFinProyecto, parteTarea, type ProyectoDetalle, type Tarea } from '@/types/api'
import { tonoEstadoTarea } from './TareaDetalleModal'

interface FormValues {
  titulo: string
  descripcion: string
  id_etapa: string
  id_usuario: string
  horas_asignadas: string
  fecha_inicio: string
  fecha_fin: string
  motivo_cambio: string
  id_bloqueo_causa: string
}

/** Crea una tarea o, si recibe `tarea`, la edita. Solo para quien gestiona el proyecto. En un conjunto es una
 * tarea propia (general): sin etapa ni presupuesto. */
export function TareaFormModal({ proyecto, tarea, idEtapaInicial, onClose }: {
  proyecto: ProyectoDetalle
  tarea?: Tarea
  idEtapaInicial?: number
  onClose: () => void
}) {
  const formId = useId()
  const toast = useToast()
  const create = useCreateTarea(proyecto.id_proyecto)
  const update = useUpdateTarea()
  const del = useDeleteTarea()
  const mutation = tarea ? update : create
  const [confirmando, setConfirmando] = useState(false)
  const [dependencias, setDependencias] = useState(() => new Set(tarea?.dependencias.map((d) => d.id_tarea)))
  const esConjunto = proyecto.es_conjunto
  // Un conjunto y sus subproyectos encadenan tareas entre sí: las tareas del conjunto incluyen las de todos.
  const enConjunto = esConjunto || proyecto.padre != null

  // Candidatas: las demás tareas del proyecto (o de todo el conjunto), salvo las que ya esperan (directa o
  // indirectamente) a esta: formarían un ciclo. Primero las del propio proyecto.
  const tareasProyecto = useTareasProyecto(proyecto.padre?.id_proyecto ?? proyecto.id_proyecto)
  const candidatas = (() => {
    const todas = [...(tareasProyecto.data ?? [])]
      .sort((a, b) => Number(a.id_proyecto !== proyecto.id_proyecto) - Number(b.id_proyecto !== proyecto.id_proyecto))
    if (!tarea) return todas
    const porId = new Map(todas.map((t) => [t.id_tarea, t]))
    const excluidas = new Set([tarea.id_tarea])
    const pila = [tarea.id_tarea]
    while (pila.length) {
      for (const d of porId.get(pila.pop()!)?.dependientes ?? []) {
        if (!excluidas.has(d.id_tarea)) { excluidas.add(d.id_tarea); pila.push(d.id_tarea) }
      }
    }
    return todas.filter((t) => !excluidas.has(t.id_tarea))
  })()
  const alternar = (id: number) => setDependencias((s) => {
    const n = new Set(s)
    if (!n.delete(id)) n.add(id)
    return n
  })

  const etapas = useEtapas(proyecto.id_proyecto)
  const asignaciones = useAsignaciones(proyecto.id_proyecto)
  const involucrados = useInvolucrados(proyecto.id_proyecto)
  const { map: usuarios } = useUsuarioMap()
  // Personas con una asignación en el proyecto (en un conjunto, las de sus subproyectos y sus líderes). Al editar se
  // conserva el responsable actual aunque ya no esté asignado.
  const posibles = esConjunto ? involucrados.data?.map((p) => p.id_usuario) : asignaciones.data?.map((a) => a.id_usuario)
  const idsPersonas = [...new Set([...(tarea ? [tarea.id_usuario] : []), ...(posibles ?? [])])]
  const personas = idsPersonas
    .map((id) => ({ id, nombre: usuarios.get(id)?.nombre ?? `Usuario #${id}` }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      titulo: tarea?.titulo ?? '',
      descripcion: tarea?.descripcion ?? '',
      id_etapa: String(tarea?.id_etapa ?? idEtapaInicial ?? ''),
      id_usuario: tarea ? String(tarea.id_usuario) : '',
      horas_asignadas: tarea ? String(num(tarea.horas_asignadas)) : '',
      fecha_inicio: tarea?.fecha_inicio ?? '',
      fecha_fin: tarea?.fecha_fin ?? '',
      motivo_cambio: '',
      id_bloqueo_causa: '',
    },
  })
  const inicio = watch('fecha_inicio')
  const horas = Number(watch('horas_asignadas') || 0)
  const [idUsuario, fin] = watch(['id_usuario', 'fecha_fin'])
  // Retrasar la fecha límite de una tarea existente exige motivo (y, si aplica, el bloqueo que lo causó).
  const retrasa = !!tarea && !!fin && fin > tarea.fecha_fin
  const bloqueosCausa = useBloqueos({ id_tarea: tarea?.id_tarea, limit: 50 }, retrasa).data ?? []

  // Límites del proyecto: sus fechas y las horas que quedan del presupuesto (sin contar esta tarea al editar).
  const pInicio = proyecto.fecha_inicio
  const pFin = fechaFinProyecto(proyecto)
  // El presupuesto de un conjunto es la suma del de sus subproyectos: sus tareas propias no lo consumen.
  const presupuesto = proyecto.horas_presupuestadas == null || esConjunto ? null : num(proyecto.horas_presupuestadas)
  const disponibles = presupuesto == null ? null : presupuesto - num(proyecto.horas_en_tareas) + (tarea ? num(tarea.horas_asignadas) : 0)
  const dentroDelProyecto = (v: string) =>
    !v || ((!pInicio || v >= pInicio) && (!pFin || v <= pFin)) ||
    `Debe estar entre ${pInicio ? formatDate(pInicio) : 'el inicio'} y ${pFin ? formatDate(pFin) : 'el fin'} del proyecto`

  const onSubmit = (v: FormValues) => {
    const body = {
      titulo: v.titulo.trim(),
      descripcion: emptyToNull(v.descripcion.trim()),
      id_etapa: esConjunto ? null : Number(v.id_etapa),
      id_usuario: Number(v.id_usuario),
      horas_asignadas: v.horas_asignadas,
      fecha_inicio: v.fecha_inicio,
      fecha_fin: v.fecha_fin,
      dependencias: [...dependencias],
      ...(tarea && (v.fecha_inicio !== tarea.fecha_inicio || v.fecha_fin !== tarea.fecha_fin) && {
        motivo_cambio: v.motivo_cambio.trim() || null,
        id_bloqueo_causa: v.id_bloqueo_causa ? Number(v.id_bloqueo_causa) : null,
      }),
    }
    const done = () => { toast.success(tarea ? 'Tarea actualizada' : 'Tarea creada'); onClose() }
    if (tarea) update.mutate({ id_tarea: tarea.id_tarea, ...body }, { onSuccess: done })
    else create.mutate(body, { onSuccess: done })
  }

  const eliminar = () => tarea && del.mutate(tarea.id_tarea, {
    onSuccess: () => { toast.success('Tarea eliminada'); onClose() },
  })

  return (
    <Modal open onClose={onClose} title={tarea ? 'Editar tarea' : esConjunto ? 'Nueva tarea general' : 'Nueva tarea'}
      description={esConjunto
        ? 'Tarea del proyecto conjunto que no pertenece a ningún departamento (p. ej. de coordinación). No tiene etapa ni cuenta en el avance, que se consolida de los subproyectos.'
        : 'La tarea solo la puede mover la persona asignada o quien gestiona el proyecto. Al finalizarla se actualiza el avance.'}
      footer={<>
        {tarea && (confirmando ? (
          <Button variant="danger" className="mr-auto" loading={del.isPending} onClick={eliminar}>Confirmar eliminación</Button>
        ) : (
          <Button variant="ghost" className="mr-auto text-danger hover:text-danger" icon={<Trash2 className="size-4" />}
            onClick={() => setConfirmando(true)}>Eliminar</Button>
        ))}
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button variant="primary" type="submit" form={formId} loading={mutation.isPending}>{tarea ? 'Guardar' : 'Crear tarea'}</Button>
      </>}>
      <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <dl className="grid gap-3 rounded-lg border border-border bg-surface-2/50 p-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Fechas del proyecto</dt>
            <dd className="font-medium tabular-nums">
              {pInicio || pFin ? `${pInicio ? formatDate(pInicio) : 'Sin inicio'} → ${pFin ? formatDate(pFin) : 'Sin fin'}` : 'Sin fechas definidas'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Horas disponibles del presupuesto</dt>
            <dd className={cn('font-medium tabular-nums', disponibles != null && horas > disponibles && 'text-danger')}>
              {esConjunto ? 'No consume presupuesto' : disponibles == null ? 'Sin presupuesto (sin límite)'
                : `${formatHours(Math.max(disponibles - horas, 0))} de ${formatHours(presupuesto)}${horas > 0 ? ` (tras esta tarea)` : ''}`}
            </dd>
          </div>
        </dl>
        <TextField label="Título" required maxLength={200} error={errors.titulo?.message}
          {...register('titulo', { validate: (v) => v.trim() !== '' || 'Obligatorio' })} />
        <TextArea label="Descripción" rows={3} {...register('descripcion')} />
        <div className="grid gap-4 sm:grid-cols-2">
          {/* key: remonta el select al llegar las opciones para mostrar el valor precargado. */}
          {!esConjunto && (
            <SelectField key={`e-${etapas.data?.length}`} label="Etapa" required error={errors.id_etapa?.message}
              {...register('id_etapa', { required: 'Obligatorio' })}>
              <option value="">Selecciona…</option>
              {etapas.data?.map((e) => <option key={e.id_etapa} value={e.id_etapa}>{e.orden_secuencia}. {e.nombre_etapa}</option>)}
            </SelectField>
          )}
          <SelectField key={`p-${personas.length}-${usuarios.size}`} label="Responsable" required error={errors.id_usuario?.message}
            hint={esConjunto ? 'Líderes y personas asignadas en los subproyectos.'
              : asignaciones.data?.length === 0 ? 'Nadie está asignado: asigna personas al proyecto en Asignaciones.' : undefined}
            {...register('id_usuario', { required: 'Obligatorio' })}>
            <option value="">Selecciona…</option>
            {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.id === proyecto.lider_id ? ' (líder)' : ''}</option>)}
          </SelectField>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField type="number" min={0} max={disponibles ?? undefined} step="0.5" label="Horas asignadas" required
            error={errors.horas_asignadas?.message}
            hint={disponibles != null ? `Máximo ${formatHours(Math.max(disponibles, 0))}` : undefined}
            {...register('horas_asignadas', {
              required: 'Obligatorio', min: { value: 0, message: 'No puede ser negativo' },
              validate: (v) => disponibles == null || Number(v) <= disponibles || `Excede el presupuesto: quedan ${formatHours(Math.max(disponibles, 0))}`,
            })} />
          <TextField type="date" label="Inicio" required min={pInicio ?? undefined} max={pFin ?? undefined} error={errors.fecha_inicio?.message}
            {...register('fecha_inicio', { required: 'Obligatorio', validate: dentroDelProyecto })} />
          <TextField type="date" label="Fecha límite" required min={inicio || pInicio || undefined} max={pFin ?? undefined} error={errors.fecha_fin?.message}
            {...register('fecha_fin', {
              required: 'Obligatorio',
              validate: (v) => (inicio && v < inicio ? 'No puede ser anterior al inicio' : dentroDelProyecto(v)),
            })} />
        </div>
        {retrasa && (
          <div className="space-y-3 rounded-lg border border-warn/40 bg-warn-soft/50 p-3">
            <p className="flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
              <span>
                Estás retrasando la fecha límite ({formatDate(tarea!.fecha_fin)} → {formatDate(fin)}). Queda como reprogramación y cuenta en el desfase
                {tarea!.fecha_fin_base && <> contra el plan original ({formatDate(tarea!.fecha_fin_base)})</>}.
              </span>
            </p>
            <TextArea label="Motivo del retraso" required rows={2} maxLength={1000} error={errors.motivo_cambio?.message}
              {...register('motivo_cambio', { validate: (v) => !retrasa || v.trim() !== '' || 'Indica por qué se retrasa' })} />
            {bloqueosCausa.length > 0 && (
              <SelectField label="¿Lo causó un bloqueo?" hint="Así el desfase se atribuye a esa causa y origen." {...register('id_bloqueo_causa')}>
                <option value="">No</option>
                {bloqueosCausa.map((b) => (
                  <option key={b.id_bloqueo} value={b.id_bloqueo}>
                    {b.causa_raiz} ({b.responsable_origen}) · {formatDate(b.fecha_inicio_bloqueo.slice(0, 10))}{b.fecha_fin_bloqueo ? '' : ' · abierto'}
                  </option>
                ))}
              </SelectField>
            )}
          </div>
        )}
        {idUsuario && (
          <CargaSemanal idUsuario={Number(idUsuario)} nombre={usuarios.get(Number(idUsuario))?.nombre ?? 'La persona'}
            horas={horas} inicio={inicio} fin={fin} tarea={tarea} />
        )}
        <fieldset>
          <legend className="text-[13px] font-medium text-fg">Depende de</legend>
          <p className="mt-0.5 text-xs text-muted">
            No podrá pasar a “En progreso” hasta que las tareas elegidas estén finalizadas.
            {enConjunto && ' Puede depender de tareas de cualquier departamento del proyecto conjunto.'}
          </p>
          {candidatas.length === 0 ? (
            <p className="mt-2 text-sm text-muted">{tareasProyecto.isPending ? 'Cargando tareas…' : 'No hay otras tareas en el proyecto.'}</p>
          ) : (
            <ul className="mt-2 max-h-48 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {candidatas.map((t) => (
                <li key={t.id_tarea}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2">
                    <input type="checkbox" className="accent-[var(--brand)]" checked={dependencias.has(t.id_tarea)}
                      onChange={() => alternar(t.id_tarea)} />
                    <span className="flex-1 truncate">
                      {t.titulo}
                      <span className="text-xs text-muted">
                        {enConjunto && <> · <span className={cn(t.id_proyecto !== proyecto.id_proyecto && 'font-medium text-fg')}>{parteTarea(t)}</span></>}
                        {t.orden_etapa != null && ` · ${t.orden_etapa}. ${t.nombre_etapa}`}
                      </span>
                    </span>
                    <Badge tone={tonoEstadoTarea[t.estado]}>{t.estado}</Badge>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
        <FormError error={mutation.error ?? del.error} />
      </form>
    </Modal>
  )
}

const fecha = (v: string) => new Date(`${v}T00:00`)

/** Horas de una tarea por semana (lunes ISO), repartidas entre sus días hábiles como en la API
 * (o entre sus días naturales si el rango no tiene hábiles). */
function horasPorSemana(horas: number, inicio: string, fin: string): Map<string, number> {
  const dias: Date[] = []
  for (const d = fecha(inicio); d <= fecha(fin); d.setDate(d.getDate() + 1)) dias.push(new Date(d))
  const habiles = dias.filter((d) => d.getDay() >= 1 && d.getDay() <= 5)
  const base = habiles.length ? habiles : dias
  const res = new Map<string, number>()
  for (const d of base) res.set(lunesISO(d), (res.get(lunesISO(d)) ?? 0) + horas / base.length)
  return res
}

/** Cómo queda la carga semanal de la persona con esta tarea (aviso, no bloquea). */
function CargaSemanal({ idUsuario, nombre, horas, inicio, fin, tarea }: {
  idUsuario: number; nombre: string; horas: number; inicio: string; fin: string; tarea?: Tarea
}) {
  const valido = !!inicio && !!fin && fin >= inicio
  const semanas = valido ? Math.min(26, Math.round((fecha(lunesISO(fecha(fin))).getTime() - fecha(lunesISO(fecha(inicio))).getTime()) / (7 * 864e5)) + 1) : 1
  const cap = useCapacidad({ id_usuario: idUsuario, desde: valido ? lunesISO(fecha(inicio)) : lunesISO(), semanas }, valido)

  if (!valido) {
    return <Aviso tono="info">Indica inicio y fecha límite para ver cómo queda la carga semanal de {nombre}.</Aviso>
  }
  if (cap.isPending) return <div className="h-12 animate-pulse rounded-lg bg-surface-2" />
  // Al editar, la versión guardada de la tarea ya está en la carga: se resta para no contarla dos veces.
  const previa = tarea && tarea.id_usuario === idUsuario && tarea.estado !== 'Finalizado'
    ? horasPorSemana(num(tarea.horas_asignadas), tarea.fecha_inicio, tarea.fecha_fin)
    : new Map<string, number>()
  const nueva = horasPorSemana(horas, inicio, fin)
  let pico: { semana: string; pct: number } | null = null
  for (const s of cap.data?.[0]?.semanas ?? []) {
    const total = num(s.horas_asignadas) - (previa.get(s.inicio) ?? 0) + (nueva.get(s.inicio) ?? 0)
    const disp = num(s.horas_disponibles)
    const pct = disp > 0 ? (total / disp) * 100 : total > 0 ? Infinity : 0
    if (!pico || pct > pico.pct) pico = { semana: s.inicio, pct }
  }
  if (!pico) return null
  const texto = Number.isFinite(pico.pct) ? `${Math.round(pico.pct)} %` : 'sin capacidad (ausente)'
  return pico.pct > 100
    ? <Aviso tono="warn"><strong className="text-fg">{nombre} quedaría sobrecargado:</strong> {texto} la semana del {formatSemana(pico.semana)}. Reparte el trabajo o ajusta fechas.</Aviso>
    : <Aviso tono="info">Con esta tarea, la semana más cargada de {nombre} ({formatSemana(pico.semana)}) queda en {texto}.</Aviso>
}

function Aviso({ tono, children }: { tono: 'info' | 'warn'; children: React.ReactNode }) {
  return (
    <p role="status" className={cn('flex gap-2 rounded-lg border p-3 text-sm',
      tono === 'warn' ? 'border-warn/30 bg-warn-soft' : 'border-border bg-surface-2/50 text-muted')}>
      {tono === 'warn' ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden /> : <Info className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <span>{children}</span>
    </p>
  )
}
