import { useMemo, useState } from 'react'
import { AvisoEquipoTrabajo, useEquipoTrabajoActivo } from '@/features/equipos-trabajo/EquipoTrabajoActivo'
import { useSearchParams } from 'react-router-dom'
import { KanbanSquare, Plus, Table2, X } from 'lucide-react'
import { useProyectos, useTarea, useTareasPersona, useUsuarios } from '@/api/hooks'
import { useAuth, usePermisos } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { FilterSelect } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Card, PageHeader } from '@/components/ui/Layout'
import { Tabs } from '@/components/ui/Tabs'
import { formatHours, num, todayISO } from '@/lib/format'
import { RecurrenteFormModal } from '@/features/operacion/RecurrenteFormModal'
import { RecurrentesTabla, useGestionaPersona } from '@/features/operacion/RecurrentesTabla'
import { TareaOperacionModal } from '@/features/operacion/TareaOperacionModal'
import { COLORES_ETIQUETA, FiltroEtiquetas } from '@/features/proyectos/Etiquetas'
import { vencida } from '@/features/tareas/fechas'
import { KanbanBoard } from '@/features/tareas/KanbanBoard'
import { TablaTareas, type GrupoTabla } from '@/features/tareas/TablaTareas'
import { TareaDetalleModal } from '@/features/tareas/TareaDetalleModal'
import { aplanarProyectos, ESTADOS_FINALES, ESTADOS_TAREA, FRECUENCIAS, type Etiqueta, type Tarea } from '@/types/api'

type Vista = 'tablero' | 'recurrentes'

/** Periodos del tablero, por fechas de la tarea (inicio–fin). */
const PERIODOS = [
  { id: '', label: 'Cualquier fecha' },
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mes' },
  { id: 'vencidas', label: 'Vencidas' },
] as const

const isoDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Grupos por vencimiento, como "Mi trabajo" de monday: cada tarea cae en uno solo según su fecha límite. */
function gruposPorFecha(): GrupoTabla[] {
  const hoy = todayISO()
  const d = new Date(`${hoy}T12:00:00`)
  const domingo = new Date(d); domingo.setDate(d.getDate() + ((7 - d.getDay()) % 7))
  const domingoSig = new Date(domingo); domingoSig.setDate(domingo.getDate() + 7)
  const finSemana = isoDe(domingo), finSiguiente = isoDe(domingoSig)
  const abierta = (t: Tarea) => t.estado !== 'Finalizado'
  return [
    { clave: 'vencidas', titulo: 'Vencidas', color: '#dc2626', incluye: (t) => abierta(t) && t.fecha_fin < hoy },
    { clave: 'hoy', titulo: 'Vencen hoy', color: '#d97706', incluye: (t) => abierta(t) && t.fecha_fin === hoy },
    { clave: 'semana', titulo: 'Esta semana', color: '#2563eb', incluye: (t) => abierta(t) && t.fecha_fin > hoy && t.fecha_fin <= finSemana },
    { clave: 'siguiente', titulo: 'La próxima semana', color: '#7c3aed', incluye: (t) => abierta(t) && t.fecha_fin > finSemana && t.fecha_fin <= finSiguiente },
    { clave: 'despues', titulo: 'Más adelante', color: '#0891b2', incluye: (t) => abierta(t) && t.fecha_fin > finSiguiente },
    { clave: 'finalizadas', titulo: 'Finalizadas', color: '#16a34a', incluye: (t) => !abierta(t) },
  ]
}

/** Un grupo por proyecto (por nombre) y, al final, las recurrentes. */
function gruposPorProyecto(tareas: Tarea[]): GrupoTabla[] {
  const proyectos = [...new Map(tareas.filter((t) => t.id_proyecto != null).map((t) => [t.id_proyecto!, t.nombre_proyecto!])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
  return [
    ...proyectos.map(([id, nombre], i) => ({
      clave: `p-${id}`, titulo: nombre, color: COLORES_ETIQUETA[i % COLORES_ETIQUETA.length], incluye: (t: Tarea) => t.id_proyecto === id,
    })),
    { clave: 'recurrentes', titulo: 'Tareas recurrentes', color: '#4b5563', incluye: (t: Tarea) => t.id_recurrente != null },
  ]
}

function rangoPeriodo(periodo: string): [string, string] | null {
  const hoy = new Date(`${todayISO()}T12:00:00`)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  if (periodo === 'hoy') return [iso(hoy), iso(hoy)]
  if (periodo === 'semana') {
    const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6)
    return [iso(lunes), iso(domingo)]
  }
  if (periodo === 'mes') return [iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1, 12)), iso(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 12))]
  return null
}

