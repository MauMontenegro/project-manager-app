import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Controller, useForm, type UseFormRegisterReturn } from 'react-hook-form'
import {
  Building, Check, CircleCheck, Circle, CodeXml, Crown, Mail, Plus, Server, Sparkles, UserRound, Workflow,
} from 'lucide-react'
import { useCreatePuesto, useCreateUsuario, usePuestos, useSkills, useUpdateUsuario, useUsuarios } from '@/api/hooks'
import { usePermisos } from '@/auth/AuthProvider'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, SelectField, TextField } from '@/components/ui/Field'
import { FormError } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { SkillChip, SkillsInput } from '@/components/ui/SkillsInput'
import { useToast } from '@/components/ui/Toast'
import { RecursoAvatar } from '@/features/equipo/RecursoAvatar'
import { cn } from '@/lib/cn'
import { emptyToNull } from '@/lib/format'
import {
  DEPARTAMENTOS, type Departamento, type Rol, type SkillAsignada, type TipoRecurso, type Usuario, type UsuarioCreate,
} from '@/types/api'

interface FormValues {
  tipo_recurso: TipoRecurso
  nombre: string
  correo: string
  id_puesto: string
  departamento: Departamento | ''
  id_jefe: string
  rol: Rol
  skills: SkillAsignada[]
  capacidad_horas_semanales: string
  porcentaje_proyectos: string
  costo_hora: string
  proveedor: string
  fecha_fin_contrato: string
  activo: boolean
}

const TIPOS: Array<{ id: TipoRecurso; label: string; desc: string; icon: typeof UserRound }> = [
  { id: 'Interno', label: 'Persona interna', desc: 'Colaborador de la DTI', icon: UserRound },
  { id: 'Externo', label: 'Externo', desc: 'Proveedor o consultor', icon: Building },
  { id: 'Activo', label: 'Activo', desc: 'Servidor, licencia, ambiente', icon: Server },
]

const DEPTO_ICON: Record<Departamento, typeof Crown> = {
  Dirección: Crown, Infraestructura: Server, Procesos: Workflow, 'Desarrollo de Software': CodeXml,
}

const ROLES_INFO: Array<{ id: Rol; desc: string }> = [
  { id: 'Usuario', desc: 'Consulta el portafolio y trabaja sus propias tareas (de proyecto y recurrentes) y ausencias.' },
  { id: 'Líder', desc: 'Además, crea proyectos en su departamento y gestiona los que lidera (tareas, asignaciones y ciclo).' },
  { id: 'Gerente', desc: 'Gestiona a las personas, proyectos y configuración de su departamento.' },
  { id: 'Administrador', desc: 'Acceso total: todos los departamentos, roles, catálogos y configuración.' },
]

const CAPACIDADES = ['40', '30', '20']

const rango = (min: number, max: number) => (v: string) =>
  v === '' || (Number(v) >= min && Number(v) <= max) || `Debe estar entre ${min} y ${max}`

