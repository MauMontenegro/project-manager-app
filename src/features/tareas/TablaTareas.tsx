import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  AlertOctagon, ArrowDown, ArrowUp, ChevronDown, ChevronRight, Loader2, Lock, Maximize2, MessageSquare, Repeat, Search, Trash2, X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAsignaciones, useBloqueos, useCreateTarea, useDeleteTarea, useInvolucrados, useUpdateTarea } from '@/api/hooks'
import { useUsuarioMap } from '@/api/lookups'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SelectField, TextArea } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/Layout'
import { Modal } from '@/components/ui/Modal'
import { MenuOpciones, type Opcion } from '@/components/ui/Popover'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { formatDate, formatHours, num, todayISO } from '@/lib/format'
import { ApiError } from '@/lib/http'
import { ESTADOS_TAREA, fechaFinProyecto, type EstadoTarea, type ProyectoDetalle, type Tarea, type TareaUpdate } from '@/types/api'
import { formatDesfase } from '@/features/bloqueos/tiempo'
import { dependenciasPendientes, nombreRelacionada } from './KanbanBoard'
import { origenTarea, puntoEstado, textoPeriodo } from './fechas'

/** Un grupo de la tabla: una etapa (o, en un conjunto, un departamento o "General"); en Mis tareas, un periodo o un
 * proyecto. */
export interface GrupoTabla {
  clave: string
  titulo: string
  color: string
  /** Etapa con la que se crean las tareas del grupo (null en las generales de un conjunto). */
  idEtapa?: number | null
  /** Se pueden agregar tareas desde el grupo (solo en la tabla de un proyecto). */
  agregar?: boolean
  incluye: (t: Tarea) => boolean
}

/** Estado como etiqueta suave: lo pendiente (lo más común) pesa poco y destaca lo que está en marcha o por revisar. */
const PILL_ESTADO: Record<EstadoTarea, string> = {
  Pendiente: 'bg-neutral-soft text-muted',
  'En progreso': 'bg-brand-soft text-brand',
  'En revisión': 'bg-warn-soft text-warn',
  Finalizado: 'bg-ok-soft text-ok',
}

function PildoraEstado({ estado }: { estado: EstadoTarea }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', PILL_ESTADO[estado])}>
      <span className={cn('size-1.5 rounded-full', puntoEstado[estado])} aria-hidden />{estado}
    </span>
  )
}

type Columna = 'titulo' | 'responsable' | 'origen' | 'estado' | 'inicio' | 'fin' | 'horas' | 'reales'
const COLUMNAS: { id: Columna; label: string; ancho: string; ordenable?: boolean; derecha?: boolean }[] = [
  { id: 'titulo', label: 'Tarea', ancho: 'min-w-52 sm:min-w-72', ordenable: true },
  { id: 'responsable', label: 'Responsable', ancho: 'w-48', ordenable: true },
  { id: 'estado', label: 'Estado', ancho: 'w-36', ordenable: true },
  { id: 'inicio', label: 'Inicio', ancho: 'w-32', ordenable: true },
  { id: 'fin', label: 'Fecha límite', ancho: 'w-40', ordenable: true },
  { id: 'horas', label: 'Horas', ancho: 'w-24', ordenable: true, derecha: true },
  { id: 'reales', label: 'Reales', ancho: 'w-24', derecha: true },
]
/** En Mis tareas todas son de la misma persona: en lugar del responsable se ve de dónde viene cada una. */
const COLUMNAS_PERSONA = COLUMNAS.map((c) => (c.id === 'responsable' ? { ...c, id: 'origen' as const, label: 'Proyecto', ancho: 'w-60' } : c))
const ORDEN_ESTADO = Object.fromEntries(ESTADOS_TAREA.map((e, i) => [e, i])) as Record<EstadoTarea, number>

const fechaCorta = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(`${iso.slice(0, 10)}T00:00`)
  const mismoAnio = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', ...(mismoAnio ? {} : { year: '2-digit' }) }).replace('.', '')
}

const leerPlegados = (clave: string, iniciales: string[] = []) => {
  try {
    const guardado = localStorage.getItem(clave)
    return new Set<string>(guardado ? JSON.parse(guardado) : iniciales)
  } catch { return new Set<string>(iniciales) }
}

/**
 * Tabla editable de tareas, por grupos: cada celda se edita en su lugar con un clic (o Enter) y se navega con las
 * flechas. En un proyecto, quien lo gestiona edita todo, agrega tareas al final de cada grupo y cambia varias a la vez;
 * la persona asignada, el estado y las horas reales de las suyas. En Mis tareas (sin `proyecto`) cada fila muestra
 * de dónde viene y se pueden cambiar varios estados a la vez.
 */
