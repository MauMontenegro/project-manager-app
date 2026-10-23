import { useEffect, useId, useState, type ReactNode } from 'react'
import { useFieldArray, useForm, type UseFormReturn } from 'react-hook-form'
import { Check, Layers, Plus, Trash2 } from 'lucide-react'
import {
  useAreas, useCreateProyecto, useEmpresas, useEtiquetas, useHorasLaborales, usePlantillaEtapas, useUpdateProyecto,
  useUsuarios, useEquiposTrabajo } from '@/api/hooks'
import { useAuth, usePermisos } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { SelectField, TextArea, TextField } from '@/components/ui/Field'
import { FormError } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { emptyToNull, formatHours, num } from '@/lib/format'
import {
  DEPARTAMENTOS_PROYECTO, NIVELES_IMPACTO, type DepartamentoProyecto, type Empresa, type NivelImpacto,
  type ProyectoDetalle, type Usuario,
} from '@/types/api'
import { EtiquetasSelector } from './Etiquetas'
import { NuevaEtiqueta } from './NuevaEtiqueta'

interface FormValues {
  nombre_proyecto: string
  objetivo: string
  problema_oportunidad: string
  alcance: string
  fuera_de_alcance: string
  lider_id: string
  fecha_inicio: string
  fecha_tentativa: string
  fecha_comprometida: string
  horas_presupuestadas: string
  /** true: el presupuesto se fija a mano; false: se calcula con el calendario laboral. */
  presupuesto_manual: boolean
  empresas: Array<{ id_empresa: string; id_area: string; nivel_impacto: NivelImpacto; notas_impacto: string }>
  /** Al crear: los departamentos participantes. Uno = proyecto del departamento; dos o más = conjunto. */
  deptos: DepartamentoProyecto[]
  /** Al crear un conjunto: líder del subproyecto de cada departamento. */
  lideres: Partial<Record<DepartamentoProyecto, string>>
  /** Al editar un proyecto normal: su departamento. */
  departamento: DepartamentoProyecto | ''
  etiquetas: number[]
  /** Equipo de trabajo (opcional); '' = sin equipo. */
  id_equipo_trabajo: string
}

const required = 'Este campo es obligatorio'
const notBlank = (v: string) => v.trim() !== '' || required

/** Crea un proyecto o, si recibe `proyecto`, edita sus campos editables. Al crear, el tipo sale de los
 * departamentos elegidos: con uno es un proyecto del departamento; con varios, un proyecto conjunto. */
