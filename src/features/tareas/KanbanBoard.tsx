import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertOctagon, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Lock, MessageSquare, Pencil, Repeat } from 'lucide-react'
import { useUpdateTarea } from '@/api/hooks'
import { IconButton } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Layout'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { formatDate, formatHours, todayISO } from '@/lib/format'
import { ApiError } from '@/lib/http'
import { ESTADOS_TAREA, parteTarea, type EstadoTarea, type Tarea, type TareaRelacionada } from '@/types/api'
import { EtiquetasList } from '@/features/proyectos/Etiquetas'
import { formatDesfase, formatDiasHabiles } from '@/features/bloqueos/tiempo'
import { puntoEstado, textoPeriodo } from './fechas'

/** Dependencias sin terminar (la tarea no puede salir de Pendiente mientras haya alguna). */
export const dependenciasPendientes = (t: Tarea) => t.dependencias.filter((d) => d.estado !== 'Finalizado')

/** “Título”, con su departamento (o "General") si es de otra parte del proyecto conjunto. */
export const nombreRelacionada = (d: TareaRelacionada, t: Pick<Tarea, 'id_proyecto'>) =>
  d.id_proyecto !== t.id_proyecto ? `“${d.titulo}” (${parteTarea(d)})` : `“${d.titulo}”`


/** Kanban de tareas. Las tarjetas se arrastran entre columnas o se mueven con los botones (teclado).
 * `puedeMover`: la persona asignada o quien gestiona el proyecto. */
export function KanbanBoard({ tareas, puedeMover, onEditar, puedeEditar, onAbrir, mostrarProyecto, mostrarParte }: {
  tareas: Tarea[]
  puedeMover: (t: Tarea) => boolean
  onEditar?: (t: Tarea) => void
  /** Con `onEditar`: en qué tarjetas mostrar "Editar" (por defecto, en todas). */
  puedeEditar?: (t: Tarea) => boolean
  /** Abre el detalle (historial y comentarios). */
  onAbrir: (t: Tarea) => void
  /** En "Mis tareas": muestra proyecto y etapa en vez de la persona. */
  mostrarProyecto?: boolean
  /** En la vista general de un conjunto: muestra el departamento (o "General") y la etapa de cada tarea. */
  mostrarParte?: boolean
}) {
  const toast = useToast()
  const update = useUpdateTarea()
  // Movimiento optimista: la tarjeta cambia de columna antes de que responda la API.
  const [pendientes, setPendientes] = useState<Record<number, EstadoTarea>>({})
  const [arrastrando, setArrastrando] = useState<number | null>(null)
  const [sobre, setSobre] = useState<EstadoTarea | null>(null)

  const estadoDe = (t: Tarea) => pendientes[t.id_tarea] ?? t.estado

  const mover = (t: Tarea, estado: EstadoTarea) => {
    if (estadoDe(t) === estado || !puedeMover(t)) return
    if (estado !== 'Pendiente' && t.bloqueada) {
      const lista = dependenciasPendientes(t).map((d) => nombreRelacionada(d, t)).join(', ')
      toast.error(`“${t.titulo}” depende de ${lista}: termínala(s) primero`)
      return
    }
    setPendientes((p) => ({ ...p, [t.id_tarea]: estado }))
    const limpiar = () => setPendientes(({ [t.id_tarea]: _, ...resto }) => resto)
    update.mutate({ id_tarea: t.id_tarea, estado }, {
      onSuccess: () => { if (estado === 'Finalizado') toast.success(`“${t.titulo}” finalizada · abre la tarea para registrar sus horas reales`) },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo mover la tarea'),
      onSettled: limpiar,
    })
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {ESTADOS_TAREA.map((col) => {
        const lista = tareas.filter((t) => estadoDe(t) === col)
        return (
          <section
            key={col} aria-label={`${col}: ${lista.length} tareas`}
            onDragOver={(e) => { if (arrastrando !== null) { e.preventDefault(); setSobre(col) } }}
            onDragLeave={() => setSobre((s) => (s === col ? null : s))}
            onDrop={(e) => {
              e.preventDefault(); setSobre(null)
              const t = tareas.find((x) => x.id_tarea === arrastrando)
              if (t) mover(t, col)
            }}
            className={cn('flex min-h-40 flex-col rounded-xl border border-border bg-surface-2/40 transition-colors',
              sobre === col && 'border-brand bg-brand-soft/40')}
          >
            <header className="flex items-center gap-2 px-3 py-2.5">
              <span className={cn('size-2 rounded-full', puntoEstado[col])} aria-hidden />
              <h3 className="text-sm font-medium">{col}</h3>
              <span className="ml-auto text-xs text-muted tabular-nums">{lista.length}</span>
            </header>
            <ol className="flex flex-1 flex-col gap-2 px-2 pb-2">
              {lista.map((t) => (
                <TareaCard
                  key={t.id_tarea} t={t} estado={estadoDe(t)} movible={puedeMover(t)} mostrarProyecto={mostrarProyecto} mostrarParte={mostrarParte}
                  onMover={(e) => mover(t, e)} onEditar={onEditar && (!puedeEditar || puedeEditar(t)) ? () => onEditar(t) : undefined} onAbrir={() => onAbrir(t)}
                  onDragStart={() => setArrastrando(t.id_tarea)} onDragEnd={() => { setArrastrando(null); setSobre(null) }}
                />
              ))}
              {lista.length === 0 && <li className="px-2 py-6 text-center text-xs text-muted">Sin tareas</li>}
            </ol>
          </section>
        )
      })}
    </div>
  )
}

