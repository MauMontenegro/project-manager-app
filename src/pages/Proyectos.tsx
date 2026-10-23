import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarDays, ChevronRight, FolderKanban, GanttChart, List, Plus, Trash2, X } from 'lucide-react'
import { useDeleteProyectos, useEmpresas, useEquiposTrabajo, useEtiquetas, usePlantillaEtapas, useProyectos, useUsuarios } from '@/api/hooks'
import { AvisoEquipoTrabajo, useEquipoTrabajoActivo } from '@/features/equipos-trabajo/EquipoTrabajoActivo'
import { useUsuarioMap } from '@/api/lookups'
import { useAuth, usePermisos } from '@/auth/AuthProvider'
import { EstadoBadge, SemaforoBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FilterSelect } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Card, PageHeader, ProgressBar, Table, Td, Th } from '@/components/ui/Layout'
import { Pagination } from '@/components/ui/Pagination'
import { Tabs } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { formatDate, num } from '@/lib/format'
import { CalendarioProyectos } from '@/features/proyectos/CalendarioProyectos'
import { CronogramaProyectos } from '@/features/proyectos/CronogramaProyectos'
import { ConjuntoBadge, DepartamentoBadge, EtiquetasList, FiltroEtiquetas } from '@/features/proyectos/Etiquetas'
import { ProyectoFormModal } from '@/features/proyectos/ProyectoFormModal'
import {
  DEPARTAMENTOS_PROYECTO, ESTADOS_PROYECTO, SEMAFOROS, esDepartamentoProyecto, type DepartamentoProyecto,
  type EstadoProyecto, type Proyecto, type ProyectoBase, type ProyectosFiltro, type Semaforo,
} from '@/types/api'

const LIMIT = 20
/** Cronograma y calendario muestran todo el portafolio filtrado (sin paginar), hasta el máximo de la API. */
const LIMIT_SEGUIMIENTO = 200

/** Vistas del portafolio: el id viaja en `?vista=` (sin él, la lista). */
const VISTAS = [
  { id: 'lista', label: 'Lista', icon: List },
  { id: 'cronograma', label: 'Cronograma', icon: GanttChart },
  { id: 'calendario', label: 'Calendario', icon: CalendarDays },
] as const
type Vista = (typeof VISTAS)[number]['id']

/** Pestañas de espacio: el slug viaja en `?espacio=`. */
const ESPACIOS = [
  { id: 'todos', label: 'Todos', departamento: undefined },
  { id: 'infraestructura', label: 'Infraestructura', departamento: 'Infraestructura' },
  { id: 'procesos', label: 'Procesos', departamento: 'Procesos' },
  { id: 'desarrollo', label: 'Desarrollo de Software', departamento: 'Desarrollo de Software' },
] as const satisfies ReadonlyArray<{ id: string; label: string; departamento?: DepartamentoProyecto }>
type EspacioId = (typeof ESPACIOS)[number]['id']

