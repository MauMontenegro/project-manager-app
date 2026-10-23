import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ExternalLink, History, MessageSquare, Pencil, Send, Trash2 } from 'lucide-react'
import { useActividadTarea, useComentar, useDeleteComentario, useInvolucradosTarea, useUpdateTarea } from '@/api/hooks'
import { useAuth, usePermisos } from '@/auth/AuthProvider'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { ErrorState, FormError, Skeleton } from '@/components/ui/Feedback'
import { Avatar } from '@/components/ui/Layout'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { TextField } from '@/components/ui/Field'
import { formatDate, formatDateTime, formatHours, num } from '@/lib/format'
import { ESTADOS_FINALES, parteTarea, type EventoTarea, type Involucrado, type Tarea, type TareaRelacionada } from '@/types/api'
import { EtiquetasList } from '@/features/proyectos/Etiquetas'
import { SeguimientoTarea } from '@/features/bloqueos/SeguimientoTarea'
import { origenTarea } from './fechas'
import { MencionesInput, mencionesEnTexto } from './MencionesInput'

export const tonoEstadoTarea = { Pendiente: 'neutral', 'En progreso': 'brand', 'En revisión': 'warn', Finalizado: 'ok' } as const

/** Detalle de una tarea: datos, línea de tiempo (cambios y comentarios) y comentarios con @menciones. */
export function TareaDetalleModal({ tarea, onEditar, gestiona, irA, onClose }: {
  tarea: Tarea
  /** Si se entrega (quien gestiona el proyecto), muestra "Editar". */
  onEditar?: () => void
  /** Quien gestiona el proyecto (bloqueos y línea base); por defecto, si se entrega `onEditar`. */
  gestiona?: boolean
  /** En la vista general de un conjunto, las tareas de un subproyecto se editan en él: enlace a su tablero. */
  irA?: { to: string; label: string }
  onClose: () => void
}) {
  const actividad = useActividadTarea(tarea.id_tarea)
  const personas = useInvolucradosTarea(tarea.id_tarea)
  const { sesion } = useAuth()
  const { gestionaEquipo } = usePermisos()
  const puedeComentar = gestionaEquipo || !!personas.data?.some((p) => p.id_usuario === sesion?.id_usuario)
  // Horas reales: las registra la persona asignada o quien gestiona el proyecto, una vez finalizada.
  const puedeRegistrarHoras = tarea.estado === 'Finalizado' && !(tarea.estado_proyecto && ESTADOS_FINALES.includes(tarea.estado_proyecto)) && (
    gestionaEquipo || sesion?.id_usuario === tarea.id_usuario
    || !!personas.data?.some((p) => p.es_lider && p.id_usuario === sesion?.id_usuario)
  )

  return (
    <Modal open onClose={onClose} size="lg" title={tarea.titulo}
      description={origenTarea(tarea)}
      footer={<>
        {onEditar && <Button className="mr-auto" icon={<Pencil className="size-4" />} onClick={onEditar}>Editar</Button>}
        {irA && (
          <Link to={irA.to} className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-brand hover:bg-brand-soft">
            <ExternalLink className="size-4" aria-hidden />{irA.label}
          </Link>
        )}
        <Button onClick={onClose}>Cerrar</Button>
      </>}>
      <div className="space-y-5">
        <dl className="grid gap-3 rounded-lg border border-border bg-surface-2/50 p-3 text-sm sm:grid-cols-4">
          <Dato label="Estado"><Badge tone={tonoEstadoTarea[tarea.estado]} dot>{tarea.estado}</Badge></Dato>
          <Dato label="Responsable"><span className="flex items-center gap-1.5"><Avatar name={tarea.nombre_usuario} className="size-5 text-[9px]" />{tarea.nombre_usuario}</span></Dato>
          <Dato label="Horas">
            {formatHours(tarea.horas_asignadas)}
            {tarea.horas_reales != null && <span className="block text-xs font-normal text-muted">Reales: {formatHours(tarea.horas_reales)}</span>}
          </Dato>
          <Dato label="Fechas">{formatDate(tarea.fecha_inicio)} → {formatDate(tarea.fecha_fin)}</Dato>
        </dl>
        <EtiquetasList etiquetas={tarea.etiquetas} />
        {puedeRegistrarHoras && <HorasReales tarea={tarea} />}
        {tarea.descripcion && <p className="text-sm whitespace-pre-line">{tarea.descripcion}</p>}

        {(tarea.dependencias.length > 0 || tarea.dependientes.length > 0) && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Relacionadas titulo="Depende de" tarea={tarea} tareas={tarea.dependencias}
              nota={tarea.bloqueada ? 'No puede pasar a “En progreso” hasta que todas estén finalizadas.' : undefined} />
            <Relacionadas titulo="Bloquea a" tarea={tarea} tareas={tarea.dependientes} />
          </div>
        )}

        {tarea.id_proyecto != null && <SeguimientoTarea tarea={tarea} gestiona={gestiona ?? !!onEditar} />}

        <section aria-labelledby="actividad-titulo">
          <h3 id="actividad-titulo" className="mb-3 text-sm font-medium">Actividad</h3>
          {actividad.isPending ? <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
            : actividad.isError ? <ErrorState error={actividad.error} onRetry={() => actividad.refetch()} />
            : (
              <ol className="relative space-y-4 border-l border-border pl-5">
                {actividad.data.map((e, i) => <Evento key={`${e.tipo}-${e.id_comentario ?? i}`} e={e} />)}
                {actividad.data.length === 0 && <li className="text-sm text-muted">Sin actividad registrada.</li>}
              </ol>
            )}
        </section>

        {puedeComentar
          ? <NuevoComentario idTarea={tarea.id_tarea} personas={personas.data ?? []} />
          : <p className="text-xs text-muted">Solo las personas de la tarea pueden comentar.</p>}
      </div>
    </Modal>
  )
}