function TareaCard({ t, estado, movible, mostrarProyecto, mostrarParte, onMover, onEditar, onAbrir, onDragStart, onDragEnd }: {
  t: Tarea; estado: EstadoTarea; movible: boolean; mostrarProyecto?: boolean; mostrarParte?: boolean
  onMover: (e: EstadoTarea) => void; onEditar?: () => void; onAbrir: () => void; onDragStart: () => void; onDragEnd: () => void
}) {
  const i = ESTADOS_TAREA.indexOf(estado)
  const finalizada = estado === 'Finalizado'
  const vencida = !finalizada && !!t.fecha_fin && t.fecha_fin < todayISO()
  const espera = dependenciasPendientes(t)
  // Bloqueada: solo puede quedarse en Pendiente hasta que terminen sus dependencias.
  const bloqueada = t.bloqueada && estado === 'Pendiente'
  // Bloqueo reportado (las esperas por dependencias ya se muestran en "Espera a").
  const reportado = t.bloqueo_abierto && !t.bloqueo_abierto.automatico ? t.bloqueo_abierto : null
  const esperaDias = t.bloqueo_abierto?.automatico ? t.bloqueo_abierto.dias : null

  return (
    <li
      draggable={movible}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragEnd={onDragEnd}
      className={cn('rounded-lg border bg-surface p-3 shadow-sm', reportado ? 'border-danger/50 border-l-4 border-l-danger' : 'border-border',
        movible && 'cursor-grab active:cursor-grabbing', estado !== t.estado && 'opacity-60')}
    >
      <div className="flex items-start gap-2">
        <button type="button" onClick={onAbrir} title="Ver historial y comentarios"
          className={cn('flex-1 text-left text-sm font-medium hover:text-brand hover:underline', finalizada && 'text-muted line-through')}>
          {t.titulo}
        </button>
        {onEditar && <IconButton label={`Editar “${t.titulo}”`} className="-m-1.5 size-7" onClick={onEditar}><Pencil className="size-3.5" /></IconButton>}
      </div>
      {t.descripcion && <p className="mt-1 line-clamp-2 text-xs text-muted">{t.descripcion}</p>}
      {reportado && (
        <button type="button" onClick={onAbrir} title={reportado.descripcion ?? undefined}
          className="mt-2 flex w-full items-start gap-1.5 rounded-md bg-danger-soft px-2 py-1 text-left text-xs text-danger">
          <AlertOctagon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span><strong className="font-semibold">Bloqueada · {formatDiasHabiles(reportado.dias, true)}</strong> · {reportado.causa_raiz}</span>
        </button>
      )}
      {espera.length > 0 && !finalizada && (
        <p className="mt-2 flex items-start gap-1.5 rounded-md bg-warn-soft px-2 py-1 text-xs text-warn">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Espera a {espera.map((d) => nombreRelacionada(d, t)).join(', ')}
            {esperaDias != null && Number(esperaDias) > 0 && <strong className="font-semibold"> · {formatDiasHabiles(esperaDias, true)}</strong>}
          </span>
        </p>
      )}

      {mostrarProyecto && t.id_proyecto != null ? (
        <p className="mt-2 text-xs">
          <Link to={`/proyectos/${t.id_proyecto}`} className="font-medium hover:text-brand hover:underline">{t.nombre_proyecto}</Link>
          <span className="text-muted"> · {t.orden_etapa != null ? `${t.orden_etapa}. ${t.nombre_etapa}` : 'General'}</span>
        </p>
      ) : t.id_recurrente != null ? (
        <div className="mt-2 space-y-1.5 text-xs">
          <p className="flex flex-wrap items-center gap-1.5 text-muted">
            <span className="inline-flex items-center gap-1 rounded bg-info-soft px-1.5 py-px font-medium text-info"><Repeat className="size-3" aria-hidden />{t.frecuencia}</span>
            {textoPeriodo(t)}
            {!mostrarProyecto && <span className="inline-flex items-center gap-1">· <Avatar name={t.nombre_usuario} className="size-4 text-[8px]" />{t.nombre_usuario}</span>}
          </p>
          <EtiquetasList etiquetas={t.etiquetas} />
        </div>
      ) : (
        <>
          {mostrarParte && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <span className={cn('rounded px-1.5 py-px font-medium', t.departamento ? 'bg-surface-2 text-fg' : 'bg-brand-soft text-brand')}>{parteTarea(t)}</span>
              {t.orden_etapa != null && <span>{t.orden_etapa}. {t.nombre_etapa}</span>}
            </p>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><Avatar name={t.nombre_usuario} className="size-5 text-[9px]" />{t.nombre_usuario}</p>
        </>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted tabular-nums">
        <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{formatHours(t.horas_asignadas)}</span>
        {t.num_comentarios > 0 && (
          <button type="button" onClick={onAbrir} className="inline-flex items-center gap-1 hover:text-brand"
            aria-label={`${t.num_comentarios} comentario(s)`}>
            <MessageSquare className="size-3.5" aria-hidden />{t.num_comentarios}
          </button>
        )}
        {(t.fecha_inicio || t.fecha_fin) && (
          <span className={cn('inline-flex items-center gap-1', vencida && 'font-medium text-danger')}>
            <CalendarDays className="size-3.5" aria-hidden />
            {t.fecha_inicio ? `${formatDate(t.fecha_inicio)} – ` : 'Vence '}{formatDate(t.fecha_fin)}{vencida && ' · vencida'}
          </span>
        )}
        {(t.desfase_dias ?? 0) > 0 && (
          <span className="font-medium text-danger" title={`Fecha límite original: ${formatDate(t.fecha_fin_base)} · desfase en días hábiles`}>
            {formatDesfase(t.desfase_dias)} vs. plan
          </span>
        )}
      </div>

      {movible && (
        <div className="mt-2 flex items-center gap-1 border-t border-border pt-2">
          <IconButton label={`Mover a ${ESTADOS_TAREA[i - 1] ?? ''}`} className="size-7" disabled={i === 0} onClick={() => onMover(ESTADOS_TAREA[i - 1])}>
            <ChevronLeft className="size-4" />
          </IconButton>
          <IconButton label={`Mover a ${ESTADOS_TAREA[i + 1] ?? ''}`} className="size-7" disabled={finalizada || bloqueada} onClick={() => onMover(ESTADOS_TAREA[i + 1])}>
            <ChevronRight className="size-4" />
          </IconButton>
          {!finalizada && !bloqueada && (
            <button type="button" onClick={() => onMover('Finalizado')}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ok hover:bg-ok-soft">
              <CheckCircle2 className="size-3.5" aria-hidden /> Terminar
            </button>
          )}
        </div>
      )}
    </li>
  )
}