/** Todas las tareas de una persona: de sus proyectos y de sus tareas recurrentes (operación del día a día).
 * Gerentes y el Administrador pueden ver las de otra persona. */
export default function MisTareas() {
  const { sesion } = useAuth()
  const permisos = usePermisos()
  const [params, setParams] = useSearchParams()
  const personas = useUsuarios({ activo: true })
  const [creando, setCreando] = useState(false)

  const persona = params.get('persona') ?? ''
  const idUsuario = persona ? Number(persona) : undefined
  const propio = !idUsuario || idUsuario === sesion?.id_usuario
  const sinPersona = !idUsuario && sesion?.id_usuario == null
  const vista: Vista = params.get('vista') === 'recurrentes' ? 'recurrentes' : 'tablero'

  const set = (cambios: Record<string, string>) => setParams((p) => {
    const n = new URLSearchParams(p)
    for (const [k, v] of Object.entries(cambios)) { if (v) n.set(k, v); else n.delete(k) }
    return n
  }, { replace: true })

  return (
    <>
      <PageHeader title={propio ? 'Mis tareas' : 'Tareas'}
        description="Tareas de proyectos y tareas recurrentes (diarias, semanales y mensuales) en un solo lugar."
        actions={<>
          {permisos.gestionaEquipo && (
            <FilterSelect label="Ver tareas de" value={persona} onChange={(v) => set({ persona: v })}>
              <option value="">{sesion?.id_usuario != null ? 'Mis tareas' : 'Elige una persona…'}</option>
              {personas.data?.filter((u) => u.tipo_recurso !== 'Activo' && u.id_usuario !== sesion?.id_usuario)
                .map((u) => <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>)}
            </FilterSelect>
          )}
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreando(true)}>Nueva tarea recurrente</Button>
        </>} />

      <Tabs label="Vistas de tareas" value={vista} onChange={(v) => set({ vista: v === 'tablero' ? '' : v })}
        tabs={[{ id: 'tablero', label: 'Tablero' }, { id: 'recurrentes', label: 'Tareas recurrentes' }]} />

      <div role="tabpanel" id={`panel-${vista}`} aria-labelledby={`tab-${vista}`} className="pt-4">
        {sinPersona ? (
          <Card><EmptyState icon={<KanbanSquare className="size-6" />} title="Tu sesión no está ligada a una persona del Equipo"
            description="Elige a quién quieres ver en el selector de arriba." /></Card>
        ) : vista === 'tablero' ? (
          <Tablero idUsuario={idUsuario} propio={propio} />
        ) : (
          <RecurrentesTabla filtro={{ id_usuario: idUsuario ?? sesion?.id_usuario ?? undefined }} onCrear={() => setCreando(true)} />
        )}
      </div>

      {creando && <RecurrenteFormModal onClose={() => setCreando(false)} />}
    </>
  )
}

