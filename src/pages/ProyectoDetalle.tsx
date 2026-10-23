import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertOctagon, ArrowLeft, CalendarDays, Check, GanttChart, KanbanSquare, Layers, Pencil, Plus, RefreshCw, Table2, Trash2, Users, X } from 'lucide-react'
import {
  useAgregarSubproyecto, useAreas, useAsignaciones, useBloqueos, useDeleteProyecto, useEtapas, useProyecto,
  useEquiposTrabajo, useQuitarSubproyecto, useTareasProyecto, useUsuarios,
} from '@/api/hooks'
import { usePermisos } from '@/auth/AuthProvider'
import { RecursoAvatar } from '@/features/equipo/RecursoAvatar'
import { useEmpresaMap, useUsuarioMap } from '@/api/lookups'
import { EstadoBadge, EtapaBadge, ImpactoBadge, SemaforoBadge } from '@/components/ui/Badge'
import { SelectField } from '@/components/ui/Field'
import { FormError } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { COLORES_ETIQUETA, ConjuntoBadge, DepartamentoBadge, EtiquetasList } from '@/features/proyectos/Etiquetas'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, Skeleton, Spinner } from '@/components/ui/Feedback'
import { Avatar, Card, CardHeader, DescriptionList, PageHeader, ProgressBar, Table, Td, Th } from '@/components/ui/Layout'
import { Tabs } from '@/components/ui/Tabs'
import { AsignacionFormModal } from '@/features/asignaciones/AsignacionFormModal'
import { BloqueoFormModal } from '@/features/bloqueos/BloqueoFormModal'
import { BloqueosTable } from '@/features/bloqueos/BloqueosTable'
import { PanelBloqueos } from '@/features/bloqueos/PanelBloqueos'
import { CambiarEstadoModal } from '@/features/proyectos/CambiarEstadoModal'
import { ProyectoFormModal } from '@/features/proyectos/ProyectoFormModal'
import { EtapaFormModal } from '@/features/etapas/EtapaFormModal'
import { CalendarioTareas } from '@/features/tareas/CalendarioTareas'
import { CronogramaTareas } from '@/features/tareas/CronogramaTareas'
import { KanbanBoard } from '@/features/tareas/KanbanBoard'
import { TablaTareas, type GrupoTabla } from '@/features/tareas/TablaTareas'
import { TareaDetalleModal } from '@/features/tareas/TareaDetalleModal'
import { TareaFormModal } from '@/features/tareas/TareaFormModal'
import { cn } from '@/lib/cn'
import { formatDate, formatHours, num } from '@/lib/format'
import {
  DEPARTAMENTOS_PROYECTO, ESTADOS_FINALES, parteTarea, type DepartamentoProyecto, type Etapa, type EstadoProyecto,
  type ProyectoDetalle as Detalle, type Tarea,
} from '@/types/api'

type TabId = 'resumen' | 'tareas' | 'etapas' | 'asignaciones' | 'bloqueos'

const VISTAS = [
  { id: 'tabla', label: 'Tabla', icon: Table2 },
  { id: 'kanban', label: 'Kanban', icon: KanbanSquare },
  { id: 'cronograma', label: 'Cronograma', icon: GanttChart },
  { id: 'calendario', label: 'Calendario', icon: CalendarDays },
] as const
type Vista = (typeof VISTAS)[number]['id']