function Relacionadas({ titulo, tarea, tareas, nota }: { titulo: string; tarea: Tarea; tareas: TareaRelacionada[]; nota?: string }) {
  if (!tareas.length) return null
  return (
    <section>
      <h3 className="text-sm font-medium">{titulo}</h3>
      {nota && <p className="mt-0.5 text-xs text-warn">{nota}</p>}
      <ul className="mt-2 space-y-1.5">
        {tareas.map((t) => (
          <li key={t.id_tarea} className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate">
              {t.titulo}
              {/* De otra parte del conjunto: se indica de cuál. */}
              {t.id_proyecto !== tarea.id_proyecto && <span className="text-xs text-muted"> · {parteTarea(t)}</span>}
            </span>
            <Badge tone={tonoEstadoTarea[t.estado]} dot>{t.estado}</Badge>
          </li>
        ))}
      </ul>
    </section>
  )
}

function HorasReales({ tarea }: { tarea: Tarea }) {
  const toast = useToast()
  const update = useUpdateTarea()
  const inicial = tarea.horas_reales == null ? '' : String(num(tarea.horas_reales))
  const [valor, setValor] = useState(inicial)
  const invalido = valor !== '' && !(Number(valor) >= 0)
  const guardar = () => update.mutate(
    { id_tarea: tarea.id_tarea, horas_reales: valor === '' ? null : valor },
    { onSuccess: () => toast.success('Horas reales registradas') },
  )
  return (
    <form className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3"
      onSubmit={(e) => { e.preventDefault(); if (!invalido && valor !== inicial) guardar() }}>
      <TextField type="number" min={0} step="0.5" label="Horas reales" fieldClassName="w-40" value={valor}
        error={invalido ? 'No puede ser negativo' : undefined} onChange={(e) => setValor(e.target.value)} />
      <Button type="submit" size="sm" icon={<Check className="size-4" />} loading={update.isPending} disabled={invalido || valor === inicial}>Guardar</Button>
      <p className="basis-full text-xs text-muted">
        {tarea.horas_reales == null ? '¿Cuánto tomó realmente? ' : ''}Estimadas: {formatHours(tarea.horas_asignadas)}. Sirve para comparar lo estimado contra lo real y estimar mejor.
      </p>
      <FormError error={update.error} />
    </form>
  )
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs text-muted">{label}</dt><dd className="mt-0.5 font-medium">{children}</dd></div>
}