export function TablaTareas({ tareas, grupos, editaTodo, mueve, onAbrir, etiqueta, clave, proyecto, plegadosIniciales }: {
  tareas: Tarea[]
  grupos: GrupoTabla[]
  /** Título, fechas y horas (y, en un proyecto, responsable y etapa). */
  editaTodo: (t: Tarea) => boolean
  /** Estado y horas reales. */
  mueve: (t: Tarea) => boolean
  onAbrir: (t: Tarea) => void
  /** Nombre accesible de la tabla. */
  etiqueta: string
  /** Identifica la tabla para recordar qué grupos están plegados. */
  clave: string
  /** Tabla de un proyecto: columna de responsable, agregar tareas, mover de etapa y fechas acotadas al proyecto. */
  proyecto?: { p: ProyectoDetalle; gestiona: boolean; cerrado: boolean }
  /** Grupos plegados la primera vez (luego se recuerda lo que elija la persona). */
  plegadosIniciales?: string[]
}) {
  const p = proyecto?.p
  // "Reales" solo aporta cuando hay tareas finalizadas: sin ellas, la columna sería puro espacio vacío.
  const conReales = tareas.some((t) => t.estado === 'Finalizado')
  const columnas = (p ? COLUMNAS : COLUMNAS_PERSONA).filter((c) => conReales || c.id !== 'reales')
  const toast = useToast()
  const { sesion } = useAuth()
  const update = useUpdateTarea()
  const create = useCreateTarea(p?.id_proyecto ?? 0)
  const del = useDeleteTarea()
  const { map: usuarios } = useUsuarioMap()
  const asignaciones = useAsignaciones(p && !p.es_conjunto ? p.id_proyecto : 0)
  const involucrados = useInvolucrados(p?.es_conjunto ? p.id_proyecto : 0)

  const [busqueda, setBusqueda] = useState('')
  const [soloMias, setSoloMias] = useState(false)
  const [ocultarFinalizadas, setOcultarFinalizadas] = useState(false)
  const [orden, setOrden] = useState<{ col: Columna; dir: 1 | -1 } | null>(null)
  const clavePlegados = `tabla.plegados.${clave}`
  const [plegados, setPlegados] = useState(() => leerPlegados(clavePlegados, plegadosIniciales))
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  // Cambios en vuelo: la celda muestra el valor nuevo antes de que responda la API.
  const [enVuelo, setEnVuelo] = useState<Record<number, Partial<Tarea>>>({})
  const [retraso, setRetraso] = useState<{ t: Tarea; fecha: string } | null>(null)
  const [resaltada, setResaltada] = useState<number | null>(null)
  const [foco, setFoco] = useState<{ r: number; c: number }>({ r: 0, c: 1 })
  const tablaRef = useRef<HTMLTableElement>(null)

  const pInicio = p?.fecha_inicio ?? null
  const pFin = p ? fechaFinProyecto(p) : null
  const esYo = (id: number) => sesion?.id_usuario === id
  // En un proyecto se selecciona para editar en bloque; en Mis tareas, para cambiar estados.
  const seleccionable = (t: Tarea) => (p ? editaTodo(t) : mueve(t))

  // Personas que pueden ser responsables: las asignadas al proyecto (en un conjunto, las de sus subproyectos y líderes).
  const personas = useMemo(() => {
    const ids = p?.es_conjunto ? involucrados.data?.map((x) => x.id_usuario) : asignaciones.data?.map((a) => a.id_usuario)
    return [...new Set(ids ?? [])]
      .map((id) => ({ id, nombre: usuarios.get(id)?.nombre ?? `Usuario #${id}` }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [p?.es_conjunto, involucrados.data, asignaciones.data, usuarios])

  const conCambios = useCallback((t: Tarea): Tarea => ({ ...t, ...enVuelo[t.id_tarea] }), [enVuelo])

  const guardar = (t: Tarea, cambio: TareaUpdate, vista: Partial<Tarea>) => {
    setEnVuelo((m) => ({ ...m, [t.id_tarea]: { ...m[t.id_tarea], ...vista } }))
    update.mutate({ id_tarea: t.id_tarea, ...cambio }, {
      onSuccess: (r) => {
        if (vista.estado === 'Finalizado') toast.success(`“${t.titulo}” finalizada${r.horas_reales == null ? ' · registra sus horas reales en la columna Reales' : ''}`)
      },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo guardar el cambio'),
      onSettled: () => setEnVuelo(({ [t.id_tarea]: _, ...resto }) => resto),
    })
  }

  const cambiarEstado = (t: Tarea, estado: EstadoTarea) => {
    if (estado === t.estado) return
    if (estado !== 'Pendiente' && t.bloqueada) {
      toast.error(`“${t.titulo}” depende de ${dependenciasPendientes(t).map((d) => nombreRelacionada(d, t)).join(', ')}: termínala(s) primero`)
      return
    }
    guardar(t, { estado }, { estado })
  }
  const cambiarFecha = (t: Tarea, campo: 'fecha_inicio' | 'fecha_fin', valor: string) => {
    if (!valor || valor === t[campo]) return
    const inicio = campo === 'fecha_inicio' ? valor : t.fecha_inicio
    const fin = campo === 'fecha_fin' ? valor : t.fecha_fin
    if (inicio > fin) {
      toast.error(campo === 'fecha_inicio' ? 'El inicio no puede ser posterior a la fecha límite' : 'La fecha límite no puede ser anterior al inicio')
      return
    }
    // Retrasar la fecha límite de una tarea de proyecto deja rastro: se pide el motivo antes de guardar.
    if (campo === 'fecha_fin' && valor > t.fecha_fin && t.id_recurrente == null) { setRetraso({ t, fecha: valor }); return }
    guardar(t, { [campo]: valor }, { [campo]: valor })
  }
  const cambiarHoras = (t: Tarea, campo: 'horas_asignadas' | 'horas_reales', texto: string) => {
    const limpio = texto.trim().replace(',', '.')
    if (campo === 'horas_reales' && limpio === '') {
      if (t.horas_reales != null) guardar(t, { horas_reales: null }, { horas_reales: null })
      return
    }
    const n = Number(limpio)
    if (!Number.isFinite(n) || n < 0) { toast.error('Escribe un número de horas válido (0 o más)'); return }
    if (n === num(t[campo])) return
    guardar(t, { [campo]: String(n) }, { [campo]: String(n) })
  }

  // ---------- Filtros, orden y grupos ----------
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return tareas.map(conCambios).filter((t) =>
      (!q || t.titulo.toLowerCase().includes(q) || t.nombre_usuario.toLowerCase().includes(q) || origenTarea(t).toLowerCase().includes(q))
      && (!soloMias || esYo(t.id_usuario))
      && (!ocultarFinalizadas || t.estado !== 'Finalizado'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tareas, conCambios, busqueda, soloMias, ocultarFinalizadas, sesion?.id_usuario])

  const ordenar = useCallback((lista: Tarea[]) => {
    if (!orden) return lista
    const valor = (t: Tarea): string | number => ({
      titulo: t.titulo.toLowerCase(), responsable: t.nombre_usuario.toLowerCase(), origen: origenTarea(t).toLowerCase(), estado: ORDEN_ESTADO[t.estado],
      inicio: t.fecha_inicio, fin: t.fecha_fin, horas: num(t.horas_asignadas), reales: num(t.horas_reales),
    })[orden.col]
    return [...lista].sort((a, b) => (valor(a) < valor(b) ? -1 : valor(a) > valor(b) ? 1 : 0) * orden.dir)
  }, [orden])

  const filtrando = !!busqueda.trim() || soloMias || ocultarFinalizadas
  const secciones = grupos
    .map((g) => ({ g, filas: ordenar(visibles.filter(g.incluye)) }))
    // Con filtros activos se ocultan los grupos sin coincidencias; sin ellos, se ven todos (para agregar tareas).
    .filter(({ g, filas }) => filas.length > 0 || (!filtrando && (g.agregar || grupos.length === 1)))

  // Índice de fila global para la navegación con flechas.
  let fila = 0
  const filasPorSeccion = secciones.map(({ g, filas }) => {
    const plegado = plegados.has(g.clave)
    const inicio = fila
    if (!plegado) fila += filas.length
    return { g, filas, plegado, inicio }
  })

  const alternarPlegado = (clave: string) => setPlegados((s) => {
    const n = new Set(s)
    if (!n.delete(clave)) n.add(clave)
    try { localStorage.setItem(clavePlegados, JSON.stringify([...n])) } catch { /* solo preferencia */ }
    return n
  })
  const alternarOrden = (col: Columna) => setOrden((o) => (o?.col !== col ? { col, dir: 1 } : o.dir === 1 ? { col, dir: -1 } : null))

  // La selección solo conserva tareas que siguen visibles y editables.
  const editablesVisibles = visibles.filter(seleccionable)
  useEffect(() => {
    setSeleccion((s) => {
      const ids = new Set(editablesVisibles.map((t) => t.id_tarea))
      const n = new Set([...s].filter((id) => ids.has(id)))
      return n.size === s.size ? s : n
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibles])
  const alternarSeleccion = (ids: number[], marcar: boolean) => setSeleccion((s) => {
    const n = new Set(s)
    for (const id of ids) { if (marcar) n.add(id); else n.delete(id) }
    return n
  })

  // ---------- Navegación con teclado (rejilla) ----------
  const enfocar = (r: number, c: number) => {
    const el = tablaRef.current?.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`)
    if (el) { el.focus(); return true }
    return false
  }
  const onKeyDown = (e: KeyboardEvent<HTMLTableElement>) => {
    const el = e.target as HTMLElement
    if (el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'checkbox') return
    const r = Number(el.dataset.r), c = Number(el.dataset.c)
    if (Number.isNaN(r) || Number.isNaN(c)) return
    const pasos: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    const paso = pasos[e.key]
    if (!paso) return
    e.preventDefault()
    if (paso[0]) {
      // Arriba/abajo: la misma columna en la fila vecina (o el título, si esa fila no tiene esa celda).
      for (let rr = r + paso[0]; rr >= 0 && rr < fila; rr += paso[0]) if (enfocar(rr, c) || enfocar(rr, 1)) return
    } else {
      // Izquierda/derecha: salta columnas sin celda enfocable (p. ej. sin casilla de selección).
      for (let cc = c + paso[1]; cc >= 0 && cc <= columnas.length; cc += paso[1]) if (enfocar(r, cc)) return
    }
  }
  const celda = (r: number, c: number) => ({
    'data-r': r, 'data-c': c,
    tabIndex: foco.r === r && foco.c === c ? 0 : -1,
    onFocus: () => setFoco({ r, c }),
  })

  // ---------- Agregar ----------
  const responsablePorDefecto = () =>
    personas.find((x) => esYo(x.id))?.id ?? personas.find((x) => x.id === p?.lider_id)?.id ?? personas[0]?.id
  const agregar = async (g: GrupoTabla, titulo: string) => {
    const idUsuario = responsablePorDefecto()
    if (idUsuario == null) {
      toast.error(p?.es_conjunto ? 'Primero asigna personas en algún subproyecto' : 'Primero asigna personas al proyecto en la pestaña Asignaciones')
      return false
    }
    let dia = todayISO()
    if (pInicio && dia < pInicio) dia = pInicio
    if (pFin && dia > pFin) dia = pFin
    try {
      const t = await create.mutateAsync({
        titulo, id_etapa: g.idEtapa, id_usuario: idUsuario, horas_asignadas: 0, fecha_inicio: dia, fecha_fin: dia, dependencias: [],
      })
      setResaltada(t.id_tarea)
      setTimeout(() => setResaltada((x) => (x === t.id_tarea ? null : x)), 2500)
      if (plegados.has(g.clave)) alternarPlegado(g.clave)
      return true
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo crear la tarea')
      return false
    }
  }

  const sinTareas = tareas.length === 0

  return (
    <div className={cn('space-y-3', seleccion.size > 0 && 'pb-20')}>
      {/* Barra de herramientas */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">{p ? 'Buscar tarea o persona' : 'Buscar tarea o proyecto'}</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder={p ? 'Buscar tarea o persona' : 'Buscar tarea o proyecto'}
            className="h-8 w-56 rounded-lg border border-border bg-surface pr-2 pl-8 text-sm focus:border-brand focus:ring-4 focus:ring-[var(--ring)] focus:outline-none" />
        </label>
        {p && <Interruptor activo={soloMias} onClick={() => setSoloMias((v) => !v)}>Solo mis tareas</Interruptor>}
        <Interruptor activo={ocultarFinalizadas} onClick={() => setOcultarFinalizadas((v) => !v)}>Ocultar finalizadas</Interruptor>
        {orden && (
          <button type="button" onClick={() => setOrden(null)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted hover:text-fg">
            <X className="size-3.5" aria-hidden /> Quitar orden
          </button>
        )}
        <p className="ml-auto hidden text-xs text-muted lg:block">
          Clic o <kbd className="rounded border border-border px-1 font-sans">Enter</kbd> para editar · flechas para moverte
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table ref={tablaRef} role="grid" aria-label={etiqueta} onKeyDown={onKeyDown}
          className="w-full min-w-[60rem] border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-20">
            <tr className="bg-surface">
              <th scope="col" className="sticky left-0 z-10 w-10 min-w-10 border-b border-border bg-surface px-0">
                <span className="sr-only">Seleccionar</span>
              </th>
              {columnas.map((col, i) => (
                <th key={col.id} scope="col" aria-sort={orden?.col === col.id ? (orden.dir === 1 ? 'ascending' : 'descending') : undefined}
                  className={cn('border-b border-border px-3 py-2.5 text-left text-xs font-medium text-muted', col.ancho,
                    i === 0 && 'sticky left-10 z-10 bg-surface', col.derecha && 'text-right')}>
                  {col.ordenable ? (
                    <button type="button" onClick={() => alternarOrden(col.id)}
                      className={cn('inline-flex items-center gap-1 hover:text-fg', orden?.col === col.id && 'text-fg')}>
                      {col.label}
                      {orden?.col === col.id && (orden.dir === 1 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
                    </button>
                  ) : col.label}
                </th>
              ))}
            </tr>
          </thead>

          {filasPorSeccion.map(({ g, filas, plegado, inicio }) => {
            const idsEditables = filas.filter(seleccionable).map((t) => t.id_tarea)
            const marcadas = idsEditables.filter((id) => seleccion.has(id)).length
            return (
              <tbody key={g.clave}>
                {/* Encabezado del grupo: nombre y, de un vistazo, cuánto falta y qué está vencido */}
                <tr className="group/grupo">
                  <td className="sticky left-0 z-10 w-10 min-w-10 border-b border-border bg-surface px-0 pt-6 pb-2 align-bottom">
                    {idsEditables.length > 0 && (
                      <div className="flex w-10 justify-center">
                        <input type="checkbox" aria-label={`Seleccionar las tareas de ${g.titulo}`}
                          className={cn('size-4 accent-[var(--brand)]', seleccion.size === 0 && 'focus-visible:opacity-100 sm:opacity-0 sm:group-hover/grupo:opacity-100')}
                          checked={marcadas > 0 && marcadas === idsEditables.length}
                          ref={(el) => { if (el) el.indeterminate = marcadas > 0 && marcadas < idsEditables.length }}
                          onChange={(e) => alternarSeleccion(idsEditables, e.target.checked)} />
                      </div>
                    )}
                  </td>
                  <td colSpan={columnas.length} className="border-b border-border bg-surface px-3 pt-6 pb-2">
                    <EncabezadoGrupo g={g} filas={filas} plegado={plegado} onAlternar={() => alternarPlegado(g.clave)} />
                  </td>
                </tr>

                {!plegado && filas.map((t, i) => (
                  <FilaTarea key={t.id_tarea} t={t} r={inicio + i} color={g.color} celda={celda}
                    editaTodo={editaTodo(t)} mueve={mueve(t)} seleccionable={seleccionable(t)} conResponsable={!!p} conReales={conReales} casillasVisibles={seleccion.size > 0}
                    seleccionada={seleccion.has(t.id_tarea)} onSeleccionar={(v) => alternarSeleccion([t.id_tarea], v)}
                    guardando={!!enVuelo[t.id_tarea]} resaltada={resaltada === t.id_tarea} personas={personas} pInicio={pInicio} pFin={pFin}
                    onAbrir={() => onAbrir(t)} onTitulo={(v) => v.trim() && v.trim() !== t.titulo && guardar(t, { titulo: v.trim() }, { titulo: v.trim() })}
                    onResponsable={(id) => id !== t.id_usuario && guardar(t, { id_usuario: id }, { id_usuario: id, nombre_usuario: usuarios.get(id)?.nombre ?? t.nombre_usuario })}
                    onEstado={(e) => cambiarEstado(t, e)} onFecha={(campo, v) => cambiarFecha(t, campo, v)} onHoras={(campo, v) => cambiarHoras(t, campo, v)} />
                ))}

                {!plegado && g.agregar && proyecto?.gestiona && !proyecto.cerrado && (
                  <FilaNueva titulo={g.titulo} onCrear={(titulo) => agregar(g, titulo)}
                    responsable={usuarios.get(responsablePorDefecto() ?? 0)?.nombre} autoFocus={sinTareas && g === grupos.find((x) => x.agregar)} />
                )}
              </tbody>
            )
          })}
        </table>
        {secciones.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {filtrando ? 'Ninguna tarea coincide con la búsqueda o los filtros.' : 'Sin tareas en esta vista.'}
          </p>
        )}
      </div>

      {seleccion.size > 0 && (
        <BarraSeleccion ids={[...seleccion]} tareas={visibles} personas={p ? personas : []} grupos={p && !p.es_conjunto ? grupos : []}
          eliminar={!!p}
          onLimpiar={() => setSeleccion(new Set())}
          ejecutar={async (accion, lista) => {
            let ok = 0
            const errores: string[] = []
            for (const t of lista) {
              try {
                if (accion.tipo === 'eliminar') await del.mutateAsync(t.id_tarea)
                else if (accion.tipo === 'estado' && accion.valor !== 'Pendiente' && t.bloqueada) {
                  errores.push(`“${t.titulo}” espera a sus dependencias`); continue
                } else if (accion.tipo === 'estado') await update.mutateAsync({ id_tarea: t.id_tarea, estado: accion.valor })
                else if (accion.tipo === 'responsable') await update.mutateAsync({ id_tarea: t.id_tarea, id_usuario: accion.valor })
                else await update.mutateAsync({ id_tarea: t.id_tarea, id_etapa: accion.valor })
                ok++
              } catch (e) {
                errores.push(e instanceof ApiError ? `“${t.titulo}”: ${e.message}` : `“${t.titulo}”: error`)
              }
            }
            const verbo = accion.tipo === 'eliminar' ? 'eliminada(s)' : 'actualizada(s)'
            if (errores.length === 0) toast.success(`${ok} tarea(s) ${verbo}`)
            else toast.error(`${ok} de ${lista.length} ${verbo}. ${errores[0]}${errores.length > 1 ? ` (y ${errores.length - 1} más)` : ''}`)
            setSeleccion(new Set())
          }} />
      )}

      {retraso && (
        <MotivoRetrasoModal t={retraso.t} fecha={retraso.fecha} onClose={() => setRetraso(null)}
          onConfirmar={(motivo, idBloqueo) => {
            guardar(retraso.t, { fecha_fin: retraso.fecha, motivo_cambio: motivo, id_bloqueo_causa: idBloqueo }, { fecha_fin: retraso.fecha })
            setRetraso(null)
          }} />
      )}
    </div>
  )
}

function Interruptor({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={activo} onClick={onClick}
      className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        activo ? 'border-brand bg-brand-soft text-brand' : 'border-border text-muted hover:text-fg')}>
      {children}
    </button>
  )
}

type Celda = (r: number, c: number) => { 'data-r': number; 'data-c': number; tabIndex: number; onFocus: () => void }

function FilaTarea({
  t, r, color, celda, editaTodo, mueve, seleccionable, conResponsable, conReales, casillasVisibles, seleccionada, onSeleccionar, guardando, resaltada, personas, pInicio, pFin,
  onAbrir, onTitulo, onResponsable, onEstado, onFecha, onHoras,
}: {
  t: Tarea; r: number; color: string; celda: Celda; editaTodo: boolean; mueve: boolean; seleccionable: boolean
  /** En un proyecto: columna de responsable; si no, de dónde viene la tarea. */
  conResponsable: boolean; seleccionada: boolean
  /** Hay alguna seleccionada: las casillas se ven siempre (si no, al pasar el cursor). */
  casillasVisibles: boolean
  conReales: boolean
  onSeleccionar: (v: boolean) => void; guardando: boolean; resaltada: boolean; personas: { id: number; nombre: string }[]
  pInicio: string | null; pFin: string | null
  onAbrir: () => void; onTitulo: (v: string) => void; onResponsable: (id: number) => void; onEstado: (e: EstadoTarea) => void
  onFecha: (campo: 'fecha_inicio' | 'fecha_fin', v: string) => void; onHoras: (campo: 'horas_asignadas' | 'horas_reales', v: string) => void
}) {
  const finalizada = t.estado === 'Finalizado'
  const vencida = !finalizada && t.fecha_fin < todayISO()
  const espera = dependenciasPendientes(t)
  const reportado = t.bloqueo_abierto && !t.bloqueo_abierto.automatico ? t.bloqueo_abierto : null
  // Las celdas fijas (selección y título) necesitan fondo propio; las demás toman el de la fila.
  const fondo = seleccionada ? 'bg-brand-soft' : resaltada ? 'bg-ok-soft' : 'bg-surface group-hover/fila:bg-surface-2'

  const opcionesPersonas: Opcion<number>[] = personas.map((p) => ({
    valor: p.id, label: p.nombre,
    contenido: <span className="flex items-center gap-2"><Avatar name={p.nombre} className="size-5 text-[9px]" /><span className="truncate">{p.nombre}</span></span>,
  }))
  if (!personas.some((p) => p.id === t.id_usuario)) {
    opcionesPersonas.unshift({ valor: t.id_usuario, label: t.nombre_usuario, ayuda: 'Ya no está asignada al proyecto' })
  }

  return (
    <tr className={cn('group/fila transition-colors', seleccionada ? 'bg-brand-soft' : resaltada ? 'bg-ok-soft' : 'hover:bg-surface-2', guardando && 'opacity-70')}>
      <td className={cn('sticky left-0 z-10 w-10 min-w-10 border-b border-border/60 px-0 transition-colors', fondo)}>
        <div className="flex h-11 w-10 items-center justify-center" style={{ boxShadow: `inset 3px 0 0 ${color}` }}>
          {seleccionable && (
            <input type="checkbox" {...celda(r, 0)} checked={seleccionada}
              className={cn('size-4 accent-[var(--brand)]', !casillasVisibles && 'focus-visible:opacity-100 sm:opacity-0 sm:group-hover/fila:opacity-100')}
              aria-label={`Seleccionar “${t.titulo}”`} onChange={(e) => onSeleccionar(e.target.checked)} />
          )}
        </div>
      </td>

      {/* Tarea */}
      <td className={cn('sticky left-10 z-10 border-b border-border/60 p-0 transition-colors', fondo)}>
        <div className="flex h-11 items-center gap-1 pr-1">
          <div className="min-w-0 flex-1">
            <CeldaTexto r={r} c={1} celda={celda} editable={editaTodo} valor={t.titulo} etiqueta="Título" maxLength={200}
              onGuardar={onTitulo} onActivarSoloLectura={onAbrir}
              mostrar={<span className={cn('block truncate font-medium', finalizada && 'text-muted line-through')}>{t.titulo}</span>} />
          </div>
          {reportado && (
            <span title={`Bloqueada: ${reportado.causa_raiz}${reportado.descripcion ? ` · ${reportado.descripcion}` : ''}`} className="shrink-0 text-danger">
              <AlertOctagon className="size-4" aria-label="Bloqueada" />
            </span>
          )}
          {espera.length > 0 && !finalizada && (
            <span title={`Espera a ${espera.map((d) => nombreRelacionada(d, t)).join(', ')}`} className="shrink-0 text-muted">
              <Lock className="size-3.5" aria-label="Espera a otras tareas" />
            </span>
          )}
          {t.num_comentarios > 0 && (
            <button type="button" tabIndex={-1} onClick={onAbrir} className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 text-xs text-muted hover:text-brand"
              aria-label={`${t.num_comentarios} comentario(s)`}>
              <MessageSquare className="size-3.5" aria-hidden />{t.num_comentarios}
            </button>
          )}
          <button type="button" onClick={onAbrir} aria-label={`Abrir “${t.titulo}”`} title="Abrir detalle, historial y comentarios"
            className="shrink-0 rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-brand focus-visible:opacity-100 sm:opacity-0 sm:group-hover/fila:opacity-100">
            <Maximize2 className="size-3.5" aria-hidden />
          </button>
        </div>
      </td>

      {/* Responsable (o, en Mis tareas, de dónde viene) */}
      <td className="border-b border-border/60 p-0">
        {conResponsable ? <CeldaMenu r={r} c={2} celda={celda} editable={editaTodo} etiqueta="Responsable" opciones={opcionesPersonas} actual={t.id_usuario}
          onElegir={onResponsable} buscar={personas.length > 6} ancho={260}
          mostrar={<span className="flex max-w-56 min-w-0 items-center gap-2"><Avatar name={t.nombre_usuario} className="size-6 text-[10px]" /><span className="truncate text-[13px]">{t.nombre_usuario}</span></span>} />
          : <CeldaOrigen t={t} r={r} c={2} celda={celda} />}
      </td>

      {/* Estado */}
      <td className="border-b border-border/60 p-0">
        <CeldaMenu r={r} c={3} celda={celda} editable={mueve} etiqueta="Estado" ancho={200}
          opciones={ESTADOS_TAREA.map((e) => ({
            valor: e, label: e, deshabilitada: e !== 'Pendiente' && t.bloqueada && t.estado === 'Pendiente',
            ayuda: e !== 'Pendiente' && t.bloqueada && t.estado === 'Pendiente' ? 'Espera a sus dependencias' : undefined,
            contenido: <PildoraEstado estado={e} />,
          }))}
          actual={t.estado} onElegir={onEstado}
          mostrar={<PildoraEstado estado={t.estado} />} />
      </td>

      {/* Fechas */}
      <td className="border-b border-border/60 p-0">
        <CeldaTexto r={r} c={4} celda={celda} editable={editaTodo} tipo="date" valor={t.fecha_inicio} etiqueta="Inicio"
          min={pInicio ?? undefined} max={t.fecha_fin} onGuardar={(v) => onFecha('fecha_inicio', v)}
          mostrar={<span className="text-[13px] whitespace-nowrap text-muted tabular-nums">{fechaCorta(t.fecha_inicio)}</span>} />
      </td>
      <td className="border-b border-border/60 p-0">
        <CeldaTexto r={r} c={5} celda={celda} editable={editaTodo} tipo="date" valor={t.fecha_fin} etiqueta="Fecha límite"
          min={t.fecha_inicio} max={pFin ?? undefined} onGuardar={(v) => onFecha('fecha_fin', v)}
          mostrar={
            <span className="flex items-center gap-1.5 whitespace-nowrap tabular-nums" title={t.fecha_fin_base && t.fecha_fin_base !== t.fecha_fin ? `Plan original: ${formatDate(t.fecha_fin_base)}` : undefined}>
              <span className={cn(vencida && 'font-medium text-danger')}>{fechaCorta(t.fecha_fin)}</span>
              {vencida && <span className="rounded bg-danger-soft px-1 text-[11px] font-medium text-danger">Vencida</span>}
              {!vencida && (t.desfase_dias ?? 0) > 0 && <span className="rounded bg-danger-soft px-1 text-[11px] font-medium text-danger">{formatDesfase(t.desfase_dias)}</span>}
            </span>
          } />
      </td>

      {/* Horas */}
      <td className="border-b border-border/60 p-0">
        <CeldaTexto r={r} c={6} celda={celda} editable={editaTodo} tipo="number" valor={String(num(t.horas_asignadas))} etiqueta="Horas asignadas"
          derecha onGuardar={(v) => onHoras('horas_asignadas', v)}
          mostrar={num(t.horas_asignadas) === 0 ? null : <span className="text-[13px] tabular-nums">{formatHours(t.horas_asignadas)}</span>} />
      </td>
      {conReales && <td className="border-b border-border/60 p-0">
        <CeldaTexto r={r} c={7} celda={celda} editable={mueve && finalizada} tipo="number" valor={t.horas_reales == null ? '' : String(num(t.horas_reales))}
          etiqueta="Horas reales" derecha onGuardar={(v) => onHoras('horas_reales', v)}
          titulo={!finalizada ? 'Se registran al finalizar la tarea' : undefined}
          mostrar={t.horas_reales != null
            ? <span className={cn('text-[13px] tabular-nums', num(t.horas_reales) > num(t.horas_asignadas) && num(t.horas_asignadas) > 0 ? 'text-danger' : 'text-muted')}>{formatHours(t.horas_reales)}</span>
            : finalizada && mueve ? <span className="text-xs font-medium text-brand">Registrar</span> : null} />
      </td>}
    </tr>
  )
}

/** De dónde viene la tarea: su proyecto y etapa (enlace) o, si es recurrente, su frecuencia y periodo. */
function CeldaOrigen({ t, r, c, celda }: { t: Tarea; r: number; c: number; celda: Celda }) {
  if (t.id_proyecto == null) {
    return (
      <div {...celda(r, c)} role="gridcell" className="flex h-11 items-center gap-2 px-3 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset focus-visible:outline-none">
        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-info-soft px-1.5 py-px text-xs font-medium text-info"><Repeat className="size-3" aria-hidden />{t.frecuencia}</span>
        <span className="truncate text-xs text-muted">{textoPeriodo(t)}</span>
      </div>
    )
  }
  return (
    <Link {...celda(r, c)} role="gridcell" to={`/proyectos/${t.id_proyecto}?tarea=${t.id_tarea}`} title={origenTarea(t)}
      className="flex h-11 max-w-60 flex-col justify-center px-3 leading-tight hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset focus-visible:outline-none">
      <span className="truncate text-[13px] font-medium">{t.nombre_proyecto}</span>
      <span className="truncate text-xs text-muted">{t.orden_etapa != null ? `${t.orden_etapa}. ${t.nombre_etapa}` : 'General'}</span>
    </Link>
  )
}

/** Celda que muestra un valor y, al activarla (clic o Enter), lo edita en su lugar. Enter o salir del campo guarda;
 * Escape cancela. */
function CeldaTexto({ r, c, celda, editable, valor, mostrar, onGuardar, etiqueta, tipo = 'text', min, max, maxLength, derecha, titulo, onActivarSoloLectura }: {
  r: number; c: number; celda: Celda; editable: boolean; valor: string; mostrar: ReactNode; onGuardar: (v: string) => void; etiqueta: string
  tipo?: 'text' | 'number' | 'date'; min?: string; max?: string; maxLength?: number; derecha?: boolean; titulo?: string
  /** Si no es editable, qué hacer al activarla (p. ej. abrir el detalle). */
  onActivarSoloLectura?: () => void
}) {
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState(valor)
  const boton = useRef<HTMLButtonElement>(null)
  const cancelado = useRef(false)
  // Al empezar a editar tecleando, el cursor va al final (no se selecciona lo escrito).
  const porTecla = useRef(false)

  const abrir = () => { setBorrador(valor); cancelado.current = false; porTecla.current = false; setEditando(true) }
  const cerrar = (guardar: boolean, devolverFoco: boolean) => {
    if (guardar && !cancelado.current && borrador !== valor) onGuardar(borrador)
    setEditando(false)
    if (devolverFoco) requestAnimationFrame(() => boton.current?.focus())
  }

  const base = cn('flex h-11 w-full items-center px-3 text-left outline-none', derecha && 'justify-end text-right')
  if (editando) {
    return (
      <input autoFocus type={tipo} value={borrador} min={min} max={max} maxLength={maxLength} step={tipo === 'number' ? '0.5' : undefined}
        inputMode={tipo === 'number' ? 'decimal' : undefined} aria-label={etiqueta}
        onChange={(e) => setBorrador(e.target.value)} onFocus={(e) => {
          if (tipo === 'date') return
          if (porTecla.current) { const n = e.target.value.length; if (tipo === 'text') e.target.setSelectionRange(n, n) }
          else e.target.select()
        }}
        onBlur={() => cerrar(true, false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); cerrar(true, true) }
          else if (e.key === 'Escape') { e.preventDefault(); cancelado.current = true; cerrar(false, true) }
        }}
        className={cn('h-11 w-full rounded-none border-0 bg-surface px-3 text-sm ring-2 ring-brand ring-inset outline-none', derecha && 'text-right')} />
    )
  }
  if (!editable) {
    return (
      <div {...celda(r, c)} role="gridcell" aria-readonly title={titulo}
        onKeyDown={(e) => { if (onActivarSoloLectura && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onActivarSoloLectura() } }}
        onClick={onActivarSoloLectura}
        className={cn(base, 'focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset', onActivarSoloLectura && 'cursor-pointer hover:text-brand')}>
        {mostrar}
      </div>
    )
  }
  return (
    <button ref={boton} type="button" {...celda(r, c)} role="gridcell" aria-label={`${etiqueta}: ${valor || 'vacío'}. Enter para editar`} title={titulo}
      onClick={abrir}
      onKeyDown={(e) => {
        if (e.key === 'F2') { e.preventDefault(); abrir() }
        // Escribir sobre una celda de texto empieza a editarla con esa tecla, como en una hoja de cálculo.
        else if (tipo !== 'date' && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' ') {
          e.preventDefault(); setBorrador(e.key); cancelado.current = false; porTecla.current = true; setEditando(true)
        }
      }}
      className={cn(base, 'cursor-text hover:ring-1 hover:ring-border-strong hover:ring-inset focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset')}>
      {mostrar}
    </button>
  )
}

/** Celda que abre una lista de opciones. */
function CeldaMenu<T>({ r, c, celda, editable, etiqueta, opciones, actual, onElegir, mostrar, buscar, ancho }: {
  r: number; c: number; celda: Celda; editable: boolean; etiqueta: string; opciones: Opcion<T>[]; actual: T; onElegir: (v: T) => void
  mostrar: ReactNode; buscar?: boolean; ancho?: number
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const cerrar = useCallback(() => setAnchor(null), [])
  const clase = 'flex h-11 w-full items-center px-3 text-left outline-none'
  if (!editable) {
    return <div {...celda(r, c)} role="gridcell" aria-readonly className={cn(clase, 'focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset')}>{mostrar}</div>
  }
  return (
    <>
      <button type="button" {...celda(r, c)} role="gridcell" aria-haspopup="listbox" aria-expanded={!!anchor} aria-label={`${etiqueta}: ${opciones.find((o) => o.valor === actual)?.label ?? ''}. Enter para cambiar`}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        className={cn(clase, 'cursor-pointer hover:ring-1 hover:ring-border-strong hover:ring-inset focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset')}>
        {mostrar}
      </button>
      {anchor && <MenuOpciones anchor={anchor} opciones={opciones} actual={actual} onElegir={onElegir} onClose={cerrar} label={etiqueta} buscar={buscar} width={ancho} />}
    </>
  )
}

/** Nombre del grupo (pliega/despliega) con su avance y, solo si las hay, las vencidas: lo que pide atención. */
function EncabezadoGrupo({ g, filas, plegado, onAlternar }: { g: GrupoTabla; filas: Tarea[]; plegado: boolean; onAlternar: () => void }) {
  const finalizadas = filas.filter((t) => t.estado === 'Finalizado').length
  const vencidas = filas.filter((t) => t.estado !== 'Finalizado' && t.fecha_fin < todayISO()).length
  const bloqueadas = filas.filter((t) => t.bloqueo_abierto && !t.bloqueo_abierto.automatico).length
  const horas = filas.reduce((s, t) => s + num(t.horas_asignadas), 0)
  const pct = filas.length ? Math.round((finalizadas / filas.length) * 100) : 0
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <button type="button" onClick={onAlternar} aria-expanded={!plegado}
        className="inline-flex items-center gap-2 rounded-md text-left focus-visible:ring-4 focus-visible:ring-[var(--ring)] focus-visible:outline-none">
        {plegado ? <ChevronRight className="size-4 text-muted" aria-hidden /> : <ChevronDown className="size-4 text-muted" aria-hidden />}
        <span className="size-2.5 rounded-full" style={{ background: g.color }} aria-hidden />
        <span className="text-[15px] font-semibold text-fg">{g.titulo}</span>
        <span className="rounded-full bg-surface-2 px-2 py-px text-xs text-muted tabular-nums">{filas.length}</span>
      </button>
      {filas.length > 0 && (
        <span className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-2" title={`${finalizadas} de ${filas.length} finalizadas`}>
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <span className="block h-full rounded-full bg-ok" style={{ width: `${pct}%` }} />
            </span>
            <span className="tabular-nums">{finalizadas}/{filas.length} finalizadas</span>
          </span>
          {horas > 0 && <span className="tabular-nums">{formatHours(horas)}</span>}
          {vencidas > 0 && <span className="font-medium text-danger">{vencidas} {vencidas === 1 ? 'vencida' : 'vencidas'}</span>}
          {bloqueadas > 0 && <span className="font-medium text-danger">{bloqueadas} {bloqueadas === 1 ? 'bloqueada' : 'bloqueadas'}</span>}
        </span>
      )}
    </div>
  )
}

/** Última fila del grupo: escribir el título y Enter crea la tarea (con responsable y fecha de hoy por defecto). */
function FilaNueva({ titulo, responsable, onCrear, autoFocus }: {
  titulo: string; responsable?: string; onCrear: (titulo: string) => Promise<boolean>; autoFocus?: boolean
}) {
  const [texto, setTexto] = useState('')
  const [creando, setCreando] = useState(false)
  const [activo, setActivo] = useState(false)
  const enviar = async () => {
    const t = texto.trim()
    if (!t || creando) return
    setCreando(true)
    if (await onCrear(t)) setTexto('')
    setCreando(false)
  }
  return (
    <tr>
      <td className="sticky left-0 z-10 w-10 min-w-10 border-b border-border/60 bg-surface px-0">
        <div className="flex h-10 w-10 items-center justify-center">
          {creando && <Loader2 className="size-4 animate-spin text-muted" aria-hidden />}
        </div>
      </td>
      <td colSpan={99} className="border-b border-border/60 bg-surface p-0">
        <div className="sticky left-10 flex h-10 max-w-[100vw] items-center gap-3 pr-3">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={200} autoFocus={autoFocus}
            onFocus={() => setActivo(true)} onBlur={() => setActivo(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void enviar() }
              else if (e.key === 'Escape') { setTexto(''); e.currentTarget.blur() }
            }}
            aria-label={`Agregar tarea a ${titulo}`} placeholder="+ Agregar tarea"
            className="h-10 w-full max-w-md bg-transparent px-3 text-[13px] placeholder:text-muted/80 hover:placeholder:text-fg focus:bg-surface-2/50 focus:outline-none" />
          {activo && (
            <span className="hidden shrink-0 text-xs text-muted sm:inline">
              <kbd className="rounded border border-border px-1 font-sans">Enter</kbd> para crear{responsable && <> · se asigna a {responsable}; luego ajústalo en la fila</>}
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}

type Accion =
  | { tipo: 'estado'; valor: EstadoTarea }
  | { tipo: 'responsable'; valor: number }
  | { tipo: 'etapa'; valor: number }
  | { tipo: 'eliminar' }

/** Acciones sobre varias tareas a la vez; aparece al seleccionar alguna. */
function BarraSeleccion({ ids, tareas, personas, grupos, eliminar, onLimpiar, ejecutar }: {
  ids: number[]; tareas: Tarea[]; personas: { id: number; nombre: string }[]; grupos: GrupoTabla[]
  /** Solo en la tabla de un proyecto. */
  eliminar: boolean
  onLimpiar: () => void; ejecutar: (a: Accion, lista: Tarea[]) => Promise<void>
}) {
  const [menu, setMenu] = useState<{ tipo: 'estado' | 'responsable' | 'etapa'; anchor: HTMLElement } | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const lista = tareas.filter((t) => ids.includes(t.id_tarea))
  const cerrar = useCallback(() => setMenu(null), [])

  const correr = async (a: Accion) => {
    setTrabajando(true)
    try { await ejecutar(a, lista) } finally { setTrabajando(false); setConfirmando(false) }
  }
  const boton = (tipo: 'estado' | 'responsable' | 'etapa', label: string) => (
    <Button size="sm" variant="ghost" disabled={trabajando} aria-haspopup="listbox"
      onClick={(e) => setMenu(menu?.tipo === tipo ? null : { tipo, anchor: e.currentTarget })}>
      {label} <ChevronDown className="size-3.5" aria-hidden />
    </Button>
  )

  return (
    <div role="toolbar" aria-label="Acciones para las tareas seleccionadas"
      className="animate-pop-in fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-2xl flex-wrap items-center gap-1 rounded-xl border border-border bg-surface p-2 shadow-2xl">
      <span className="flex items-center gap-2 px-2 text-sm font-medium">
        {trabajando ? <Loader2 className="size-4 animate-spin text-brand" aria-hidden />
          : <span className="flex size-6 items-center justify-center rounded-md bg-brand text-xs text-brand-fg tabular-nums">{lista.length}</span>}
        {lista.length === 1 ? 'seleccionada' : 'seleccionadas'}
      </span>
      <span className="mx-1 h-6 w-px bg-border" aria-hidden />
      {boton('estado', 'Estado')}
      {personas.length > 0 && boton('responsable', 'Responsable')}
      {grupos.length > 1 && boton('etapa', 'Etapa')}
      {eliminar && (
        <Button size="sm" variant="ghost" className="text-danger hover:text-danger" disabled={trabajando}
          icon={<Trash2 className="size-4" />} onClick={() => setConfirmando(true)}>Eliminar</Button>
      )}
      <button type="button" onClick={onLimpiar} aria-label="Quitar selección" className="ml-auto rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg">
        <X className="size-4" aria-hidden />
      </button>

      {menu?.tipo === 'estado' && (
        <MenuOpciones anchor={menu.anchor} label="Cambiar estado" onClose={cerrar} width={200}
          opciones={ESTADOS_TAREA.map((e) => ({ valor: e, label: e, contenido: <PildoraEstado estado={e} /> }))}
          onElegir={(v) => void correr({ tipo: 'estado', valor: v })} />
      )}
      {menu?.tipo === 'responsable' && (
        <MenuOpciones anchor={menu.anchor} label="Asignar a" onClose={cerrar} width={260} buscar={personas.length > 6}
          opciones={personas.map((p) => ({ valor: p.id, label: p.nombre }))} onElegir={(v) => void correr({ tipo: 'responsable', valor: v })} />
      )}
      {menu?.tipo === 'etapa' && (
        <MenuOpciones anchor={menu.anchor} label="Mover a la etapa" onClose={cerrar} width={260}
          opciones={grupos.filter((g) => g.idEtapa != null).map((g) => ({ valor: g.idEtapa!, label: g.titulo }))}
          onElegir={(v) => void correr({ tipo: 'etapa', valor: v })} />
      )}
      <ConfirmDialog open={confirmando} danger title={`Eliminar ${lista.length} tarea(s)`} confirmLabel="Eliminar" loading={trabajando}
        onClose={() => setConfirmando(false)} onConfirm={() => void correr({ tipo: 'eliminar' })}>
        <p>Se eliminarán de forma permanente:</p>
        <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5">{lista.map((t) => <li key={t.id_tarea}>{t.titulo}</li>)}</ul>
        <p className="mt-2">Sus comentarios e historial también se pierden. Esta acción no se puede deshacer.</p>
      </ConfirmDialog>
    </div>
  )
}

/** Retrasar la fecha límite pide el motivo (y el bloqueo que lo causó, si lo hay): queda como reprogramación. */
function MotivoRetrasoModal({ t, fecha, onClose, onConfirmar }: {
  t: Tarea; fecha: string; onClose: () => void; onConfirmar: (motivo: string, idBloqueo: number | null) => void
}) {
  const [motivo, setMotivo] = useState('')
  const [bloqueo, setBloqueo] = useState('')
  const [intentado, setIntentado] = useState(false)
  const bloqueos = useBloqueos({ id_tarea: t.id_tarea, limit: 50 }).data ?? []
  const confirmar = () => {
    setIntentado(true)
    if (motivo.trim()) onConfirmar(motivo.trim(), bloqueo ? Number(bloqueo) : null)
  }
  return (
    <Modal open onClose={onClose} size="sm" title="¿Por qué se retrasa?"
      description={`“${t.titulo}”: ${formatDate(t.fecha_fin)} → ${formatDate(fecha)}. Queda como reprogramación y cuenta en el desfase${t.fecha_fin_base ? ` contra el plan original (${formatDate(t.fecha_fin_base)})` : ''}.`}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={confirmar}>Guardar fecha</Button></>}>
      <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); confirmar() }}>
        <TextArea label="Motivo del retraso" required rows={3} maxLength={1000} data-autofocus value={motivo}
          onChange={(e) => setMotivo(e.target.value)} error={intentado && !motivo.trim() ? 'Indica por qué se retrasa' : undefined}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) confirmar() }} />
        {bloqueos.length > 0 && (
          <SelectField label="¿Lo causó un bloqueo?" hint="Así el desfase se atribuye a esa causa y origen." value={bloqueo} onChange={(e) => setBloqueo(e.target.value)}>
            <option value="">No</option>
            {bloqueos.map((b) => (
              <option key={b.id_bloqueo} value={b.id_bloqueo}>
                {b.causa_raiz} ({b.responsable_origen}) · {formatDate(b.fecha_inicio_bloqueo.slice(0, 10))}{b.fecha_fin_bloqueo ? '' : ' · abierto'}
              </option>
            ))}
          </SelectField>
        )}
      </form>
    </Modal>
  )
}