export default function ProyectoDetalle() {
  const id = Number(useParams().id)
  const proyecto = useProyecto(id)
  const etapas = useEtapas(id)
  const asignaciones = useAsignaciones(id)
  const bloqueos = useBloqueos({ id_proyecto: id, limit: 200 })
  const tareas = useTareasProyecto(id)
  const { gestionaProyecto } = usePermisos()

  // ?tarea=ID (p. ej. desde una notificación de mención) abre la pestaña Tareas con ese detalle.
  const [params] = useSearchParams()
  const tareaParam = Number(params.get('tarea')) || null
  // ?tab= abre una pestaña (p. ej. desde el panel de bloqueos del portafolio).
  const tabParam = params.get('tab') as TabId | null
  const [tab, setTab] = useState<TabId>(tareaParam ? 'tareas' : tabParam ?? 'resumen')
  const [ultimoParam, setUltimoParam] = useState(tareaParam)
  if (tareaParam !== ultimoParam) { setUltimoParam(tareaParam); if (tareaParam) setTab('tareas') }

  if (!Number.isInteger(id)) return <ErrorState error={new Error('Identificador de proyecto no válido.')} />
  if (proyecto.isPending) return <Spinner label="Cargando proyecto…" />
  if (proyecto.isError) {
    return (
      <>
        <BackLink />
        <Card><ErrorState error={proyecto.error} onRetry={() => proyecto.refetch()} /></Card>
      </>
    )
  }

  const p = proyecto.data
  const abiertos = bloqueos.data?.filter((b) => !b.fecha_fin_bloqueo).length ?? 0

  // Un conjunto no tiene etapas ni asignaciones propias: se trabaja en sus subproyectos. Su pestaña de tareas es
  // la vista general (las de todos los subproyectos más las suyas propias).
  if (p.es_conjunto) {
    return (
      <>
        <Header p={p} />
        <Tabs
          label="Secciones del proyecto" value={tab === 'tareas' || tab === 'bloqueos' ? tab : 'resumen'} onChange={setTab}
          tabs={[
            { id: 'resumen', label: 'Resumen' }, { id: 'tareas', label: 'Tareas', count: tareas.data?.length },
            { id: 'bloqueos', label: 'Bloqueos y desfases', count: abiertos || undefined },
          ]}
        />
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-6">
          {tab === 'tareas' ? <TareasTab p={p} idTareaInicial={tareaParam} />
            : tab === 'bloqueos' ? <BloqueosTab p={p} /> : <Resumen p={p} />}
        </div>
      </>
    )
  }

  return (
    <>
      <Header p={p} />
      {abiertos > 0 && (
        <button
          onClick={() => setTab('bloqueos')}
          className="mb-5 flex w-full items-center gap-2 rounded-lg border border-warn/30 bg-warn-soft px-4 py-2.5 text-left text-sm text-warn"
        >
          <AlertOctagon className="size-4 shrink-0" aria-hidden />
          Este proyecto tiene {abiertos} {abiertos === 1 ? 'bloqueo abierto' : 'bloqueos abiertos'}. <span className="font-medium underline">Ver bloqueos</span>
        </button>
      )}

      <Tabs
        label="Secciones del proyecto" value={tab} onChange={setTab}
        tabs={[
          { id: 'resumen', label: 'Resumen' },
          { id: 'tareas', label: 'Tareas', count: tareas.data?.length },
          { id: 'etapas', label: 'Etapas', count: etapas.data?.length },
          { id: 'asignaciones', label: 'Asignaciones', count: asignaciones.data?.length },
          { id: 'bloqueos', label: 'Bloqueos y desfases', count: abiertos || undefined },
        ]}
      />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-6">
        {tab === 'resumen' && <Resumen p={p} />}
        {tab === 'tareas' && <TareasTab p={p} idTareaInicial={tareaParam} />}
        {tab === 'etapas' && <EtapasTab idProyecto={id} cerrado={isFinal(p.estado_proyecto) || !gestionaProyecto(p)} />}
        {tab === 'asignaciones' && <AsignacionesTab p={p} />}
        {tab === 'bloqueos' && <BloqueosTab p={p} />}
      </div>
    </>
  )
}

const isFinal = (e: EstadoProyecto) => ESTADOS_FINALES.includes(e)

function BackLink({ padre }: { padre?: Detalle['padre'] }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted">
      <Link to="/proyectos" className="inline-flex items-center gap-1.5 hover:text-fg">
        <ArrowLeft className="size-4" /> Proyectos
      </Link>
      {padre && <>
        <span aria-hidden>/</span>
        <Link to={`/proyectos/${padre.id_proyecto}`} className="hover:text-fg hover:underline">{padre.nombre_proyecto}</Link>
      </>}
    </div>
  )
}

const avanceTone: Partial<Record<EstadoProyecto, 'ok' | 'warn' | 'danger'>> = {
  Completado: 'ok', Pausado: 'warn', Bloqueado: 'danger', Cancelado: 'danger',
}