export default function Proyectos() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { sesion } = useAuth()
  const { gestionaEquipo, esAdmin, creaProyectos } = usePermisos()
  const [creating, setCreating] = useState(false)
  const equipoActivo = useEquipoTrabajoActivo()
  const equipos = useEquiposTrabajo()
  const equipoDe = (id: number | null) => (id == null || equipoActivo.id != null ? undefined : equipos.data?.find((e) => e.id_equipo_trabajo === id))

  // Sin `?espacio=` se abre el del departamento de quien consulta.
  const propio = ESPACIOS.find((e) => esDepartamentoProyecto(sesion?.departamento) && e.departamento === sesion?.departamento)
  const espacio = ESPACIOS.find((e) => e.id === params.get('espacio')) ?? propio ?? ESPACIOS[0]
  const departamento = espacio.departamento

  const semaforo = params.get('semaforo') ?? ''
  const estado = params.get('estado') ?? ''
  const etapa = params.get('etapa') ?? ''
  const empresa = params.get('empresa') ?? ''
  const lider = params.get('lider') ?? ''
  const etiquetas = (params.get('etiquetas') ?? '').split(',').filter(Boolean).map(Number)
  const offset = Number(params.get('offset') ?? 0)
  const vista: Vista = VISTAS.find((v) => v.id === params.get('vista'))?.id ?? 'lista'
  const enLista = vista === 'lista'

  const filtro: ProyectosFiltro = {
    limit: enLista ? LIMIT : LIMIT_SEGUIMIENTO, offset: enLista ? offset : 0, departamento,
    semaforo: (semaforo || undefined) as Semaforo | undefined,
    estado: (estado || undefined) as EstadoProyecto | undefined,
    etapa: etapa || undefined,
    id_empresa: empresa ? Number(empresa) : undefined,
    lider_id: lider ? Number(lider) : undefined,
    etiquetas: etiquetas.length ? etiquetas : undefined,
    id_equipo_trabajo: equipoActivo.id ?? undefined,
  }
  const q = useProyectos(filtro)
  const empresas = useEmpresas()
  const lideres = useUsuarios()
  const opcionesEtiquetas = useEtiquetas(departamento)
  const etapas = useNombresEtapa(departamento)
  const { map: usuarios } = useUsuarioMap()

  // Selección para eliminar (solo Administrador). Se vacía al cambiar de espacio, filtros o página.
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  const [claveSeleccion, setClaveSeleccion] = useState('')
  const clave = `${params.toString()}|${equipoActivo.id}`
  if (clave !== claveSeleccion) { setClaveSeleccion(clave); setSeleccion(new Set()) }
  const [confirmando, setConfirmando] = useState(false)
  const items = q.data?.items ?? []
  // Un subproyecto cuyo conjunto está seleccionado ya se elimina con él.
  const padreSeleccionado = (s: ProyectoBase) => s.id_proyecto_padre !== null && seleccion.has(s.id_proyecto_padre)
  const aEliminar = [...items, ...items.flatMap((p) => p.subproyectos)]
    .filter((p) => seleccion.has(p.id_proyecto) && !padreSeleccionado(p))
  const todos = items.length > 0 && items.every((p) => seleccion.has(p.id_proyecto))
  const alternar = (id: number) => setSeleccion((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })
  const seleccionable = esAdmin
    ? { seleccion, alternar, padreSeleccionado }
    : undefined

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    next.delete('offset')
    setParams(next, { replace: true })
  }
  const setOffset = (o: number) => {
    const next = new URLSearchParams(params)
    if (o) next.set('offset', String(o)); else next.delete('offset')
    setParams(next, { replace: true })
  }
  // Las etapas y etiquetas son de cada departamento: al cambiar de espacio se limpian esos filtros.
  const setEspacio = (id: EspacioId) => {
    const next = new URLSearchParams(params)
    next.set('espacio', id)
    for (const k of ['etapa', 'etiquetas', 'offset']) next.delete(k)
    setParams(next, { replace: true })
  }
  const limpiar = () => setParams({ espacio: espacio.id, ...(enLista ? {} : { vista }) }, { replace: true })
  const hasFilters = !!(semaforo || estado || etapa || empresa || lider || etiquetas.length)

  return (
    <>
      <PageHeader title="Proyectos"
        description={departamento ? `Espacio de ${departamento}: sus proyectos y los conjuntos en que participa.` : 'Portafolio completo de los tres departamentos.'}
        actions={creaProyectos && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nuevo proyecto</Button>} />

      <AvisoEquipoTrabajo que="los proyectos" />
      <Tabs label="Espacio de proyectos" value={espacio.id} onChange={setEspacio}
        tabs={ESPACIOS.map(({ id, label }) => ({ id, label }))} />

      <div role="tabpanel" id={`panel-${espacio.id}`} aria-labelledby={`tab-${espacio.id}`} className="pt-4">
        <Card>
          <div className="space-y-3 border-b border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect label="Filtrar por semáforo" value={semaforo} onChange={(v) => set('semaforo', v)}>
                <option value="">Todos los semáforos</option>
                {SEMAFOROS.map((s) => <option key={s}>{s}</option>)}
              </FilterSelect>
              <FilterSelect label="Filtrar por etapa" value={etapa} onChange={(v) => set('etapa', v)}>
                <option value="">Todas las etapas</option>
                {etapas.map((n) => <option key={n}>{n}</option>)}
              </FilterSelect>
              <FilterSelect label="Filtrar por estatus" value={estado} onChange={(v) => set('estado', v)}>
                <option value="">Todos los estatus</option>
                {ESTADOS_PROYECTO.map((s) => <option key={s}>{s}</option>)}
              </FilterSelect>
              <FilterSelect label="Filtrar por empresa" value={empresa} onChange={(v) => set('empresa', v)}>
                <option value="">Todas las empresas</option>
                {empresas.data?.map((e) => <option key={e.id_empresa} value={e.id_empresa}>{e.nombre_empresa}</option>)}
              </FilterSelect>
              <FilterSelect label="Filtrar por líder" value={lider} onChange={(v) => set('lider', v)}>
                <option value="">Todos los líderes</option>
                {lideres.data?.filter((u) => u.tipo_recurso !== 'Activo').map((u) => <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>)}
              </FilterSelect>
              <FiltroEtiquetas opciones={opcionesEtiquetas.data ?? []} value={etiquetas}
                onChange={(ids) => set('etiquetas', ids.join(','))}
                vacio={<>{departamento ? `${departamento} aún no tiene etiquetas.` : 'Aún no hay etiquetas.'}{gestionaEquipo && <> Créalas en <Link to="/configuracion" className="text-brand hover:underline">Configuración</Link>.</>}</>} />
              {hasFilters && (
                <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={limpiar}>Limpiar</Button>
              )}
              <div role="group" aria-label="Vista del portafolio" className="inline-flex rounded-lg border border-border bg-surface p-0.5 lg:ml-auto">
                {VISTAS.map(({ id: v, label, icon: Icon }) => (
                  <button key={v} type="button" aria-pressed={vista === v} onClick={() => set('vista', v === 'lista' ? '' : v)}
                    className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                      vista === v ? 'bg-brand-soft text-brand' : 'text-muted hover:text-fg')}>
                    <Icon className="size-3.5" aria-hidden />{label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {enLista && seleccion.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-border bg-brand-soft/40 px-4 py-2.5 text-sm">
              <span className="font-medium">{seleccion.size} {seleccion.size === 1 ? 'proyecto seleccionado' : 'proyectos seleccionados'}</span>
              <Button size="sm" variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirmando(true)}>Eliminar</Button>
              <Button size="sm" variant="ghost" onClick={() => setSeleccion(new Set())}>Cancelar selección</Button>
            </div>
          )}

          {q.isPending ? (
            <div className="space-y-3 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : q.isError ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          ) : q.data.items.length === 0 ? (
            <EmptyState icon={<FolderKanban className="size-6" />}
              title={hasFilters ? 'Ningún proyecto coincide' : departamento ? `${departamento} aún no tiene proyectos` : 'Aún no hay proyectos'}
              description={hasFilters ? 'Prueba con otros filtros.' : creaProyectos ? 'Crea el primero para comenzar.' : undefined}
              action={hasFilters ? <Button onClick={limpiar}>Limpiar filtros</Button>
                : creaProyectos && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Nuevo proyecto</Button>} />
          ) : !enLista ? (
            <div className={q.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
              {q.data.total > q.data.items.length && (
                <p className="border-b border-border bg-warn-soft px-4 py-2 text-sm text-warn">
                  Se muestran {q.data.items.length} de {q.data.total} proyectos: usa los filtros para acotar el portafolio.
                </p>
              )}
              {vista === 'cronograma'
                ? <CronogramaProyectos key={espacio.id} proyectos={q.data.items} departamento={departamento} lider={(id) => usuarios.get(id)?.nombre ?? '—'} />
                : <CalendarioProyectos proyectos={q.data.items} departamento={departamento} />}
            </div>
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    {esAdmin && (
                      <Th className="w-10">
                        <input type="checkbox" className="size-4 accent-[var(--brand)]" aria-label="Seleccionar todos los proyectos de la página"
                          checked={todos} onChange={() => setSeleccion(todos ? new Set() : new Set(items.map((p) => p.id_proyecto)))} />
                      </Th>
                    )}
                    <Th>Proyecto</Th>{!departamento && <Th>Departamento</Th>}<Th>Líder</Th><Th>Etapa</Th>
                    <Th className="min-w-32">Avance</Th><Th>Estatus</Th><Th>Semáforo</Th><Th>Fecha comprometida</Th>
                  </tr>
                </thead>
                <tbody className={q.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
                  {q.data.items.map((p) => (
                    <FilaProyecto key={p.id_proyecto} p={p} departamento={departamento} seleccionable={seleccionable}
                      lider={(id) => usuarios.get(id)?.nombre ?? '—'} equipo={equipoDe(p.id_equipo_trabajo)} />
                  ))}
                </tbody>
              </Table>
              <Pagination total={q.data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
            </>
          )}
        </Card>
      </div>

      {confirmando && (
        <EliminarSeleccionDialog proyectos={aEliminar}
          onClose={() => setConfirmando(false)} onDone={() => { setConfirmando(false); setSeleccion(new Set()) }} />
      )}
      {creating && (
        <ProyectoFormModal departamentoInicial={departamento} equipoTrabajoInicial={equipoActivo.id ?? undefined} onClose={() => setCreating(false)}
          onSaved={(p) => navigate(`/proyectos/${p.id_proyecto}`)} />
      )}
    </>
  )
}

function EliminarSeleccionDialog({ proyectos, onClose, onDone }: {
  proyectos: ProyectoBase[]; onClose: () => void; onDone: () => void
}) {
  const toast = useToast()
  const del = useDeleteProyectos()
  const conjuntos = proyectos.filter((p) => p.es_conjunto).length
  const MAX = 8
  return (
    <ConfirmDialog open danger title={proyectos.length === 1 ? 'Eliminar proyecto' : `Eliminar ${proyectos.length} proyectos`}
      confirmLabel="Eliminar" loading={del.isPending} error={del.error} onClose={onClose}
      onConfirm={() => del.mutate(proyectos.map((p) => p.id_proyecto), {
        onSuccess: ({ eliminados, fallidos }) => {
          if (eliminados) toast.success(eliminados === 1 ? 'Proyecto eliminado' : `${eliminados} proyectos eliminados`)
          for (const f of fallidos) {
            const nombre = proyectos.find((p) => p.id_proyecto === f.id)?.nombre_proyecto ?? `#${f.id}`
            toast.error(`No se eliminó “${nombre}”: ${f.motivo}`)
          }
          onDone()
        },
      })}>
      <p>Se eliminarán de forma permanente, con sus etapas, tareas, asignaciones, bloqueos y demás registros:</p>
      <ul className="list-disc space-y-0.5 pl-5 text-fg">
        {proyectos.slice(0, MAX).map((p) => <li key={p.id_proyecto}>{p.nombre_proyecto}</li>)}
        {proyectos.length > MAX && <li className="text-muted">y {proyectos.length - MAX} más</li>}
      </ul>
      {conjuntos > 0 && <p>Los proyectos conjuntos se eliminan junto con todos sus subproyectos.</p>}
      <p>Esta acción no se puede deshacer. Si solo quieres detener un proyecto, márcalo como “Cancelado” para conservar su historial.</p>
    </ConfirmDialog>
  )
}

type Seleccionable = {
  seleccion: Set<number>
  alternar: (id: number) => void
  padreSeleccionado: (p: ProyectoBase) => boolean
}

/** Nombres de etapa para el filtro: los de la plantilla del departamento o, en "Todos", los de los tres. */
function useNombresEtapa(departamento: DepartamentoProyecto | undefined) {
  const infra = usePlantillaEtapas(DEPARTAMENTOS_PROYECTO[0])
  const procesos = usePlantillaEtapas(DEPARTAMENTOS_PROYECTO[1])
  const desarrollo = usePlantillaEtapas(DEPARTAMENTOS_PROYECTO[2])
  return useMemo(() => {
    const listas = [infra.data, procesos.data, desarrollo.data]
    const elegidas = departamento ? [listas[DEPARTAMENTOS_PROYECTO.indexOf(departamento)]] : listas
    return [...new Set(elegidas.flatMap((l) => l?.map((e) => e.nombre) ?? []))]
  }, [departamento, infra.data, procesos.data, desarrollo.data])
}

/** Un proyecto de primer nivel; los conjuntos se despliegan con sus subproyectos. En el espacio de un
 * departamento se abren por defecto y resaltan el subproyecto de ese departamento. */
function FilaProyecto({ p, departamento, lider, seleccionable, equipo }: {
  p: Proyecto; departamento?: DepartamentoProyecto; lider: (id: number) => string; seleccionable?: Seleccionable
  /** Su equipo de trabajo, si se muestra (no hay uno activo filtrando). */
  equipo?: { nombre: string; color: string }
}) {
  const [abierto, setAbierto] = useState(!!departamento)
  return (
    <>
      <Fila p={p} departamento={departamento} lider={lider} seleccionable={seleccionable} equipo={equipo}
        expandir={p.es_conjunto ? { abierto, toggle: () => setAbierto((a) => !a) } : undefined} />
      {p.es_conjunto && abierto && p.subproyectos.map((s) => (
        <Fila key={s.id_proyecto} p={s} departamento={departamento} lider={lider} anidado seleccionable={seleccionable}
          atenuado={!!departamento && s.departamento !== departamento} />
      ))}
    </>
  )
}

function Fila({ p, departamento, lider, expandir, anidado, atenuado, seleccionable, equipo }: {
  p: ProyectoBase & { subproyectos?: ProyectoBase[] }
  equipo?: { nombre: string; color: string }
  departamento?: DepartamentoProyecto
  lider: (id: number) => string
  seleccionable?: Seleccionable
  expandir?: { abierto: boolean; toggle: () => void }
  anidado?: boolean
  atenuado?: boolean
}) {
  const navigate = useNavigate()
  const subs = p.subproyectos ?? []
  return (
    <tr className={cn('cursor-pointer hover:bg-surface-2/60', anidado && 'bg-surface-2/30', atenuado && 'text-muted')}
      onClick={() => navigate(`/proyectos/${p.id_proyecto}`)}>
      {seleccionable && (() => {
        const porPadre = seleccionable.padreSeleccionado(p)
        return (
          <Td className={cn('w-10', anidado && 'pl-8')}>
            <input type="checkbox" className="size-4 accent-[var(--brand)]"
              aria-label={`Seleccionar ${anidado && p.departamento ? `subproyecto de ${p.departamento}` : p.nombre_proyecto}`}
              title={porPadre ? 'Se elimina junto con su proyecto conjunto' : undefined}
              checked={porPadre || seleccionable.seleccion.has(p.id_proyecto)} disabled={porPadre}
              onClick={(e) => e.stopPropagation()} onChange={() => seleccionable.alternar(p.id_proyecto)} />
          </Td>
        )
      })()}
      <Td className="max-w-sm">
        <div className={cn('flex items-start gap-2', anidado && 'pl-7')}>
          {expandir && (
            <button type="button" aria-expanded={expandir.abierto}
              aria-label={`${expandir.abierto ? 'Ocultar' : 'Mostrar'} subproyectos de ${p.nombre_proyecto}`}
              onClick={(e) => { e.stopPropagation(); expandir.toggle() }}
              className="mt-0.5 rounded p-0.5 text-muted hover:bg-surface-2 hover:text-fg">
              <ChevronRight className={cn('size-4 transition-transform', expandir.abierto && 'rotate-90')} />
            </button>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/proyectos/${p.id_proyecto}`} onClick={(e) => e.stopPropagation()}
                className={cn('font-medium hover:text-brand hover:underline', atenuado ? 'text-muted' : 'text-fg')}>
                {anidado && p.departamento ? p.departamento : p.nombre_proyecto}
              </Link>
              {p.es_conjunto && <ConjuntoBadge />}
              {equipo && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-px text-[11px] text-muted" title="Equipo de trabajo">
                  <span className="size-2 rounded-full" style={{ background: equipo.color }} aria-hidden />{equipo.nombre}
                </span>
              )}
            </div>
            {!anidado && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{p.objetivo}</p>}
            <EtiquetasList etiquetas={p.etiquetas} className="mt-1.5" />
          </div>
        </div>
      </Td>
      {!departamento && (
        <Td className="whitespace-nowrap">
          {p.es_conjunto ? <span className="text-muted">{subs.map((s) => s.departamento).join(', ')}</span>
            : anidado ? null : <DepartamentoBadge value={p.departamento} />}
        </Td>
      )}
      <Td className="whitespace-nowrap">{lider(p.lider_id)}</Td>
      <Td className="whitespace-nowrap text-muted">
        {p.es_conjunto ? `${subs.length} departamentos` : p.etapa_actual}
      </Td>
      <Td>
        <div className="flex items-center gap-2">
          <div className="flex-1"><ProgressBar label={`Avance de ${p.nombre_proyecto}`} value={num(p.porcentaje_avance)} /></div>
          <span className="w-9 text-right text-xs text-muted tabular-nums">{Math.round(num(p.porcentaje_avance))}%</span>
        </div>
      </Td>
      <Td><EstadoBadge value={p.estado_proyecto} /></Td>
      <Td><span title={p.semaforo_motivo ?? undefined}><SemaforoBadge value={p.semaforo} /></span></Td>
      <Td className="whitespace-nowrap text-muted">{formatDate(p.fecha_comprometida)}</Td>
    </tr>
  )
}