function Evento({ e }: { e: EventoTarea }) {
  const { sesion } = useAuth()
  const { gestionaEquipo } = usePermisos()
  const toast = useToast()
  const del = useDeleteComentario()
  const esComentario = e.tipo === 'comentario'
  const puedeBorrar = esComentario && (gestionaEquipo || (sesion?.id_usuario != null && sesion.id_usuario === e.id_actor))

  return (
    <li className="relative">
      <span className="absolute top-0.5 -left-[1.95rem] flex size-5 items-center justify-center rounded-full border border-border bg-surface text-muted" aria-hidden>
        {esComentario ? <MessageSquare className="size-3" /> : <History className="size-3" />}
      </span>
      <p className="text-xs text-muted">
        <span className="font-medium text-fg">{e.actor_nombre}</span> · {formatDateTime(e.fecha)}
        {!esComentario && e.accion === 'movimiento' && ' · movió la tarea'}
      </p>
      {esComentario ? (
        <div className="mt-1 flex items-start gap-2">
          <p className="flex-1 rounded-lg bg-surface-2 px-3 py-2 text-sm whitespace-pre-line">{conMenciones(e.texto ?? '', e.menciones)}</p>
          {puedeBorrar && (
            <IconButton label="Borrar comentario" className="size-7" disabled={del.isPending}
              onClick={() => del.mutate(e.id_comentario!, { onSuccess: () => toast.success('Comentario borrado') })}>
              <Trash2 className="size-3.5" />
            </IconButton>
          )}
        </div>
      ) : (
        <p className="mt-0.5 text-sm">{e.resumen}</p>
      )}
    </li>
  )
}

/** Resalta los @Nombre de las personas mencionadas. */
function conMenciones(texto: string, menciones: EventoTarea['menciones']) {
  if (!menciones.length) return texto
  const nombres = menciones.map((m) => m.nombre).sort((a, b) => b.length - a.length)
  const patron = new RegExp(`(@(?:${nombres.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`, 'g')
  return texto.split(patron).map((parte, i) =>
    i % 2 === 1 ? <span key={i} className="rounded bg-brand-soft px-1 font-medium text-brand">{parte}</span> : <Fragment key={i}>{parte}</Fragment>,
  )
}

function NuevoComentario({ idTarea, personas }: { idTarea: number; personas: Involucrado[] }) {
  const toast = useToast()
  const comentar = useComentar(idTarea)
  const [texto, setTexto] = useState('')
  const [elegidas, setElegidas] = useState(new Map<number, string>())

  const enviar = () => {
    if (!texto.trim() || comentar.isPending) return
    const menciones = mencionesEnTexto(texto, elegidas)
    comentar.mutate({ texto: texto.trim(), menciones }, {
      onSuccess: () => {
        setTexto(''); setElegidas(new Map())
        if (menciones.length) toast.success(`Comentario enviado · se notificó a ${menciones.length} persona(s)`)
      },
    })
  }

  return (
    <div className="space-y-2">
      <MencionesInput value={texto} onChange={setTexto} personas={personas} elegidas={elegidas}
        onElegir={(p) => setElegidas((m) => new Map(m).set(p.id_usuario, p.nombre))} onEnviar={enviar}
        disabled={comentar.isPending} placeholder="Escribe un comentario… usa @ para mencionar a alguien del proyecto" />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">Ctrl/⌘ + Enter para enviar. Las personas mencionadas reciben un aviso.</p>
        <Button size="sm" variant="primary" icon={<Send className="size-4" />} loading={comentar.isPending}
          disabled={!texto.trim()} onClick={enviar}>Comentar</Button>
      </div>
      <FormError error={comentar.error} />
    </div>
  )
}