function Header({ p }: { p: Detalle }) {
  const [editing, setEditing] = useState(false)
  const [ciclo, setCiclo] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const { esAdmin, gestionaProyecto } = usePermisos()
  const gestiona = gestionaProyecto(p)
  const equipoTrabajo = useEquiposTrabajo().data?.find((e) => e.id_equipo_trabajo === p.id_equipo_trabajo)
  const avance = num(p.porcentaje_avance)
  const tareas = useTareasProyecto(p.id_proyecto)
  const etapas = useEtapas(p.id_proyecto)
  const lista = etapas.data ?? []
  const actual = lista.find((e) => e.nombre_etapa === p.etapa_actual)?.orden_secuencia ?? 1
  const peso = lista.length ? 100 / lista.length : 0
  const pct = (n: number) => Math.round(n * 10) / 10
  const conteo = (orden: number) => {
    const deEtapa = tareas.data?.filter((t) => t.orden_etapa === orden) ?? []
    return { total: deEtapa.length, hechas: deEtapa.filter((t) => t.estado === 'Finalizado').length }
  }

  return (
    <>
      <PageHeader
        back={<BackLink padre={p.padre} />}
        title={p.nombre_proyecto}
        description={undefined}
        actions={<>
          {gestiona && !p.es_conjunto && !isFinal(p.estado_proyecto) && (
            <Button icon={<RefreshCw className="size-4" />} onClick={() => setCiclo(true)}>Actualizar ciclo</Button>
          )}
          {gestiona && <Button icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>Editar</Button>}
          {esAdmin && (
            <Button variant="ghost" className="text-danger hover:text-danger" icon={<Trash2 className="size-4" />}
              onClick={() => setEliminando(true)}>Eliminar</Button>
          )}
        </>}
      />
      <div className="-mt-3 mb-4 flex flex-wrap items-center gap-3">
        {p.es_conjunto ? <ConjuntoBadge /> : <DepartamentoBadge value={p.departamento} />}
        {equipoTrabajo && (
          <Link to={`/equipos-trabajo/${equipoTrabajo.id_equipo_trabajo}`} title="Equipo de trabajo"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium hover:border-brand hover:text-brand">
            <span className="size-2 rounded-full" style={{ background: equipoTrabajo.color }} aria-hidden />{equipoTrabajo.nombre}
          </Link>
        )}
        <EtiquetasList etiquetas={p.etiquetas} />
        <EstadoBadge value={p.estado_proyecto} />
        <SemaforoBadge value={p.semaforo} />
        {p.semaforo_motivo && <span className="text-sm text-muted">{p.semaforo_motivo}</span>}
      </div>

      {p.es_conjunto ? <Subproyectos p={p} /> : (
        <Card className="mb-6 p-5">
          <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">Avance del proyecto {lista.length > 0 && <span className="font-normal text-muted">· cada etapa vale {pct(peso)} %, según sus tareas finalizadas</span>}</span>
            <span className="font-semibold tabular-nums">{Math.round(avance)} %</span>
          </div>
          <ProgressBar label="Avance del proyecto" value={avance} tone={avanceTone[p.estado_proyecto] ?? 'brand'} />
          <ol className="mt-4 grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
            {lista.map((e, i) => {
              const esActual = e.orden_secuencia === actual
              const hecha = e.orden_secuencia < actual || (esActual && p.estado_proyecto === 'Completado')
              const { total, hechas } = conteo(e.orden_secuencia)
              return (
                <li key={e.id_etapa} aria-current={esActual ? 'step' : undefined}
                  className={cn('rounded-lg border px-3 py-2', esActual ? 'border-brand bg-brand-soft' : 'border-border')}>
                  <p className="flex items-center gap-1 text-xs text-muted tabular-nums">
                    {hecha && <Check className="size-3.5 text-ok" aria-label="Completada" />}{i + 1} · {pct(peso * i)}–{pct(peso * (i + 1))} %
                  </p>
                  <p className={cn('text-sm', esActual ? 'font-semibold' : 'font-medium', !esActual && !hecha && 'text-muted')}>{e.nombre_etapa}</p>
                  {total > 0 && <p className="mt-1 text-xs text-muted tabular-nums">{hechas}/{total} tareas</p>}
                  {esActual && e.descripcion && <p className="mt-1 text-xs text-muted">{e.descripcion}</p>}
                </li>
              )
            })}
          </ol>
        </Card>
      )}
      {editing && <ProyectoFormModal proyecto={p} onClose={() => setEditing(false)} />}
      {ciclo && <CambiarEstadoModal proyecto={p} onClose={() => setCiclo(false)} />}
      {eliminando && <EliminarProyectoDialog p={p} onClose={() => setEliminando(false)} />}
    </>
  )
}