export function UsuarioFormModal({ usuario, onClose }: { usuario?: Usuario; onClose: () => void }) {
  const editing = !!usuario
  const formId = useId()
  const toast = useToast()
  const permisos = usePermisos()
  // Administrador: cualquier rol. Gerente: Usuario o Líder, si la persona no tiene ya un rol reservado.
  const reservado = (r: Rol) => r === 'Administrador' || r === 'Gerente'
  const puedeCambiarRol = permisos.esAdmin || (permisos.gestionaEquipo && !(usuario && reservado(usuario.rol)))
  const rolAsignable = (r: Rol) => permisos.esAdmin || (puedeCambiarRol && !reservado(r))
  const create = useCreateUsuario()
  const update = useUpdateUsuario()
  const mutation = editing ? update : create
  const puestos = usePuestos()
  const catalogo = useSkills()
  const personas = useUsuarios({ activo: true })
  const departamentos = DEPARTAMENTOS.filter((d) => permisos.gestionaDepartamento(d))
  const [descartar, setDescartar] = useState(false)
  const otroRef = useRef(false)
  const jefeTocado = useRef(editing)

  const defaults = (base?: Partial<FormValues>): FormValues => ({
    tipo_recurso: usuario?.tipo_recurso ?? 'Interno',
    nombre: usuario?.nombre ?? '', correo: usuario?.correo ?? '',
    id_puesto: usuario?.id_puesto ? String(usuario.id_puesto) : '',
    departamento: usuario?.departamento ?? (departamentos.length === 1 ? departamentos[0] : ''),
    id_jefe: usuario?.id_jefe ? String(usuario.id_jefe) : '',
    rol: usuario?.rol ?? 'Usuario',
    skills: usuario?.skills ?? [],
    capacidad_horas_semanales: usuario ? String(Number(usuario.capacidad_horas_semanales)) : '40',
    porcentaje_proyectos: usuario ? String(Number(usuario.porcentaje_proyectos)) : '100',
    costo_hora: usuario?.costo_hora ? String(Number(usuario.costo_hora)) : '',
    proveedor: usuario?.proveedor ?? '', fecha_fin_contrato: usuario?.fecha_fin_contrato ?? '',
    activo: usuario?.activo ?? true,
    ...base,
  })

  const { register, control, handleSubmit, watch, setValue, reset, setFocus, formState: { errors, isDirty } } =
    useForm<FormValues>({ defaultValues: defaults() })
  const v = watch()
  const esActivo = v.tipo_recurso === 'Activo'
  const capacidad = Number(v.capacidad_horas_semanales) || 0
  const dedicacion = Math.min(100, Math.max(0, Number(v.porcentaje_proyectos) || 0))
  const planificable = (capacidad * dedicacion) / 100

  const jefes = (personas.data ?? []).filter((p) => p.tipo_recurso !== 'Activo' && p.id_usuario !== usuario?.id_usuario)
  const jefeSugerido = useMemo(() => {
    if (!v.departamento || esActivo) return undefined
    const director = jefes.find((p) => p.rol === 'Administrador')
    if (v.departamento === 'Dirección' || v.rol === 'Gerente' || v.rol === 'Administrador') return director
    return jefes.find((p) => p.rol === 'Gerente' && p.departamento === v.departamento) ?? director
  }, [v.departamento, v.rol, esActivo, personas.data]) // eslint-disable-line react-hooks/exhaustive-deps

  // «Reporta a» se propone solo mientras la persona no lo haya elegido a mano.
  useEffect(() => {
    if (!jefeTocado.current) setValue('id_jefe', jefeSugerido ? String(jefeSugerido.id_usuario) : '')
  }, [jefeSugerido, setValue])

  // Skills frecuentes en el departamento elegido (o en todo el equipo) que aún no tiene.
  const sugeridos = useMemo(() => {
    const conteo = new Map<string, number>()
    for (const p of personas.data ?? []) {
      if (v.departamento && p.departamento !== v.departamento) continue
      for (const s of p.skills) conteo.set(s.nombre, (conteo.get(s.nombre) ?? 0) + 1)
    }
    if (conteo.size === 0) for (const s of catalogo.data ?? []) conteo.set(s.nombre, s.personas)
    const tiene = new Set(v.skills.map((s) => s.nombre.toLowerCase()))
    return [...conteo].filter(([n]) => !tiene.has(n.toLowerCase())).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n]) => n)
  }, [personas.data, catalogo.data, v.departamento, v.skills])

  const pendientes = [
    { ok: v.nombre.trim() !== '', label: esActivo ? 'Nombre del activo' : 'Nombre' },
    ...(!esActivo ? [{ ok: /^\S+@\S+\.\S+$/.test(v.correo.trim()), label: 'Correo' }, { ok: v.id_puesto !== '', label: 'Puesto' }] : []),
    { ok: v.departamento !== '', label: 'Departamento' },
    ...(v.tipo_recurso === 'Externo' ? [{ ok: v.proveedor.trim() !== '', label: 'Proveedor' }] : []),
    { ok: v.capacidad_horas_semanales !== '', label: 'Capacidad' },
  ]

  const cerrar = () => (isDirty && !mutation.isPending ? setDescartar(true) : onClose())

  const onSubmit = (f: FormValues) => {
    const fEsActivo = f.tipo_recurso === 'Activo'
    const body: UsuarioCreate = {
      tipo_recurso: f.tipo_recurso,
      nombre: f.nombre.trim(),
      correo: fEsActivo ? null : f.correo.trim(),
      id_puesto: fEsActivo || !f.id_puesto ? null : Number(f.id_puesto),
      departamento: f.departamento as Departamento,
      id_jefe: fEsActivo || !f.id_jefe ? null : Number(f.id_jefe),
      skills: f.skills,
      capacidad_horas_semanales: f.capacidad_horas_semanales,
      porcentaje_proyectos: f.porcentaje_proyectos,
      proveedor: f.tipo_recurso === 'Externo' ? emptyToNull(f.proveedor) : null,
      fecha_fin_contrato: f.tipo_recurso === 'Externo' ? emptyToNull(f.fecha_fin_contrato) : null,
      activo: f.activo,
      // Solo quien puede verlos envía rol y costo: omitirlos evita borrarlos sin querer.
      ...(puedeCambiarRol && { rol: fEsActivo ? 'Usuario' : f.rol }),
      ...(permisos.veCostos && { costo_hora: f.costo_hora === '' ? null : f.costo_hora }),
    }
    if (editing) {
      update.mutate({ id: usuario.id_usuario, body }, { onSuccess: () => { toast.success('Cambios guardados'); onClose() } })
      return
    }
    create.mutate(body, {
      onSuccess: () => {
        toast.success(`${body.nombre} se agregó al Equipo`)
        if (!otroRef.current) return onClose()
        // Carga en lote: conserva tipo, departamento, jefe y capacidad; limpia lo personal.
        reset(defaults({
          tipo_recurso: f.tipo_recurso, departamento: f.departamento, id_jefe: f.id_jefe, id_puesto: f.id_puesto,
          capacidad_horas_semanales: f.capacidad_horas_semanales, porcentaje_proyectos: f.porcentaje_proyectos,
        }))
        create.reset()
        setTimeout(() => setFocus('nombre'))
      },
    })
  }
  const guardar = (otro: boolean) => { otroRef.current = otro; void handleSubmit(onSubmit)() }

  const footer = descartar ? (
    <>
      <p className="text-sm text-fg sm:mr-auto sm:self-center">¿Descartar los datos capturados?</p>
      <Button onClick={() => setDescartar(false)}>Seguir editando</Button>
      <Button variant="danger" onClick={onClose}>Descartar</Button>
    </>
  ) : (
    <>
      <p className="hidden text-xs text-muted sm:mr-auto sm:block sm:self-center"><span className="text-danger">*</span> Obligatorio</p>
      <div className={cn('grid gap-2 sm:flex', !editing && 'grid-cols-2')}>
        <Button onClick={cerrar} disabled={mutation.isPending}>Cancelar</Button>
        {!editing && (
          <Button onClick={() => guardar(true)} disabled={mutation.isPending && !otroRef.current} loading={mutation.isPending && otroRef.current}>
            Guardar y agregar otro
          </Button>
        )}
      </div>
      <Button variant="primary" type="submit" form={formId} loading={mutation.isPending && !otroRef.current} disabled={mutation.isPending && otroRef.current}>
        {editing ? 'Guardar cambios' : 'Agregar recurso'}
      </Button>
    </>
  )

  return (
    <Modal open onClose={cerrar} size="xl" title={editing ? `Editar ${usuario.nombre}` : 'Nuevo recurso'}
      description={editing ? undefined : 'Personas, externos o activos que pueden participar en los proyectos de la DTI.'}
      footer={footer}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <form id={formId} onSubmit={(e) => { e.preventDefault(); guardar(false) }} noValidate className="min-w-0 space-y-8">
          <div role="radiogroup" aria-label="Tipo de recurso" className="grid grid-cols-3 gap-2">
            {TIPOS.map(({ id, label, desc, icon: Icon }) => (
              <OpcionCard key={id} checked={v.tipo_recurso === id} reg={register('tipo_recurso')} value={id}>
                <Icon className="size-5" aria-hidden />
                <span className="mt-2 block text-sm font-medium">{label}</span>
                <span className="mt-0.5 hidden text-xs text-muted sm:block">{desc}</span>
              </OpcionCard>
            ))}
          </div>

          <Seccion n={1} title="Identificación">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label={esActivo ? 'Nombre del activo' : 'Nombre completo'} required maxLength={150} data-autofocus
                placeholder={esActivo ? 'Ej.: Ambiente QA' : 'Ej.: Ana López'} error={errors.nombre?.message}
                {...register('nombre', { validate: (x) => x.trim() !== '' || 'Obligatorio' })} />
              {!esActivo && (
                <Field label="Correo" required error={errors.correo?.message}
                  hint={v.tipo_recurso === 'Interno' ? 'Con este correo inicia sesión.' : undefined}>
                  {({ id, describedBy, invalid }) => (
                    <ConIcono icon={<Mail className="size-4" />}>
                      <input id={id} type="email" aria-invalid={invalid} aria-describedby={describedBy} maxLength={150}
                        placeholder="nombre@empresa.com" className={controlCls('pl-9')}
                        {...register('correo', { validate: (x) => /^\S+@\S+\.\S+$/.test(x.trim()) || 'Correo no válido' })} />
                    </ConIcono>
                  )}
                </Field>
              )}
            </div>
            {v.tipo_recurso === 'Externo' && (
              <div className="animate-fade-in grid gap-4 sm:grid-cols-2">
                <TextField label="Proveedor" required maxLength={150} placeholder="Empresa que provee el recurso"
                  error={errors.proveedor?.message}
                  {...register('proveedor', { validate: (x) => x.trim() !== '' || 'Obligatorio' })} />
                <TextField type="date" label="Fin de contrato" hint="Se avisa en su ficha 30 días antes." {...register('fecha_fin_contrato')} />
              </div>
            )}
          </Seccion>

          <Seccion n={2} title="Ubicación en la DTI">
            <Field label="Departamento" required error={errors.departamento?.message}>
              {() => (
                <div role="radiogroup" aria-label="Departamento" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {departamentos.map((d) => {
                    const Icon = DEPTO_ICON[d]
                    return (
                      <OpcionCard key={d} compact checked={v.departamento === d} value={d}
                        reg={register('departamento', { required: 'Elige un departamento' })}>
                        <span className="flex items-center gap-2 text-sm font-medium"><Icon className="size-4 shrink-0" aria-hidden />{d}</span>
                      </OpcionCard>
                    )
                  })}
                </div>
              )}
            </Field>

            {!esActivo && (
              <div className="grid gap-4 sm:grid-cols-2">
                <PuestoField reg={register('id_puesto', { validate: (x) => x !== '' || 'Obligatorio' })}
                  error={errors.id_puesto?.message} puestos={puestos.data ?? []} puedeCrear={permisos.gestionaEquipo}
                  onCreado={(id) => setValue('id_puesto', String(id), { shouldDirty: true, shouldValidate: true })} />
                <SelectField label="Reporta a"
                  hint={jefeSugerido && v.id_jefe === String(jefeSugerido.id_usuario) && !jefeTocado.current
                    ? `Sugerido: ${jefeSugerido.rol.toLowerCase()} ${v.departamento === 'Dirección' || jefeSugerido.rol === 'Administrador' ? 'de la DTI' : `de ${v.departamento}`}.`
                    : undefined}
                  {...register('id_jefe', { onChange: () => { jefeTocado.current = true } })}>
                  <option value="">Nadie (cabeza de área)</option>
                  {DEPARTAMENTOS.map((d) => {
                    const grupo = jefes.filter((p) => p.departamento === d)
                    return grupo.length ? (
                      <optgroup key={d} label={d}>
                        {grupo.map((p) => <option key={p.id_usuario} value={p.id_usuario}>{p.nombre}{p.rol !== 'Usuario' ? ` · ${p.rol}` : ''}</option>)}
                      </optgroup>
                    ) : null
                  })}
                </SelectField>
              </div>
            )}

            {!esActivo && (
              <Field label="Rol de acceso" hint={permisos.esAdmin ? undefined : puedeCambiarRol
                ? 'Puedes asignar Usuario o Líder; Gerente y Administrador los otorga el Administrador.' : 'Solo el Administrador puede cambiar este rol.'}>
                {() => (
                  <div>
                    <div role="radiogroup" aria-label="Rol de acceso" className="inline-flex w-full rounded-lg border border-border-strong bg-surface-2/60 p-1 sm:w-auto">
                      {ROLES_INFO.map((r) => (
                        <label key={r.id} className={cn(
                          'flex-1 cursor-pointer rounded-md px-4 py-1.5 text-center text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand sm:flex-none',
                          v.rol === r.id ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
                          !rolAsignable(r.id) && 'cursor-not-allowed opacity-60',
                        )}>
                          <input type="radio" value={r.id} className="sr-only" disabled={!rolAsignable(r.id)} {...register('rol')} />
                          {r.id}
                        </label>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-muted">{ROLES_INFO.find((r) => r.id === v.rol)?.desc}</p>
                  </div>
                )}
              </Field>
            )}
          </Seccion>

          <Seccion n={3} title="Capacidad y costo">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Capacidad semanal" required error={errors.capacidad_horas_semanales?.message}>
                {({ id, describedBy, invalid }) => (
                  <div className="flex items-center gap-2">
                    <ConIcono sufijo="h/sem" className="w-32">
                      <input id={id} type="number" step="0.5" min={0} max={999} aria-invalid={invalid} aria-describedby={describedBy}
                        className={controlCls('pr-14 tabular-nums')}
                        {...register('capacidad_horas_semanales', { required: 'Obligatorio', validate: rango(0, 999) })} />
                    </ConIcono>
                    <div className="flex gap-1" aria-label="Valores frecuentes">
                      {CAPACIDADES.map((c) => (
                        <button key={c} type="button" onClick={() => setValue('capacidad_horas_semanales', c, { shouldDirty: true, shouldValidate: true })}
                          className={cn('h-8 rounded-md border px-2.5 text-xs font-medium tabular-nums transition-colors',
                            v.capacidad_horas_semanales === c ? 'border-brand bg-brand-soft text-brand' : 'border-border text-muted hover:bg-surface-2 hover:text-fg')}>
                          {c} h
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Field>
              {permisos.veCostos && (
                <Field label="Costo por hora" error={errors.costo_hora?.message} hint="Solo lo ven el Administrador y los Gerentes.">
                  {({ id, describedBy, invalid }) => (
                    <ConIcono icon={<span className="text-sm">$</span>} sufijo="MXN/h">
                      <input id={id} type="number" step="0.01" min={0} placeholder="0.00" aria-invalid={invalid} aria-describedby={describedBy}
                        className={controlCls('pr-16 pl-7 tabular-nums')} {...register('costo_hora', { validate: rango(0, 99_999_999) })} />
                    </ConIcono>
                  )}
                </Field>
              )}
            </div>

            <Field label="Dedicación a proyectos" error={errors.porcentaje_proyectos?.message}>
              {({ id, describedBy }) => (
                <div className="rounded-xl border border-border bg-surface-2/40 p-4">
                  <div className="flex items-center gap-4">
                    <input id={id} type="range" min={0} max={100} step={5} aria-describedby={describedBy}
                      aria-valuetext={`${dedicacion} % a proyectos`} className="h-2 flex-1 cursor-pointer accent-[var(--brand)]"
                      {...register('porcentaje_proyectos', { validate: rango(0, 100) })} />
                    <span className="w-12 text-right text-sm font-semibold text-fg tabular-nums">{dedicacion} %</span>
                  </div>
                  <div className="mt-3 flex h-2 gap-[2px] overflow-hidden rounded-full" aria-hidden>
                    <div className="rounded-l-full bg-brand transition-[width]" style={{ width: `${dedicacion}%` }} />
                    <div className="flex-1 rounded-r-full bg-border-strong" />
                  </div>
                  <div className="mt-2 flex justify-between text-xs">
                    <span className="text-fg"><strong className="tabular-nums">{fmtHoras(planificable)}</strong> para proyectos</span>
                    <span className="text-muted"><span className="tabular-nums">{fmtHoras(capacidad - planificable)}</span> para operación y soporte</span>
                  </div>
                </div>
              )}
            </Field>
          </Seccion>

          <Seccion n={4} title="Skills" opcional>
            <Controller control={control} name="skills" rules={{ validate: (x) => x.length <= 30 || 'Máximo 30 skills' }}
              render={({ field, fieldState }) => (
                <div className="space-y-3">
                  <SkillsInput label="Habilidades" value={field.value} onChange={field.onChange}
                    suggestions={catalogo.data?.map((s) => s.nombre)} error={fieldState.error?.message}
                    hint="Enter o coma para agregar · clic en los puntos para cambiar el nivel (básico → intermedio → experto)." />
                  {sugeridos.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 flex items-center gap-1 text-xs text-muted">
                        <Sparkles className="size-3.5" aria-hidden /> {v.departamento ? `Frecuentes en ${v.departamento}` : 'Frecuentes'}:
                      </span>
                      {sugeridos.map((s) => (
                        <button key={s} type="button" onClick={() => field.onChange([...field.value, { nombre: s, nivel: 'Intermedio' }])}
                          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border-strong px-2.5 py-0.5 text-xs text-muted transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand">
                          <Plus className="size-3" aria-hidden />{s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )} />
          </Seccion>

          {editing && (
            <label className="flex items-center gap-2 text-sm text-fg">
              <input type="checkbox" className="size-4 accent-[var(--brand)]" {...register('activo')} /> Recurso activo
            </label>
          )}
          <FormError error={mutation.error} />
        </form>

        <Vista v={v} puesto={puestos.data?.find((p) => String(p.id_puesto) === v.id_puesto)?.nombre_puesto}
          jefe={jefes.find((p) => String(p.id_usuario) === v.id_jefe)?.nombre} planificable={planificable}
          costo={permisos.veCostos ? v.costo_hora : ''} pendientes={pendientes} />
      </div>
    </Modal>
  )
}

const fmtHoras = (h: number) => `${Math.round(h * 10) / 10} h`

const controlCls = (extra: string) => cn(
  'h-10 w-full rounded-lg border border-border-strong bg-surface text-sm text-fg placeholder:text-muted/70 transition-shadow',
  'focus:border-brand focus:ring-4 focus:ring-[var(--ring)] focus:outline-none aria-[invalid=true]:border-danger px-3',
  extra,
)

/** Contenedor de un input con ícono/prefijo a la izquierda y sufijo a la derecha. */
function ConIcono({ icon, sufijo, className, children }: { icon?: ReactNode; sufijo?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('relative', className)}>
      {icon && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">{icon}</span>}
      {children}
      {sufijo && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">{sufijo}</span>}
    </div>
  )
}

function Seccion({ n, title, opcional, children }: { n: number; title: string; opcional?: boolean; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-4">
      <legend className="mb-4 flex w-full items-center gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">{n}</span>
        <span className="text-sm font-semibold text-fg">{title}</span>
        {opcional && <span className="text-xs text-muted">Opcional</span>}
        <span className="h-px flex-1 bg-border" aria-hidden />
      </legend>
      {children}
    </fieldset>
  )
}

/** Tarjeta seleccionable (radio nativo oculto: teclado y lectores de pantalla funcionan igual). */
function OpcionCard({ checked, reg, value, compact, children }: {
  checked: boolean; reg: UseFormRegisterReturn; value: string; compact?: boolean; children: ReactNode
}) {
  return (
    <label className={cn(
      'relative cursor-pointer rounded-xl border transition-all has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[var(--ring)]',
      compact ? 'flex items-center px-3 py-2.5' : 'p-3.5',
      checked ? 'border-brand bg-brand-soft/60 text-brand shadow-sm' : 'border-border text-fg hover:border-border-strong hover:bg-surface-2',
    )}>
      <input type="radio" value={value} className="sr-only" {...reg} />
      {checked && !compact && (
        <span className="absolute top-2.5 right-2.5 flex size-4 items-center justify-center rounded-full bg-brand text-brand-fg"><Check className="size-3" /></span>
      )}
      {children}
    </label>
  )
}

/** Select de puesto con alta en línea, para no abandonar el formulario si el puesto no existe. */
function PuestoField({ reg, error, puestos, puedeCrear, onCreado }: {
  reg: UseFormRegisterReturn; error?: string; puestos: Array<{ id_puesto: number; nombre_puesto: string }>
  puedeCrear: boolean; onCreado: (id: number) => void
}) {
  const crear = useCreatePuesto()
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const guardar = () => {
    if (!nombre.trim()) return
    crear.mutate({ nombre_puesto: nombre.trim() }, { onSuccess: (p) => { onCreado(p.id_puesto); setAbierto(false); setNombre('') } })
  }
  if (abierto) {
    return (
      <Field label="Nuevo puesto" required error={crear.error instanceof Error ? crear.error.message : undefined}>
        {({ id }) => (
          <div className="flex gap-2">
            <input id={id} autoFocus value={nombre} maxLength={100} placeholder="Ej.: Arquitecto de Soluciones"
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardar() } if (e.key === 'Escape') { e.stopPropagation(); setAbierto(false) } }}
              className={controlCls('')} />
            <Button variant="primary" onClick={guardar} loading={crear.isPending} disabled={!nombre.trim()}>Crear</Button>
            <Button variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Button>
          </div>
        )}
      </Field>
    )
  }
  return (
    <div className="relative">
      <SelectField label="Puesto" required error={error} {...reg}>
        <option value="">Selecciona un puesto…</option>
        {puestos.map((p) => <option key={p.id_puesto} value={p.id_puesto}>{p.nombre_puesto}</option>)}
      </SelectField>
      {puedeCrear && (
        <button type="button" onClick={() => setAbierto(true)}
          className="absolute top-0 right-0 flex items-center gap-1 text-xs font-medium text-brand hover:underline">
          <Plus className="size-3.5" aria-hidden /> Nuevo puesto
        </button>
      )}
    </div>
  )
}

/** Vista previa en vivo: cómo aparecerá el recurso y qué falta para guardarlo. */
function Vista({ v, puesto, jefe, planificable, costo, pendientes }: {
  v: FormValues; puesto?: string; jefe?: string; planificable: number; costo: string
  pendientes: Array<{ ok: boolean; label: string }>
}) {
  const faltan = pendientes.filter((p) => !p.ok).length
  return (
    <aside aria-label="Vista previa" className="hidden lg:block">
      <div className="sticky top-0 space-y-4">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Vista previa</p>
        <div className="rounded-xl border border-border bg-surface-2/40 p-4">
          <div className="flex items-center gap-3">
            <RecursoAvatar usuario={{ nombre: v.nombre || '?', tipo_recurso: v.tipo_recurso }} className="size-11" />
            <div className="min-w-0">
              <p className={cn('truncate font-semibold', v.nombre ? 'text-fg' : 'text-muted')}>{v.nombre || (v.tipo_recurso === 'Activo' ? 'Nuevo activo' : 'Nueva persona')}</p>
              <p className="truncate text-xs text-muted">{[puesto, v.departamento].filter(Boolean).join(' · ') || 'Sin puesto ni departamento'}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone={v.tipo_recurso === 'Interno' ? 'brand' : v.tipo_recurso === 'Externo' ? 'warn' : 'neutral'}>{v.tipo_recurso}</Badge>
            {v.tipo_recurso !== 'Activo' && <Badge>{v.rol}</Badge>}
          </div>
          <dl className="mt-4 space-y-2 border-t border-border pt-3 text-xs">
            {v.tipo_recurso !== 'Activo' && <Dato label="Reporta a" value={jefe ?? 'Nadie'} />}
            {v.tipo_recurso === 'Externo' && <Dato label="Proveedor" value={v.proveedor || '—'} />}
            <Dato label="Para proyectos" value={`${fmtHoras(planificable)} / sem`} />
            {costo && <Dato label="Costo" value={`$${Number(costo).toLocaleString('es-MX')} / h`} />}
          </dl>
          {v.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1 border-t border-border pt-3">
              {v.skills.slice(0, 6).map((s) => <SkillChip key={s.nombre} skill={s} />)}
              {v.skills.length > 6 && <Badge>+{v.skills.length - 6}</Badge>}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border p-4">
          <p className={cn('text-sm font-medium', faltan ? 'text-fg' : 'text-ok')}>
            {faltan === 0 ? 'Listo para guardar' : faltan === 1 ? 'Falta 1 dato obligatorio' : `Faltan ${faltan} datos obligatorios`}
          </p>
          <ul className="mt-2 space-y-1.5">
            {pendientes.map((p) => (
              <li key={p.label} className={cn('flex items-center gap-2 text-xs', p.ok ? 'text-muted' : 'text-fg')}>
                {p.ok ? <CircleCheck className="size-4 text-ok" aria-hidden /> : <Circle className="size-4 text-border-strong" aria-hidden />}
                <span className={cn(p.ok && 'line-through decoration-muted/50')}>{p.label}</span>
                <span className="sr-only">{p.ok ? '(completo)' : '(pendiente)'}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  )
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate text-right font-medium text-fg">{value}</dd>
    </div>
  )
}