function Tablero({ idUsuario, propio }: { idUsuario?: number; propio: boolean }) {
  const [params, setParams] = useSearchParams()
  const q = useTareasPersona(idUsuario)
  const gestionaPersona = useGestionaPersona()
  const { gestionaEquipo, gestionaProyecto } = usePermisos()
  // Quién gestiona cada proyecto (para editar desde aquí título, fechas y horas de sus tareas).
  const portafolio = useProyectos({ limit: 200 })
  const proyectoDe = useMemo(() => new Map(aplanarProyectos(portafolio.data?.items ?? []).map((p) => [p.id_proyecto, p])), [portafolio.data])

  // Filtros en la URL: se conservan al recargar o compartir el enlace.
  const tipo = params.get('tipo') ?? ''            // '' | 'proyecto' | 'recurrente'
  const proyecto = params.get('proyecto') ?? ''
  const frecuencia = params.get('frecuencia') ?? ''
  const estado = params.get('estado') ?? ''
  const periodo = params.get('periodo') ?? ''
  const etiquetas = (params.get('etiquetas') ?? '').split(',').filter(Boolean).map(Number)
  const modo = params.get('modo') === 'kanban' ? 'kanban' : 'tabla'
  const agrupar = params.get('agrupar') === 'proyecto' ? 'proyecto' : 'fecha'
  const set = (cambios: Record<string, string>) => setParams((p) => {
    const n = new URLSearchParams(p)
    for (const [k, v] of Object.entries(cambios)) { if (v) n.set(k, v); else n.delete(k) }
    return n
  }, { replace: true })
  const hayFiltros = !!(tipo || proyecto || frecuencia || estado || periodo || etiquetas.length)
  const limpiar = () => set({ tipo: '', proyecto: '', frecuencia: '', estado: '', periodo: '', etiquetas: '' })

  // Las de proyectos cerrados ya no se pueden mover: se ocultan del tablero. Con un equipo de trabajo activo, solo
  // las de sus proyectos (las recurrentes son de la persona y se conservan).
  const equipo = useEquipoTrabajoActivo().id
  const todas = useMemo(
    () => q.data?.filter((t) => (!t.estado_proyecto || !ESTADOS_FINALES.includes(t.estado_proyecto))
      && (equipo == null || t.id_proyecto == null || t.id_equipo_trabajo === equipo)) ?? [],
    [q.data, equipo],
  )
  // Opciones de los filtros a partir de las propias tareas.
  const proyectos = useMemo(() => [...new Map(todas.filter((t) => t.id_proyecto != null)
    .map((t) => [t.id_proyecto!, t.nombre_proyecto!])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [todas])
  const opcionesEtiquetas = useMemo(() => [...new Map(todas.flatMap((t) => t.etiquetas).map((e) => [e.id_etiqueta, e])).values()]
    .sort((a: Etiqueta, b: Etiqueta) => a.departamento.localeCompare(b.departamento) || a.nombre.localeCompare(b.nombre)), [todas])

  const rango = rangoPeriodo(periodo)
  const tareas = todas.filter((t) =>
    (tipo !== 'proyecto' || t.id_proyecto != null)
    && (tipo !== 'recurrente' || t.id_recurrente != null)
    && (!proyecto || String(t.id_proyecto) === proyecto)
    && (!frecuencia || t.frecuencia === frecuencia)
    && (!estado || t.estado === estado)
    && (!etiquetas.length || t.etiquetas.some((e) => etiquetas.includes(e.id_etiqueta)))
    && (periodo !== 'vencidas' || vencida(t))
    && (!rango || (t.fecha_fin >= rango[0] && t.fecha_inicio <= rango[1])))

  // Detalle: de la lista o, si llegó por enlace y no está a la vista (filtros, otra persona), se consulta aparte.
  const tareaParam = Number(params.get('tarea')) || null
  const [idDetalle, setIdDetalle] = useState<number | null>(tareaParam)
  const [ultimoParam, setUltimoParam] = useState(tareaParam)
  if (tareaParam !== ultimoParam) { setUltimoParam(tareaParam); if (tareaParam) setIdDetalle(tareaParam) }
  const enLista = q.data?.find((t) => t.id_tarea === idDetalle)
  const consultada = useTarea(idDetalle != null && q.isSuccess && !enLista ? idDetalle : null)
  const detalle = enLista ?? consultada.data
  const cerrarDetalle = () => { setIdDetalle(null); set({ tarea: '' }) }
  const [editando, setEditando] = useState<Tarea | null>(null)

  // Mover: la persona o quien gestiona. Editar con el formulario: solo las recurrentes (las de proyecto, en su proyecto).
  const puedeMover = (t: Tarea) => propio || gestionaEquipo || gestionaPersona(t.id_usuario)
  const editable = (t: Tarea) => t.id_recurrente != null && gestionaPersona(t.id_usuario)
  // En la tabla, título, fechas y horas: las recurrentes de quien las gestiona y las de proyectos que gestiona.
  const editaEnTabla = (t: Tarea) => {
    if (t.id_proyecto == null) return editable(t)
    const p = proyectoDe.get(t.id_proyecto)
    return !!p && gestionaProyecto(p)
  }
  const abiertas = tareas.filter((t) => t.estado !== 'Finalizado')
  const vencidas = abiertas.filter(vencida).length

  return (
    <div className="space-y-4">
      <AvisoEquipoTrabajo que="las tareas de proyectos" />
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Vista de tareas" className="inline-flex rounded-lg border border-border bg-surface p-0.5">
          {([['tabla', 'Tabla', Table2], ['kanban', 'Kanban', KanbanSquare]] as const).map(([v, label, Icono]) => (
            <button key={v} type="button" aria-pressed={modo === v} onClick={() => set({ modo: v === 'tabla' ? '' : v })}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${modo === v ? 'bg-brand-soft text-brand' : 'text-muted hover:text-fg'}`}>
              <Icono className="size-3.5" aria-hidden />{label}
            </button>
          ))}
        </div>
        {modo === 'tabla' && (
          <FilterSelect label="Agrupar por" value={agrupar} onChange={(v) => set({ agrupar: v === 'fecha' ? '' : v })}>
            <option value="fecha">Agrupar por vencimiento</option>
            <option value="proyecto">Agrupar por proyecto</option>
          </FilterSelect>
        )}
        <FilterSelect label="Filtrar por tipo" value={tipo} onChange={(v) => set({ tipo: v, ...(v === 'proyecto' ? { frecuencia: '' } : { proyecto: '' }) })}>
          <option value="">Proyectos y recurrentes</option>
          <option value="proyecto">De proyectos</option>
          <option value="recurrente">Recurrentes</option>
        </FilterSelect>
        {tipo !== 'recurrente' && proyectos.length > 0 && (
          <FilterSelect label="Filtrar por proyecto" value={proyecto} onChange={(v) => set({ proyecto: v })}>
            <option value="">Todos los proyectos</option>
            {proyectos.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
          </FilterSelect>
        )}
        {tipo !== 'proyecto' && (
          <FilterSelect label="Filtrar por frecuencia" value={frecuencia} onChange={(v) => set({ frecuencia: v })}>
            <option value="">Cualquier frecuencia</option>
            {FRECUENCIAS.map((f) => <option key={f}>{f}</option>)}
          </FilterSelect>
        )}
        <FilterSelect label="Filtrar por estatus" value={estado} onChange={(v) => set({ estado: v })}>
          <option value="">Todos los estatus</option>
          {ESTADOS_TAREA.map((e) => <option key={e}>{e}</option>)}
        </FilterSelect>
        <FilterSelect label="Filtrar por fecha" value={periodo} onChange={(v) => set({ periodo: v })}>
          {PERIODOS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </FilterSelect>
        <FiltroEtiquetas opciones={opcionesEtiquetas} value={etiquetas} onChange={(ids) => set({ etiquetas: ids.join(',') })}
          vacio="Ninguna de estas tareas tiene etiquetas." />
        {hayFiltros && <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={limpiar}>Limpiar</Button>}
      </div>

      {q.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : q.isError ? (
        <Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>
      ) : tareas.length === 0 ? (
        <Card><EmptyState icon={<KanbanSquare className="size-6" />}
          title={hayFiltros ? 'Ninguna tarea coincide' : 'Sin tareas pendientes'}
          description={hayFiltros ? 'Prueba con otros filtros.'
            : propio ? 'Aquí aparecen las tareas que te asignen en proyectos y las de tus tareas recurrentes.' : 'Esta persona no tiene tareas abiertas.'}
          action={hayFiltros && <Button onClick={limpiar}>Limpiar filtros</Button>} /></Card>
      ) : (
        <>
          <p className="text-sm text-muted">
            {abiertas.length} abiertas de {tareas.length} · {formatHours(abiertas.reduce((s, t) => s + num(t.horas_asignadas), 0))} por hacer
            {vencidas > 0 && <span className="font-medium text-danger"> · {vencidas} vencida{vencidas === 1 ? '' : 's'}</span>}
          </p>
          {modo === 'tabla' ? (
            <TablaTareas tareas={tareas} grupos={agrupar === 'fecha' ? gruposPorFecha() : gruposPorProyecto(tareas)}
              etiqueta={propio ? 'Mis tareas' : 'Tareas de la persona'} clave={`mis-tareas-${agrupar}`}
              plegadosIniciales={['finalizadas']} editaTodo={editaEnTabla} mueve={puedeMover}
              onAbrir={(t) => setIdDetalle(t.id_tarea)} />
          ) : (
            <KanbanBoard tareas={tareas} mostrarProyecto puedeMover={puedeMover}
              onEditar={setEditando} puedeEditar={editable} onAbrir={(t) => setIdDetalle(t.id_tarea)} />
          )}
        </>
      )}

      {detalle && !editando && (
        <TareaDetalleModal tarea={detalle} onClose={cerrarDetalle}
          onEditar={editable(detalle) ? () => setEditando(detalle) : undefined} />
      )}
      {editando && <TareaOperacionModal tarea={editando} onClose={() => setEditando(null)} />}
    </div>
  )
}