/** Panel del conjunto: avance consolidado y un renglón por departamento participante. */
function Subproyectos({ p }: { p: Detalle }) {
  const { gestionaProyecto, gestionaDepartamentoProyecto } = usePermisos()
  const { map: usuarios } = useUsuarioMap()
  const toast = useToast()
  const quitar = useQuitarSubproyecto(p.id_proyecto)
  const [agregando, setAgregando] = useState(false)
  const [quitando, setQuitando] = useState<Detalle['subproyectos'][number] | null>(null)
  const avance = num(p.porcentaje_avance)
  const faltan = DEPARTAMENTOS_PROYECTO.filter((d) => !p.subproyectos.some((s) => s.departamento === d))
  // Suma departamentos el líder del conjunto, el Administrador o el Gerente del departamento que se suma.
  const puedeAgregar = !isFinal(p.estado_proyecto) && faltan.some((d) => gestionaProyecto(p) || gestionaDepartamentoProyecto(d))
  const puedeQuitar = gestionaProyecto(p) && p.subproyectos.length > 1

  return (
    <Card className="mb-6">
      <CardHeader title="Avance consolidado"
        subtitle="Promedio de los subproyectos ponderado por sus horas presupuestadas; el semáforo es el peor de ellos."
        action={puedeAgregar && <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setAgregando(true)}>Agregar departamento</Button>} />
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <div className="flex-1"><ProgressBar label="Avance consolidado" value={avance} tone={avanceTone[p.estado_proyecto] ?? 'brand'} /></div>
          <span className="font-semibold tabular-nums">{Math.round(avance)} %</span>
        </div>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {p.subproyectos.map((s) => (
            <li key={s.id_proyecto} className="relative rounded-lg border border-border p-4 hover:border-border-strong">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/proyectos/${s.id_proyecto}`} className="font-medium after:absolute after:inset-0 hover:text-brand hover:underline">
                  {s.departamento}
                </Link>
                {puedeQuitar && (
                  <button type="button" aria-label={`Quitar ${s.departamento} del proyecto`} onClick={() => setQuitando(s)}
                    className="relative z-10 rounded p-0.5 text-muted hover:bg-surface-2 hover:text-danger"><X className="size-4" /></button>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted">{usuarios.get(s.lider_id)?.nombre ?? '—'} · {s.etapa_actual}</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1"><ProgressBar label={`Avance de ${s.departamento}`} value={num(s.porcentaje_avance)} /></div>
                <span className="w-9 text-right text-xs text-muted tabular-nums">{Math.round(num(s.porcentaje_avance))}%</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <EstadoBadge value={s.estado_proyecto} />
                <span title={s.semaforo_motivo ?? undefined}><SemaforoBadge value={s.semaforo} /></span>
              </div>
              <EtiquetasList etiquetas={s.etiquetas} className="mt-2" />
            </li>
          ))}
        </ul>
      </div>
      {agregando && (
        <AgregarDepartamentoModal p={p} opciones={faltan.filter((d) => gestionaProyecto(p) || gestionaDepartamentoProyecto(d))}
          onClose={() => setAgregando(false)} />
      )}
      {quitando && (
        <ConfirmDialog open title={`Quitar ${quitando.departamento}`} confirmLabel="Quitar departamento" danger
          loading={quitar.isPending} error={quitar.error} onClose={() => { quitar.reset(); setQuitando(null) }}
          onConfirm={() => quitar.mutate(quitando.id_proyecto, {
            onSuccess: () => { toast.success(`${quitando.departamento} ya no participa en el proyecto`); setQuitando(null) },
          })}>
          <p>Se eliminará su subproyecto. Solo es posible si aún no tiene tareas.</p>
        </ConfirmDialog>
      )}
    </Card>
  )
}

function AgregarDepartamentoModal({ p, opciones, onClose }: {
  p: Detalle; opciones: DepartamentoProyecto[]; onClose: () => void
}) {
  const toast = useToast()
  const agregar = useAgregarSubproyecto(p.id_proyecto)
  const personas = useUsuarios({ activo: true })
  const [departamento, setDepartamento] = useState<DepartamentoProyecto | ''>(opciones[0] ?? '')
  const [lider, setLider] = useState('')
  const lideres = (personas.data ?? []).filter((u) => u.tipo_recurso !== 'Activo')
    .sort((a, b) => Number(b.departamento === departamento) - Number(a.departamento === departamento))

  return (
    <Modal open onClose={onClose} title="Agregar departamento"
      description="Su subproyecto toma la descripción y las fechas del conjunto, y las etapas de su departamento."
      footer={<>
        <Button onClick={onClose} disabled={agregar.isPending}>Cancelar</Button>
        <Button variant="primary" loading={agregar.isPending} disabled={!departamento || !lider}
          onClick={() => departamento && agregar.mutate({ departamento, lider_id: Number(lider) }, {
            onSuccess: () => { toast.success(`${departamento} se sumó al proyecto`); onClose() },
          })}>Agregar</Button>
      </>}>
      <div className="space-y-4">
        <SelectField label="Departamento" required value={departamento} onChange={(e) => setDepartamento(e.target.value as DepartamentoProyecto)}>
          {opciones.map((d) => <option key={d}>{d}</option>)}
        </SelectField>
        <SelectField label="Líder del subproyecto" required value={lider} onChange={(e) => setLider(e.target.value)}>
          <option value="">Selecciona…</option>
          {lideres.map((u) => <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}{u.departamento ? ` · ${u.departamento}` : ''}</option>)}
        </SelectField>
        <FormError error={agregar.error} />
      </div>
    </Modal>
  )
}

/** Tablero de tareas. En un conjunto es la vista general: las tareas de todos sus subproyectos (solo lectura:
 * se editan en su subproyecto) más las propias del conjunto (generales), filtrables por parte. */
function TareasTab({ p, idTareaInicial }: { p: Detalle; idTareaInicial: number | null }) {
  const q = useTareasProyecto(p.id_proyecto)
  const etapas = useEtapas(p.id_proyecto)
  const permisos = usePermisos()
  const gestiona = permisos.gestionaProyecto(p)
  const cerrado = isFinal(p.estado_proyecto)
  const esConjunto = p.es_conjunto
  const propia = (t: Tarea) => t.id_proyecto === p.id_proyecto
  const listaEtapas = etapas.data ?? []
  const actual = { orden: listaEtapas.find((e) => e.nombre_etapa === p.etapa_actual)?.orden_secuencia ?? 1 }
  // La tabla (vista por defecto) agrupa por etapa: arranca con todas; las demás vistas, con la etapa actual.
  const [orden, setOrden] = useState<number | 'todas'>(() =>
    esConjunto || !new URLSearchParams(window.location.search).get('vista') ? 'todas' : actual.orden)
  const [parte, setParte] = useState<string>('todas')
  const partes = ['todas', 'General', ...p.subproyectos.flatMap((s) => s.departamento ? [s.departamento] : [])]
  const subproyectoDe = new Map(p.subproyectos.map((s) => [s.id_proyecto, s]))
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<Tarea | null>(null)
  const [params, setParams] = useSearchParams()
  // ?vista= conserva la vista al recargar o compartir el enlace.
  const vista: Vista = VISTAS.find((v) => v.id === params.get('vista'))?.id ?? 'tabla'
  const cambiarVista = (v: Vista) => setParams((prev) => {
    const n = new URLSearchParams(prev)
    if (v === 'tabla') n.delete('vista')
    else n.set('vista', v)
    return n
  }, { replace: true })
  const [idDetalle, setIdDetalle] = useState<number | null>(idTareaInicial)
  const [ultimoInicial, setUltimoInicial] = useState(idTareaInicial)
  if (idTareaInicial !== ultimoInicial) { setUltimoInicial(idTareaInicial); if (idTareaInicial) setIdDetalle(idTareaInicial) }
  const detalle = q.data?.find((t) => t.id_tarea === idDetalle) ?? null
  const cerrarDetalle = () => {
    setIdDetalle(null)
    setParams((prev) => { const n = new URLSearchParams(prev); n.delete('tarea'); return n }, { replace: true })
  }

  const lista = q.data?.filter((t) => esConjunto ? parte === 'todas' || parteTarea(t) === parte : orden === 'todas' || t.orden_etapa === orden) ?? []
  // Estimado vs. real de las tareas finalizadas que ya tienen horas reales.
  const conReales = lista.filter((t) => t.estado === 'Finalizado' && t.horas_reales != null)
  const finalizadas = lista.filter((t) => t.estado === 'Finalizado').length
  const estimadas = conReales.reduce((s, t) => s + num(t.horas_asignadas), 0)
  const reales = conReales.reduce((s, t) => s + num(t.horas_reales), 0)
  const idEtapa = etapas.data?.find((e) => e.orden_secuencia === (orden === 'todas' ? actual.orden : orden))?.id_etapa
  // Grupos de la tabla: las etapas (las filtradas) o, en un conjunto, las generales y cada departamento.
  const grupos: GrupoTabla[] = esConjunto
    ? [
        { clave: 'general', titulo: 'Generales del proyecto', color: 'var(--brand)', idEtapa: null, agregar: true, incluye: propia },
        ...p.subproyectos.map((s, i) => ({
          clave: `s-${s.id_proyecto}`, titulo: s.departamento ?? s.nombre_proyecto, color: COLORES_ETIQUETA[(i + 1) % COLORES_ETIQUETA.length],
          idEtapa: null, agregar: false, incluye: (t: Tarea) => t.id_proyecto === s.id_proyecto,
        })),
      ].filter((g) => parte === 'todas' || g.titulo === parte || (parte === 'General' && g.clave === 'general'))
    : listaEtapas
        .filter((e) => orden === 'todas' || e.orden_secuencia === orden)
        .map((e) => ({
          clave: `e-${e.id_etapa}`, titulo: `${e.orden_secuencia}. ${e.nombre_etapa}`,
          color: COLORES_ETIQUETA[(e.orden_secuencia - 1) % COLORES_ETIQUETA.length],
          idEtapa: e.id_etapa, agregar: true, incluye: (t: Tarea) => t.id_etapa === e.id_etapa,
        }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Vista de tareas" className="inline-flex rounded-lg border border-border bg-surface p-0.5">
          {VISTAS.map(({ id: v, label, icon: Icon }) => (
            <button key={v} type="button" aria-pressed={vista === v} onClick={() => cambiarVista(v)}
              className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                vista === v ? 'bg-brand-soft text-brand' : 'text-muted hover:text-fg')}>
              <Icon className="size-3.5" aria-hidden />{label}
            </button>
          ))}
        </div>
        {esConjunto ? (
          <div role="group" aria-label="Filtrar por departamento" className="flex flex-wrap gap-1">
            {partes.map((o) => {
              const n = o === 'todas' ? q.data?.length : q.data?.filter((t) => parteTarea(t) === o).length
              return (
                <button key={o} type="button" aria-pressed={parte === o} onClick={() => setParte(o)}
                  title={o === 'General' ? 'Tareas propias del proyecto conjunto, sin departamento' : undefined}
                  className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    parte === o ? 'border-brand bg-brand-soft text-brand' : 'border-border text-muted hover:text-fg')}>
                  {o === 'todas' ? 'Todas' : o}{n ? ` · ${n}` : ''}
                </button>
              )
            })}
          </div>
        ) : (
          <div role="group" aria-label="Filtrar por etapa" className="flex flex-wrap gap-1">
            {(['todas', ...listaEtapas.map((e) => e.orden_secuencia)] as const).map((o, i) => {
              const n = o === 'todas' ? q.data?.length : q.data?.filter((t) => t.orden_etapa === o).length
              const nombre = o === 'todas' ? undefined : listaEtapas.find((e) => e.orden_secuencia === o)?.nombre_etapa
              return (
                <button key={o} type="button" aria-pressed={orden === o} onClick={() => setOrden(o)}
                  title={nombre}
                  className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    orden === o ? 'border-brand bg-brand-soft text-brand' : 'border-border text-muted hover:text-fg')}>
                  {o === 'todas' ? 'Todas' : `${i}. ${nombre?.split(' ')[0] ?? ''}`}{n ? ` · ${n}` : ''}
                </button>
              )
            })}
          </div>
        )}
        {gestiona && !cerrado && (
          <Button variant="primary" size="sm" className="ml-auto" icon={<Plus className="size-4" />} onClick={() => setCreando(true)}>
            {esConjunto ? 'Nueva tarea general' : 'Nueva tarea'}
          </Button>
        )}
      </div>
      {cerrado && <p className="text-sm text-muted">El proyecto está “{p.estado_proyecto}”: sus tareas ya no admiten cambios.</p>}
      {esConjunto && (
        <p className="text-sm text-muted">
          Vista general: las tareas de cada departamento se crean y editan en su subproyecto; aquí solo se muestran.
          Las generales son del conjunto y no cuentan en el avance.
        </p>
      )}
      {finalizadas > 0 && (
        <p className="text-sm text-muted">
          {conReales.length === 0 ? `${finalizadas} tarea(s) finalizada(s) sin horas reales registradas.` : <>
            Estimado vs. real ({conReales.length} de {finalizadas} finalizadas con registro):{' '}
            <span className="tabular-nums text-fg">{formatHours(estimadas)} → {formatHours(reales)}</span>
            {estimadas > 0 && <span className={cn('tabular-nums', reales > estimadas ? 'text-danger' : 'text-ok')}> ({reales >= estimadas ? '+' : ''}{Math.round((reales / estimadas - 1) * 100)} %)</span>}
          </>}
        </p>
      )}

      {q.isPending ? <div className="grid gap-4 md:grid-cols-4"><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
        : q.isError ? <Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>
        : vista === 'tabla' ? (
          <TablaTareas proyecto={{ p, gestiona, cerrado }} tareas={lista} grupos={grupos} etiqueta={`Tareas de ${p.nombre_proyecto}`}
            clave={`proyecto-${p.id_proyecto}`} editaTodo={(t) => gestiona && !cerrado && propia(t)}
            mueve={(t) => !cerrado && propia(t) && (gestiona || permisos.esYo(t.id_usuario))}
            onAbrir={(t) => setIdDetalle(t.id_tarea)} />
        ) : q.data.length === 0 ? (
          <Card>
            <EmptyState icon={<KanbanSquare className="size-6" />} title="Sin tareas"
              description={esConjunto
                ? 'Aquí aparecen las tareas de todos los subproyectos y las generales del conjunto.'
                : 'Las tareas finalizadas de cada etapa definen el avance del proyecto. Al terminar todas las de la etapa actual, el proyecto pasa a la siguiente.'}
              action={gestiona && !cerrado && (
                <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreando(true)}>{esConjunto ? 'Nueva tarea general' : 'Nueva tarea'}</Button>
              )} />
          </Card>
        ) : vista === 'cronograma' ? (
          <CronogramaTareas tareas={lista} etapas={etapas.data ?? []} proyecto={p} onAbrir={(t) => setIdDetalle(t.id_tarea)}
            agruparPor={esConjunto ? 'parte' : 'etapa'} />
        ) : vista === 'calendario' ? (
          <CalendarioTareas tareas={lista} proyecto={p} onAbrir={(t) => setIdDetalle(t.id_tarea)} />
        ) : (
          <KanbanBoard tareas={lista} mostrarParte={esConjunto}
            puedeMover={(t) => !cerrado && propia(t) && (gestiona || permisos.esYo(t.id_usuario))}
            onEditar={gestiona && !cerrado ? setEditando : undefined} puedeEditar={propia} onAbrir={(t) => setIdDetalle(t.id_tarea)} />
        )}

      {creando && <TareaFormModal proyecto={p} idEtapaInicial={idEtapa} onClose={() => setCreando(false)} />}
      {editando && <TareaFormModal proyecto={p} tarea={editando} onClose={() => setEditando(null)} />}
      {detalle && !editando && (
        <TareaDetalleModal tarea={detalle} onClose={cerrarDetalle}
          onEditar={gestiona && !cerrado && propia(detalle) ? () => setEditando(detalle) : undefined}
          irA={propia(detalle) ? undefined : {
            to: `/proyectos/${detalle.id_proyecto}?tarea=${detalle.id_tarea}`,
            label: `Abrir en ${subproyectoDe.get(detalle.id_proyecto!)?.departamento ?? 'su subproyecto'}`,
          }} />
      )}
    </div>
  )
}

function EliminarProyectoDialog({ p, onClose }: { p: Detalle; onClose: () => void }) {
  const navigate = useNavigate()
  const toast = useToast()
  const del = useDeleteProyecto()
  return (
    <ConfirmDialog
      open title="Eliminar proyecto" confirmLabel="Eliminar proyecto" danger loading={del.isPending} error={del.error}
      onClose={onClose}
      onConfirm={() => del.mutate(p.id_proyecto, {
        onSuccess: () => { toast.success(`Proyecto “${p.nombre_proyecto}” eliminado`); navigate('/proyectos', { replace: true }) },
      })}
    >
      <p>Se eliminará de forma permanente <strong className="text-fg">“{p.nombre_proyecto}”</strong> junto con sus etapas, asignaciones, bloqueos y demás registros. Esta acción no se puede deshacer.</p>
      <p>Si solo quieres detenerlo, usa <em>Actualizar ciclo</em> y márcalo como “Cancelado”: así conservas su historial.</p>
    </ConfirmDialog>
  )
}

function Resumen({ p }: { p: Detalle }) {
  const { map: usuarios } = useUsuarioMap()
  const { map: empresas } = useEmpresaMap()
  const areas = new Map(useAreas().data?.map((a) => [a.id_area, a]))
  const lider = usuarios.get(p.lider_id)

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader title="Descripción" />
          <div className="space-y-5 p-5">
            {[
              ['Problema u oportunidad', p.problema_oportunidad],
              ['Objetivo', p.objetivo],
              ['Alcance', p.alcance],
              ['Fuera de alcance', p.fuera_de_alcance],
            ].map(([label, text]) => (
              <div key={label}>
                <h3 className="text-xs font-medium tracking-wide text-muted uppercase">{label}</h3>
                {text ? <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">{text}</p>
                  : <p className="mt-1 text-sm text-muted italic">Sin definir</p>}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Empresas impactadas" subtitle={`${p.empresas_impactadas.length} en total`} />
          {p.empresas_impactadas.length === 0 ? (
            <p className="p-5 text-sm text-muted">No se registraron empresas impactadas.</p>
          ) : (
            <ul className="divide-y divide-border">
              {p.empresas_impactadas.map((e) => (
                <li key={e.id_empresa} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {empresas.get(e.id_empresa)?.nombre_empresa ?? `Empresa #${e.id_empresa}`}
                      {e.id_area !== null && <span className="font-normal text-muted"> · {areas.get(e.id_area)?.nombre_area ?? `Área #${e.id_area}`}</span>}
                    </p>
                    {e.notas_impacto && <p className="mt-0.5 text-sm text-muted">{e.notas_impacto}</p>}
                  </div>
                  <ImpactoBadge value={e.nivel_impacto} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader title="Datos clave" />
        <div className="space-y-5 p-5">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted uppercase">Líder</p>
            <div className="mt-2 flex items-center gap-3">
              <Avatar name={lider?.nombre ?? '?'} />
              <div><p className="text-sm font-medium">{lider?.nombre ?? `Usuario #${p.lider_id}`}</p><p className="text-xs text-muted">{lider?.correo}</p></div>
            </div>
          </div>
          <DescriptionList items={[
            { label: 'Fecha de inicio', value: formatDate(p.fecha_inicio) },
            { label: 'Fecha tentativa', value: formatDate(p.fecha_tentativa) },
            { label: 'Fecha comprometida', value: formatDate(p.fecha_comprometida) },
            { label: 'Cierre real', value: formatDate(p.fecha_real_cierre) },
            p.es_conjunto ? {
              label: 'Horas presupuestadas',
              value: p.horas_presupuestadas == null ? 'Sin presupuesto' : `${formatHours(p.horas_presupuestadas)} (suma de los subproyectos)`,
            } : {
              label: 'Horas en tareas',
              value: p.horas_presupuestadas == null
                ? `${formatHours(p.horas_en_tareas)} (sin presupuesto)`
                : `${formatHours(p.horas_en_tareas)} de ${formatHours(p.horas_presupuestadas)} (${p.horas_presupuestadas_manual ? 'ajustadas a mano' : 'calculadas'})`,
            },
          ]} />
        </div>
      </Card>
    </div>
  )
}

function EtapasTab({ idProyecto, cerrado }: { idProyecto: number; cerrado: boolean }) {
  const q = useEtapas(idProyecto)
  const [editando, setEditando] = useState<Etapa | null>(null)

  return (
    <Card>
      <CardHeader title="Etapas del proyecto" subtitle="Horas efectivas frente a las estimadas. El estatus sigue al ciclo del proyecto." />
      {q.isPending ? <div className="space-y-3 p-5"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
        : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
        : q.data.length === 0 ? (
          <EmptyState icon={<Layers className="size-6" />} title="Sin etapas" description="Las etapas se crean junto con el proyecto, según su departamento." />
        ) : (
          <ol className="divide-y divide-border">
            {q.data.map((e) => {
              const est = num(e.horas_estimadas)
              const real = num(e.horas_efectivas_reales)
              const pct = est > 0 ? (real / est) * 100 : 0
              return (
                <li key={e.id_etapa} className="grid gap-3 px-5 py-4 sm:grid-cols-[2.5rem_1fr_16rem_2.25rem] sm:items-center">
                  <span className="flex size-8 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-muted" aria-label={`Etapa ${e.orden_secuencia}`}>{e.orden_secuencia}</span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-medium">{e.nombre_etapa}</h3><EtapaBadge value={e.estado_etapa} /></div>
                    <p className="mt-0.5 text-xs text-muted">{formatDate(e.fecha_inicio_est)} → {formatDate(e.fecha_fin_est)}</p>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-muted tabular-nums">
                      <span>{formatHours(real)} / {formatHours(est)}</span><span>{est > 0 ? `${Math.round(pct)}%` : '—'}</span>
                    </div>
                    <ProgressBar label={`Avance de ${e.nombre_etapa}`} value={pct} tone={pct > 100 ? 'danger' : e.estado_etapa === 'Completado' ? 'ok' : 'brand'} />
                  </div>
                  {!cerrado && (
                    <Button size="sm" variant="ghost" icon={<Pencil className="size-4" />} aria-label={`Planificar ${e.nombre_etapa}`}
                      onClick={() => setEditando(e)} />
                  )}
                </li>
              )
            })}
          </ol>
        )}
      {editando && <EtapaFormModal etapa={editando} onClose={() => setEditando(null)} />}
    </Card>
  )
}

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

function AsignacionesTab({ p }: { p: Detalle }) {
  const q = useAsignaciones(p.id_proyecto)
  const etapas = useEtapas(p.id_proyecto)
  const { map: usuarios } = useUsuarioMap()
  const [adding, setAdding] = useState(false)
  const cerrado = isFinal(p.estado_proyecto)
  const etapaMap = new Map(etapas.data?.map((e) => [e.id_etapa, e]))
  const permisos = usePermisos()
  const puedeAsignar = permisos.gestionaProyecto(p)
  const totalHoras = q.data?.reduce((s, a) => s + num(a.horas_en_tareas), 0) ?? 0
  const costo = (horas: string, idUsuario: number) => {
    const tarifa = usuarios.get(idUsuario)?.costo_hora
    return tarifa ? num(horas) * num(tarifa) : null
  }
  const totalCosto = q.data?.reduce((s, a) => s + (costo(a.horas_en_tareas, a.id_usuario) ?? 0), 0) ?? 0
  const sinEtapas = !etapas.isPending && (etapas.data?.length ?? 0) === 0

  return (
    <Card>
      <CardHeader title="Recursos asignados" subtitle={q.data?.length
          ? `${formatHours(totalHoras)} en tareas${permisos.veCostos && totalCosto > 0 ? ` · costo estimado ${moneda.format(totalCosto)}` : ''}`
          : undefined}
        action={puedeAsignar && <Button variant="primary" size="sm" icon={<Plus className="size-4" />} disabled={cerrado || sinEtapas} onClick={() => setAdding(true)}>Asignar recurso</Button>} />
      {(cerrado || sinEtapas) && (
        <p className="border-b border-border bg-surface-2/50 px-5 py-2.5 text-sm text-muted">
          {cerrado ? `No se pueden asignar recursos a un proyecto “${p.estado_proyecto}”.` : 'El proyecto no tiene etapas.'}
        </p>
      )}
      {q.isPending ? <div className="space-y-3 p-5"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
        : q.data.length === 0 ? <EmptyState icon={<Users className="size-6" />} title="Sin asignaciones" description="Aún no hay personas asignadas a las etapas de este proyecto." />
        : (
          <Table>
            <thead><tr><Th>Recurso</Th><Th>Rol</Th><Th>Etapa</Th><Th className="text-right">Horas en tareas</Th>{permisos.veCostos && <Th className="text-right">Costo</Th>}</tr></thead>
            <tbody>
              {q.data.map((a) => {
                const u = usuarios.get(a.id_usuario)
                return (
                  <tr key={a.id_asignacion}>
                    <Td><div className="flex items-center gap-3">{u ? <RecursoAvatar usuario={u} /> : <Avatar name="?" />}<Link to={`/equipo/${a.id_usuario}`} className="font-medium whitespace-nowrap hover:text-brand hover:underline">{u?.nombre ?? `Usuario #${a.id_usuario}`}</Link></div></Td>
                    <Td className="text-muted">{a.perfil_requerido}</Td>
                    <Td className="whitespace-nowrap text-muted">{etapaMap.get(a.id_etapa)?.nombre_etapa ?? `#${a.id_etapa}`}</Td>
                    <Td className="text-right whitespace-nowrap tabular-nums">{formatHours(a.horas_en_tareas)}</Td>
                    {permisos.veCostos && <Td className="text-right whitespace-nowrap tabular-nums">{(() => { const c = costo(a.horas_en_tareas, a.id_usuario); return c === null ? <span className="text-muted">—</span> : moneda.format(c) })()}</Td>}
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      {adding && etapas.data && <AsignacionFormModal proyecto={p} etapas={etapas.data} onClose={() => setAdding(false)} />}
    </Card>
  )
}

/** Seguimiento del proyecto (un conjunto incluye sus subproyectos): indicadores, causas, desfases y el registro. */
function BloqueosTab({ p }: { p: Detalle }) {
  const q = useBloqueos({ id_proyecto: p.id_proyecto, limit: 200 })
  const [adding, setAdding] = useState(false)
  const cerrado = isFinal(p.estado_proyecto)

  return (
    <div className="space-y-6">
      <PanelBloqueos idProyecto={p.id_proyecto} porProyecto={p.es_conjunto} />
      <Card>
        <CardHeader title="Registro de bloqueos"
          subtitle={p.es_conjunto ? 'De todos los subproyectos y de las tareas generales. Abiertos primero.' : 'Abiertos primero; su tiempo sigue contando hasta resolverlos.'}
          action={!cerrado && <Button variant="primary" size="sm" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Reportar bloqueo</Button>} />
        {q.isPending ? <div className="space-y-3 p-5"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
          : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
          : q.data.length === 0 ? <EmptyState icon={<AlertOctagon className="size-6" />} title="Sin bloqueos" description="Ninguna tarea de este proyecto se ha detenido." />
          : <BloqueosTable bloqueos={q.data} mostrarProyecto={p.es_conjunto} />}
      </Card>
      {adding && <BloqueoFormModal idProyecto={p.es_conjunto ? undefined : p.id_proyecto} onClose={() => setAdding(false)} />}
    </div>
  )
}