export function ProyectoFormModal({ proyecto, departamentoInicial, equipoTrabajoInicial, onClose, onSaved }: {
  proyecto?: ProyectoDetalle
  /** Al crear: el departamento preseleccionado (el espacio desde el que se crea). */
  departamentoInicial?: DepartamentoProyecto
  /** Al crear: el equipo de trabajo preseleccionado (el activo en la barra lateral). */
  equipoTrabajoInicial?: number
  onClose: () => void
  onSaved?: (p: ProyectoDetalle) => void
}) {
  const editing = !!proyecto
  const formId = useId()
  const toast = useToast()
  const { sesion } = useAuth()
  const permisos = usePermisos()
  const create = useCreateProyecto()
  const update = useUpdateProyecto(proyecto?.id_proyecto ?? 0)
  const mutation = editing ? update : create
  const [errorDeptos, setErrorDeptos] = useState<string>()

  const personas = useUsuarios({ activo: true })
  const empresas = useEmpresas()
  const todasEtiquetas = useEtiquetas()
  const equiposTrabajo = useEquiposTrabajo()
  const lideres = (personas.data ?? []).filter((u) => u.tipo_recurso !== 'Activo')

  // Departamentos en los que quien edita puede crear un proyecto propio o al que puede moverlo.
  // Al crear: donde puede crear (Gerente o Líder, el suyo). Al mover: solo Gerente o Administrador.
  const permitidos = DEPARTAMENTOS_PROYECTO.filter((d) => d === proyecto?.departamento
    || (proyecto ? permisos.gestionaDepartamentoProyecto(d) : permisos.creaProyectosEn(d)))
  const esSubproyecto = !!proyecto?.id_proyecto_padre
  const inicial = departamentoInicial && permitidos.includes(departamentoInicial) ? departamentoInicial : permitidos[0]

  const form = useForm<FormValues>({
    defaultValues: {
      nombre_proyecto: proyecto?.nombre_proyecto ?? '',
      objetivo: proyecto?.objetivo ?? '',
      problema_oportunidad: proyecto?.problema_oportunidad ?? '',
      alcance: proyecto?.alcance ?? '',
      fuera_de_alcance: proyecto?.fuera_de_alcance ?? '',
      // Quien crea lidera por defecto.
      lider_id: proyecto ? String(proyecto.lider_id) : sesion?.id_usuario ? String(sesion.id_usuario) : '',
      fecha_inicio: proyecto?.fecha_inicio ?? '',
      fecha_tentativa: proyecto?.fecha_tentativa ?? '',
      fecha_comprometida: proyecto?.fecha_comprometida ?? '',
      horas_presupuestadas: proyecto?.horas_presupuestadas != null ? String(num(proyecto.horas_presupuestadas)) : '',
      presupuesto_manual: proyecto?.horas_presupuestadas_manual ?? false,
      empresas: proyecto?.empresas_impactadas.map((e) => ({
        id_empresa: String(e.id_empresa),
        id_area: e.id_area === null ? '' : String(e.id_area),
        nivel_impacto: e.nivel_impacto,
        notas_impacto: e.notas_impacto ?? '',
      })) ?? [],
      deptos: inicial ? [inicial] : [],
      lideres: {},
      departamento: proyecto?.departamento ?? '',
      etiquetas: proyecto?.etiquetas.map((e) => e.id_etiqueta) ?? [],
      id_equipo_trabajo: String(proyecto ? proyecto.id_equipo_trabajo ?? '' : equipoTrabajoInicial ?? ''),
    },
  })
  const { register, handleSubmit, control, setError, setValue, getValues, watch, formState: { errors } } = form
  const deptos = watch('deptos')
  const departamento = watch('departamento')
  const conjunto = editing ? proyecto!.es_conjunto : deptos.length > 1

  // En un conjunto, cada subproyecto lo lidera por defecto el Gerente de su departamento.
  const gerenteDe = (d: DepartamentoProyecto) => lideres.find((u) => u.rol === 'Gerente' && u.departamento === d)
  useEffect(() => {
    if (editing) return
    for (const d of deptos) {
      const g = gerenteDe(d)
      if (!getValues(`lideres.${d}`) && g) setValue(`lideres.${d}`, String(g.id_usuario))
    }
  }, [deptos, personas.data]) // eslint-disable-line react-hooks/exhaustive-deps

  // Departamentos cuyas etiquetas aplican: el del proyecto o los participantes del conjunto.
  const departamentosEtiquetas: string[] = editing
    ? proyecto!.es_conjunto ? proyecto!.subproyectos.map((s) => s.departamento!) : departamento ? [departamento] : []
    : deptos
  const opcionesEtiquetas = todasEtiquetas.data?.filter((e) => departamentosEtiquetas.includes(e.departamento)) ?? []
  const etiquetas = watch('etiquetas')
  // Etiquetas nuevas: solo en los departamentos del proyecto que gestiona quien captura.
  const puedeCrearEn = DEPARTAMENTOS_PROYECTO.filter((d) => departamentosEtiquetas.includes(d) && permisos.gestionaDepartamentoProyecto(d))
  const plantilla = usePlantillaEtapas(!editing && deptos.length === 1 ? deptos[0] : null)

  const inicio = watch('fecha_inicio')
  const fin = watch('fecha_comprometida') || watch('fecha_tentativa')
  const manual = watch('presupuesto_manual')
  const calculo = useHorasLaborales(inicio || null, fin || null)
  const enTareas = editing ? num(proyecto!.horas_en_tareas) : 0
  const antesDelInicio = (v: string) => !v || !inicio || v >= inicio || 'No puede ser anterior al inicio'
  const { fields, append, remove } = useFieldArray({ control, name: 'empresas' })

  // Un proyecto de un solo departamento lo crea su Gerente (o el Administrador); un conjunto, cualquier Gerente.
  // Un Líder solo crea proyectos de su departamento (no conjuntos).
  const validarDeptos = (lista: DepartamentoProyecto[]) =>
    lista.length === 0 ? 'Elige al menos un departamento'
      : lista.length > 1 && !permisos.gestionaEquipo ? 'Solo los Gerentes o el Administrador pueden crear proyectos conjuntos.'
      : lista.length === 1 && !permitidos.includes(lista[0])
        ? permisos.gestionaEquipo
          ? `Solo puedes crear proyectos propios de ${permitidos.join(', ') || 'tu departamento'}. Para trabajar con ${lista[0]}, agrega también tu departamento y será un proyecto conjunto.`
          : `Solo puedes crear proyectos de ${permitidos.join(', ') || 'tu departamento'}.`
        : undefined
  const alternarDepto = (d: DepartamentoProyecto) => {
    const lista = deptos.includes(d) ? deptos.filter((x) => x !== d) : DEPARTAMENTOS_PROYECTO.filter((x) => x === d || deptos.includes(x))
    setValue('deptos', lista)
    if (errorDeptos) setErrorDeptos(validarDeptos(lista))
  }

  const onSubmit = (v: FormValues) => {
    if (!editing) {
      const err = validarDeptos(v.deptos)
      setErrorDeptos(err)
      if (err) return
    }
    const base = {
      nombre_proyecto: v.nombre_proyecto.trim(),
      objetivo: v.objetivo.trim(),
      problema_oportunidad: v.problema_oportunidad.trim(),
      alcance: v.alcance.trim(),
      fuera_de_alcance: v.fuera_de_alcance.trim(),
      lider_id: Number(v.lider_id),
      fecha_inicio: emptyToNull(v.fecha_inicio),
      fecha_tentativa: emptyToNull(v.fecha_tentativa),
      fecha_comprometida: emptyToNull(v.fecha_comprometida),
      // null = cálculo automático (el backend lo calcula con el calendario laboral).
      horas_presupuestadas: v.presupuesto_manual ? emptyToNull(v.horas_presupuestadas) : null,
      // Las de departamentos que ya no aplican se descartan.
      etiquetas: v.etiquetas.filter((id) => opcionesEtiquetas.some((e) => e.id_etiqueta === id)),
      // Un subproyecto toma el de su conjunto: no se envía.
      ...(!esSubproyecto && { id_equipo_trabajo: v.id_equipo_trabajo ? Number(v.id_equipo_trabajo) : null }),
    }
    const ids = v.empresas.map((e) => e.id_empresa)
    const dup = ids.findIndex((id, i) => ids.indexOf(id) !== i)
    if (dup >= 0) return setError(`empresas.${dup}.id_empresa`, { message: 'Empresa repetida' })
    const empresas_impactadas = v.empresas.map((e) => ({
      id_empresa: Number(e.id_empresa),
      id_area: Number(e.id_area),
      nivel_impacto: e.nivel_impacto,
      notas_impacto: emptyToNull(e.notas_impacto),
    }))

    const done = (p: ProyectoDetalle) => {
      toast.success(editing ? 'Proyecto actualizado' : conjunto ? 'Proyecto conjunto creado' : 'Proyecto creado')
      onSaved?.(p)
      onClose()
    }

    if (editing) {
      // Las fechas y el presupuesto de un conjunto se consolidan de sus subproyectos.
      const { fecha_inicio, fecha_tentativa, fecha_comprometida, horas_presupuestadas, ...resto } = base
      const cambios = proyecto!.es_conjunto ? resto : { ...resto, fecha_inicio, fecha_tentativa, fecha_comprometida, horas_presupuestadas }
      const depto = !proyecto!.es_conjunto && !esSubproyecto && v.departamento ? { departamento: v.departamento } : {}
      return update.mutate({ ...cambios, ...depto, empresas_impactadas }, { onSuccess: done })
    }
    if (conjunto) {
      const { horas_presupuestadas: _, ...resto } = base
      return create.mutate({
        ...resto, empresas_impactadas, es_conjunto: true,
        subproyectos: v.deptos.map((d) => ({ departamento: d, lider_id: Number(v.lideres[d]) })),
      }, { onSuccess: done })
    }
    create.mutate({ ...base, empresas_impactadas, departamento: v.deptos[0] }, { onSuccess: done })
  }

  const descripcion = editing
    ? proyecto!.es_conjunto ? 'Las fechas, el presupuesto, el avance y el semáforo se consolidan de los subproyectos.' : 'La etapa, el estatus y el avance se cambian con “Actualizar ciclo”.'
    : undefined

  return (
    <Modal
      open onClose={onClose} size="lg"
      title={editing ? (proyecto!.es_conjunto ? 'Editar proyecto conjunto' : 'Editar proyecto') : conjunto ? 'Nuevo proyecto conjunto' : 'Nuevo proyecto'}
      description={descripcion}
      footer={
        <>
          <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
          <Button variant="primary" type="submit" form={formId} loading={mutation.isPending}>
            {editing ? 'Guardar cambios' : conjunto ? `Crear proyecto conjunto (${deptos.length})` : 'Crear proyecto'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="divide-y divide-border [&>section]:py-5 [&>section:first-child]:pt-0">
        <Seccion titulo="Datos generales">
          <TextField label="Nombre del proyecto" required maxLength={200} data-autofocus
            placeholder="p. ej. Migración del ERP a la nube" error={errors.nombre_proyecto?.message}
            {...register('nombre_proyecto', { validate: notBlank })} />

          {editing ? (
            !proyecto!.es_conjunto && (esSubproyecto ? (
              <TextField label="Departamento" value={proyecto!.departamento ?? ''} disabled
                hint={`Subproyecto de “${proyecto!.padre?.nombre_proyecto ?? 'un proyecto conjunto'}”; su departamento no se cambia.`} />
            ) : (
              <SelectField key={permitidos.length} label="Departamento" required error={errors.departamento?.message}
                hint={departamento !== proyecto!.departamento ? 'Conserva sus etapas; se quitan las etiquetas del departamento anterior.' : undefined}
                {...register('departamento', { required })}>
                <option value="">Selecciona…</option>
                {permitidos.map((d) => <option key={d}>{d}</option>)}
              </SelectField>
            ))
          ) : (
            <SelectorDepartamentos value={deptos} onToggle={alternarDepto} error={errorDeptos}
              resumen={deptos.length === 1
                ? plantilla.data && `Proyecto de ${deptos[0]}: iniciará en “${plantilla.data[0]?.nombre}” con sus ${plantilla.data.length} etapas.`
                : deptos.length > 1 && `Proyecto conjunto: se creará un subproyecto por departamento, cada uno con sus propias etapas y equipo.`} />
          )}

          {conjunto && !editing ? (
            <div className="space-y-3 rounded-lg border border-border bg-surface-2/40 p-4">
              <SelectField label="Coordinador del conjunto" required error={errors.lider_id?.message}
                hint="Da seguimiento al proyecto completo y puede editarlo." {...register('lider_id', { required })}>
                <option value="">Selecciona…</option>
                <OpcionesLider usuarios={lideres} />
              </SelectField>
              <div className="grid gap-3 sm:grid-cols-2">
                {deptos.map((d) => (
                  <SelectField key={`${d}-${personas.isSuccess}`} label={`Líder en ${d}`} required error={errors.lideres?.[d]?.message}
                    {...register(`lideres.${d}`, { validate: (v) => !getValues('deptos').includes(d) || !!v || required })}>
                    <option value="">Selecciona…</option>
                    <OpcionesLider usuarios={lideres} primero={d} />
                  </SelectField>
                ))}
              </div>
            </div>
          ) : (
            <SelectField key={`lider-${personas.isSuccess}`} label={conjunto ? 'Coordinador del conjunto' : 'Líder'} required
              error={errors.lider_id?.message}
              hint={conjunto ? 'Cada subproyecto tiene su propio líder.' : personas.data && lideres.length === 0 ? 'No hay personas activas en el Equipo.' : undefined}
              {...register('lider_id', { required })}>
              <option value="">Selecciona un líder…</option>
              <OpcionesLider usuarios={lideres} primero={editing ? proyecto!.departamento ?? undefined : deptos[0]} />
            </SelectField>
          )}

          {esSubproyecto ? (
            proyecto!.id_equipo_trabajo != null && (
              <p className="text-sm text-muted">
                Equipo de trabajo: <span className="font-medium text-fg">{equiposTrabajo.data?.find((e) => e.id_equipo_trabajo === proyecto!.id_equipo_trabajo)?.nombre ?? '—'}</span> (el de su conjunto).
              </p>
            )
          ) : (
            <SelectField key={`et-${equiposTrabajo.data?.length}`} label={<>Equipo de trabajo <Opcional /></>}
              hint={conjunto ? 'Sus subproyectos lo heredan.' : 'Línea de negocio a la que atiende (p. ej. Servicios Corporativos).'}
              {...register('id_equipo_trabajo')}>
              <option value="">Sin equipo de trabajo</option>
              {equiposTrabajo.data?.map((e) => <option key={e.id_equipo_trabajo} value={e.id_equipo_trabajo}>{e.nombre}</option>)}
            </SelectField>
          )}

          <div>
            <p className="mb-1.5 text-[13px] font-medium text-fg">Etiquetas <Opcional /></p>
            <EtiquetasSelector label="Etiquetas del proyecto" opciones={opcionesEtiquetas} value={etiquetas}
              onChange={(ids) => setValue('etiquetas', ids, { shouldDirty: true })}
              vacio={!departamentosEtiquetas.length ? 'Elige un departamento para ver sus etiquetas.'
                : !puedeCrearEn.length ? 'Sus departamentos aún no tienen etiquetas.' : undefined} />
            {puedeCrearEn.length > 0 && (
              <NuevaEtiqueta departamentos={puedeCrearEn} sugerido={opcionesEtiquetas.length}
                onCreada={(id) => setValue('etiquetas', [...getValues('etiquetas'), id], { shouldDirty: true })} />
            )}
          </div>
        </Seccion>

        <Seccion titulo="Definición" descripcion="El objetivo es lo único obligatorio; el resto puede completarse durante el análisis.">
          <TextArea label="Objetivo" required rows={2} placeholder="Qué se quiere lograr" error={errors.objetivo?.message}
            {...register('objetivo', { validate: notBlank })} />
          <TextArea label={<>Problema u oportunidad <Opcional /></>} rows={2} placeholder="Por qué se hace"
            {...register('problema_oportunidad')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextArea label={<>Alcance <Opcional /></>} placeholder="Qué incluye" {...register('alcance')} />
            <TextArea label={<>Fuera de alcance <Opcional /></>} placeholder="Qué no incluye" {...register('fuera_de_alcance')} />
          </div>
        </Seccion>

        <Seccion titulo="Planificación" opcional
          descripcion={editing && conjunto ? undefined
            : conjunto ? 'Se copian a cada subproyecto, que luego las ajusta por su cuenta.'
            : 'Las tareas deben caer entre el inicio y el fin (la comprometida o, si no hay, la tentativa).'}>
          {editing && conjunto ? (
            <p className="rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted">
              Las fechas y las horas presupuestadas se calculan a partir de los subproyectos.
            </p>
          ) : <>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField type="date" label="Inicio" {...register('fecha_inicio')} />
              <TextField type="date" label="Fin tentativo" hint="Estimación inicial" error={errors.fecha_tentativa?.message}
                {...register('fecha_tentativa', { validate: antesDelInicio })} />
              <TextField type="date" label="Fin comprometido" hint="Pactado; define el semáforo" error={errors.fecha_comprometida?.message}
                {...register('fecha_comprometida', { validate: antesDelInicio })} />
            </div>
            {!conjunto && (
              <div className="rounded-lg border border-border bg-surface-2/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] font-medium text-fg">Horas presupuestadas</p>
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <input type="checkbox" className="size-4 accent-[var(--brand)]" {...register('presupuesto_manual')} />
                    Fijar a mano
                  </label>
                </div>
                {manual ? (
                  <TextField fieldClassName="mt-2" type="number" min={0} step="0.5" label="Horas" error={errors.horas_presupuestadas?.message}
                    hint={`${calculo.data ? `El cálculo automático daría ${formatHours(calculo.data.horas)}. ` : ''}${enTareas > 0 ? `Las tareas ya suman ${formatHours(enTareas)}. ` : ''}Vacío = sin límite.`}
                    {...register('horas_presupuestadas', {
                      min: { value: 0, message: 'No puede ser negativo' },
                      validate: (v) => !v || Number(v) >= enTareas || 'Es menor que las horas ya asignadas en tareas',
                    })} />
                ) : (
                  <p className="mt-1 text-sm tabular-nums">
                    {!inicio || !fin ? <span className="text-muted">Se calculan con el calendario laboral al definir inicio y fin; mientras, sin límite.</span>
                      : calculo.isPending ? <span className="text-muted">Calculando…</span>
                      : calculo.data ? <><strong>{formatHours(calculo.data.horas)}</strong> <span className="text-muted">· {calculo.data.dias_laborables} días laborables</span></>
                      : <span className="text-danger">No se pudo calcular.</span>}
                  </p>
                )}
                {!manual && calculo.data && num(calculo.data.horas) < enTareas && (
                  <p className="mt-1 text-xs text-danger">Las tareas ya suman {formatHours(enTareas)}: amplía las fechas o fija el presupuesto a mano.</p>
                )}
              </div>
            )}
          </>}
        </Seccion>

        <Seccion titulo="Empresas impactadas" opcional
          accion={<Button size="sm" icon={<Plus className="size-4" />} disabled={!empresas.data?.length}
            onClick={() => append({ id_empresa: '', id_area: '', nivel_impacto: 'Medio', notas_impacto: '' })}>Agregar empresa</Button>}>
          {fields.length === 0 && <p className="text-sm text-muted">Agrega las empresas y áreas que se verán afectadas por el proyecto.</p>}
          {fields.map((f, i) => (
            <EmpresaImpactadaRow key={f.id} form={form} index={i} empresas={empresas.data ?? []} onRemove={() => remove(i)} />
          ))}
        </Seccion>

        <FormError error={mutation.error} />
      </form>
    </Modal>
  )
}

const Opcional = () => <span className="ml-1 text-xs font-normal text-muted">(opcional)</span>

function Seccion({ titulo, descripcion, opcional, accion, children }: {
  titulo: string; descripcion?: string; opcional?: boolean; accion?: ReactNode; children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-fg">{titulo}{opcional && <Opcional />}</h3>
          {descripcion && <p className="mt-0.5 text-xs text-muted">{descripcion}</p>}
        </div>
        {accion}
      </div>
      {children}
    </section>
  )
}

/** Departamentos participantes como tarjetas conmutables: el tipo de proyecto se deduce de cuántos se eligen. */
function SelectorDepartamentos({ value, onToggle, error, resumen }: {
  value: DepartamentoProyecto[]; onToggle: (d: DepartamentoProyecto) => void; error?: string; resumen?: ReactNode
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-medium text-fg">
        Departamentos <span className="text-danger" aria-hidden>*</span>
        <span className="ml-1 font-normal text-muted">· elige más de uno para un proyecto conjunto</span>
      </legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {DEPARTAMENTOS_PROYECTO.map((d) => {
          const activo = value.includes(d)
          return (
            <button key={d} type="button" aria-pressed={activo} onClick={() => onToggle(d)}
              className={cn('flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors',
                activo ? 'border-brand bg-brand-soft text-brand' : 'border-border text-fg hover:border-border-strong')}>
              <span className={cn('flex size-4 shrink-0 items-center justify-center rounded border',
                activo ? 'border-brand bg-brand text-brand-fg' : 'border-border-strong')} aria-hidden>
                {activo && <Check className="size-3" />}
              </span>
              {d}
            </button>
          )
        })}
      </div>
      {error ? <p role="alert" className="mt-1.5 text-xs text-danger">{error}</p>
        : resumen && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted">
            {value.length > 1 && <Layers className="mt-px size-3.5 shrink-0 text-info" aria-hidden />}{resumen}
          </p>
        )}
    </fieldset>
  )
}

/** Personas que pueden liderar; con `primero`, las de ese departamento van al inicio. */
function OpcionesLider({ usuarios, primero }: { usuarios: Usuario[]; primero?: DepartamentoProyecto }) {
  const opcion = (u: Usuario) => <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}{u.rol === 'Gerente' ? ' · Gerente' : ''}</option>
  if (!primero) return <>{usuarios.map(opcion)}</>
  const del = usuarios.filter((u) => u.departamento === primero)
  const otros = usuarios.filter((u) => u.departamento !== primero)
  return <>
    {del.length > 0 && <optgroup label={primero}>{del.map(opcion)}</optgroup>}
    {otros.length > 0 && <optgroup label="Otros departamentos">{otros.map(opcion)}</optgroup>}
  </>
}

/** Una empresa impactada: el área se elige entre las de la empresa seleccionada. */
function EmpresaImpactadaRow({ form, index: i, empresas, onRemove }: {
  form: UseFormReturn<FormValues>; index: number; empresas: Empresa[]; onRemove: () => void
}) {
  const { register, watch, setValue, formState: { errors } } = form
  const idEmpresa = watch(`empresas.${i}.id_empresa`)
  const areas = useAreas(idEmpresa ? Number(idEmpresa) : undefined)
  const opciones = idEmpresa ? areas.data ?? [] : []
  const empresaReg = register(`empresas.${i}.id_empresa`, { required })

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-surface-2/40 p-3 sm:grid-cols-[1fr_1fr_8rem_auto]">
      {/* Los select se remontan al llegar sus opciones para que muestren el valor precargado al editar. */}
      <SelectField key={empresas.length} label="Empresa" required error={errors.empresas?.[i]?.id_empresa?.message}
        {...empresaReg}
        onChange={(e) => { setValue(`empresas.${i}.id_area`, ''); return empresaReg.onChange(e) }}>
        <option value="">Selecciona…</option>
        {empresas.map((e) => <option key={e.id_empresa} value={e.id_empresa}>{e.nombre_empresa}</option>)}
      </SelectField>
      <SelectField key={`${idEmpresa}-${areas.isSuccess}`} label="Área" required disabled={!idEmpresa || areas.isPending}
        error={errors.empresas?.[i]?.id_area?.message}
        hint={idEmpresa && areas.data?.length === 0 ? 'Esta empresa no tiene áreas. Créalas en Organización.' : undefined}
        {...register(`empresas.${i}.id_area`, { required })}>
        <option value="">{idEmpresa ? 'Selecciona…' : 'Elige la empresa primero'}</option>
        {opciones.map((a) => <option key={a.id_area} value={a.id_area}>{a.nombre_area}</option>)}
      </SelectField>
      <SelectField label="Impacto" {...register(`empresas.${i}.nivel_impacto`)}>
        {NIVELES_IMPACTO.map((n) => <option key={n}>{n}</option>)}
      </SelectField>
      <div className="flex items-end">
        <Button variant="ghost" aria-label="Quitar empresa" onClick={onRemove}><Trash2 className="size-4" /></Button>
      </div>
      <TextField fieldClassName="sm:col-span-4" label="Notas de impacto" {...register(`empresas.${i}.notas_impacto`)} />
    </div>
  )
}
