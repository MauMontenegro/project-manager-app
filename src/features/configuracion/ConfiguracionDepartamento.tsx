import { useEffect, useState } from 'react'
import { AlertCircle, ArrowDown, ArrowUp, Check, ChevronRight, Layers, Pencil, Plus, Tag, Trash2, X } from 'lucide-react'
import {
  useActualizarEtiqueta, useCrearEtiqueta, useEliminarEtiqueta, useEtiquetas, useGuardarPlantillaEtapas,
  usePlantillaEtapas,
} from '@/api/hooks'
import { Button, IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TextField } from '@/components/ui/Field'
import { EmptyState, ErrorState, FormError, Skeleton } from '@/components/ui/Feedback'
import { Card, CardHeader } from '@/components/ui/Layout'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { COLORES_ETIQUETA, EtiquetaChip } from '@/features/proyectos/Etiquetas'
import {
  ESTADOS_OPCIONALES_ETAPA, type DepartamentoProyecto, type EstadoProyecto, type Etiqueta, type PlantillaEtapa,
} from '@/types/api'

const MAX_ETAPAS = 12

/** Etapas y etiquetas de un departamento. Las edita su Gerente o el Administrador. */
export function ConfiguracionDepartamento({ departamento, editable }: { departamento: DepartamentoProyecto; editable: boolean }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
      <EtapasEditor departamento={departamento} editable={editable} />
      <EtiquetasEditor departamento={departamento} editable={editable} />
    </div>
  )
}

// ---------- Etapas ----------
interface FilaEtapa { key: number; nombre: string; descripcion: string; estados: EstadoProyecto[] }

let siguienteKey = 0
const aFilas = (etapas: PlantillaEtapa[]): FilaEtapa[] => etapas.map((e) => ({
  key: siguienteKey++, nombre: e.nombre, descripcion: e.descripcion ?? '',
  estados: e.estados_permitidos.filter((s) => ESTADOS_OPCIONALES_ETAPA.includes(s)),
}))
const comparable = (filas: FilaEtapa[]) => JSON.stringify(filas.map(({ key: _, ...f }) => ({ ...f, nombre: f.nombre.trim(), descripcion: f.descripcion.trim() })))

/** Estatus fijos de la etapa i de n (los aplica también el backend). */
const fijos = (i: number, n: number): EstadoProyecto[] => [...(i === 0 ? ['Sin Iniciar' as const] : []), 'Activo', ...(i === n - 1 ? ['Completado' as const] : [])]

function EtapasEditor({ departamento, editable }: { departamento: DepartamentoProyecto; editable: boolean }) {
  const toast = useToast()
  const q = usePlantillaEtapas(departamento)
  const guardar = useGuardarPlantillaEtapas(departamento)
  const [filas, setFilas] = useState<FilaEtapa[]>([])
  // Etapas desplegadas (por `key`): cerradas solo muestran nombre y estatus para ocupar poco espacio.
  const [abiertas, setAbiertas] = useState<Set<number>>(new Set())
  const alternar = (key: number) => setAbiertas((s) => {
    const n = new Set(s)
    if (n.has(key)) n.delete(key); else n.add(key)
    return n
  })

  useEffect(() => { if (q.data) setFilas(aFilas(q.data)) }, [q.data])

  const nombres = filas.map((f) => f.nombre.trim().toLowerCase())
  const errorNombre = (i: number) => !nombres[i] ? 'Obligatorio' : nombres.indexOf(nombres[i]) !== i ? 'Nombre repetido' : undefined
  const valido = filas.length > 0 && filas.every((_, i) => !errorNombre(i))
  const sucio = !!q.data && comparable(filas) !== comparable(aFilas(q.data))

  const cambiar = (i: number, cambio: Partial<FilaEtapa>) => setFilas((l) => l.map((f, j) => j === i ? { ...f, ...cambio } : f))
  const mover = (i: number, d: -1 | 1) => setFilas((l) => {
    const n = [...l]
    ;[n[i], n[i + d]] = [n[i + d], n[i]]
    return n
  })
  const onGuardar = () => guardar.mutate(
    filas.map((f) => ({ nombre: f.nombre.trim(), descripcion: f.descripcion.trim() || null, estados_permitidos: f.estados })),
    { onSuccess: () => toast.success(`Etapas de ${departamento} guardadas`) },
  )

  return (
    <Card className="h-fit">
      <CardHeader title="Etapas del ciclo de vida"
        subtitle="Las reciben los proyectos nuevos del departamento; los existentes conservan las suyas."
        action={editable && <Button variant="primary" size="sm" loading={guardar.isPending} disabled={!sucio || !valido} onClick={onGuardar}>Guardar etapas</Button>} />
      {q.isPending ? <div className="space-y-3 p-5"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
        : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
        : (
          <>
            {filas.length > 1 && (
              <div className="flex justify-end gap-3 px-5 pt-3 text-xs">
                <button type="button" className="text-brand hover:underline" onClick={() => setAbiertas(new Set(filas.map((f) => f.key)))}>Desplegar todas</button>
                <button type="button" className="text-brand hover:underline" onClick={() => setAbiertas(new Set())}>Contraer todas</button>
              </div>
            )}
            <ol className="divide-y divide-border">
              {filas.map((f, i) => {
                const abierta = abiertas.has(f.key)
                const error = editable ? errorNombre(i) : undefined
                const estados = [...fijos(i, filas.length), ...ESTADOS_OPCIONALES_ETAPA.filter((s) => f.estados.includes(s))]
                const nombre = f.nombre.trim() || `Etapa ${i + 1}`
                const panelId = `etapa-${f.key}`
                return (
                  <li key={f.key}>
                    <div className="flex items-center gap-2 px-3 py-2 sm:px-5">
                      <button type="button" aria-expanded={abierta} aria-controls={panelId} onClick={() => alternar(f.key)}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left hover:bg-surface-2/60">
                        <ChevronRight className={cn('size-4 shrink-0 text-muted transition-transform', abierta && 'rotate-90')} aria-hidden />
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-muted" aria-hidden>{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate text-sm font-medium', !f.nombre.trim() && 'text-muted italic')}>{nombre}</span>
                          {!abierta && <span className="block truncate text-xs text-muted">{estados.join(' · ')}</span>}
                        </span>
                        {error && !abierta && (
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-danger"><AlertCircle className="size-3.5" aria-hidden />{error}</span>
                        )}
                      </button>
                      {editable && (
                        <div className="flex shrink-0 items-center">
                          <IconButton className="size-8" label={`Subir ${nombre}`} disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp className="size-4" /></IconButton>
                          <IconButton className="size-8" label={`Bajar ${nombre}`} disabled={i === filas.length - 1} onClick={() => mover(i, 1)}><ArrowDown className="size-4" /></IconButton>
                          <IconButton className="size-8" label={`Quitar ${nombre}`} disabled={filas.length === 1}
                            onClick={() => setFilas((l) => l.filter((_, j) => j !== i))}><Trash2 className="size-4" /></IconButton>
                        </div>
                      )}
                    </div>
                    {abierta && (
                      <div id={panelId} className="space-y-3 border-t border-border/60 bg-surface-2/30 px-5 py-4 sm:pl-[4.25rem]">
                        {editable ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <TextField label="Nombre" required maxLength={100} value={f.nombre}
                              error={error} onChange={(e) => cambiar(i, { nombre: e.target.value })} />
                            <TextField label="Descripción" value={f.descripcion} placeholder="Qué se hace en esta etapa"
                              onChange={(e) => cambiar(i, { descripcion: e.target.value })} />
                          </div>
                        ) : (
                          <p className={cn('text-sm', !f.descripcion && 'text-muted italic')}>{f.descripcion || 'Sin descripción'}</p>
                        )}
                        <div role="group" aria-label={`Estatus permitidos en ${nombre}`} className="flex flex-wrap items-center gap-1.5">
                          <span className="mr-1 text-xs text-muted">Estatus:</span>
                          {fijos(i, filas.length).map((s) => (
                            <span key={s} title="Siempre permitido en esta posición"
                              className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">{s}</span>
                          ))}
                          {ESTADOS_OPCIONALES_ETAPA.map((s) => {
                            const activo = f.estados.includes(s)
                            if (!editable) return activo && <span key={s} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">{s}</span>
                            return (
                              <button key={s} type="button" aria-pressed={activo}
                                onClick={() => cambiar(i, { estados: activo ? f.estados.filter((x) => x !== s) : [...f.estados, s] })}
                                className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                                  activo ? 'border-brand bg-brand-soft text-brand' : 'border-dashed border-border-strong text-muted hover:text-fg')}>
                                {activo ? <Check className="size-3" aria-hidden /> : <Plus className="size-3" aria-hidden />}{s}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
            {editable && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
                <Button size="sm" icon={<Plus className="size-4" />} disabled={filas.length >= MAX_ETAPAS}
                  onClick={() => {
                    const key = siguienteKey++
                    setFilas((l) => [...l, { key, nombre: '', descripcion: '', estados: [] }])
                    setAbiertas((s) => new Set(s).add(key))
                  }}>
                  Agregar etapa
                </Button>
                <p className="text-xs text-muted">Cada etapa vale lo mismo en el avance ({filas.length ? Math.round(1000 / filas.length) / 10 : 0} %).</p>
              </div>
            )}
            {!editable && filas.length === 0 && <EmptyState icon={<Layers className="size-6" />} title="Sin etapas" />}
            <div className="px-5"><FormError error={guardar.error} /></div>
          </>
        )}
    </Card>
  )
}

// ---------- Etiquetas ----------

function EtiquetasEditor({ departamento, editable }: { departamento: DepartamentoProyecto; editable: boolean }) {
  const toast = useToast()
  const q = useEtiquetas(departamento)
  const crear = useCrearEtiqueta()
  const eliminar = useEliminarEtiqueta()
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState(COLORES_ETIQUETA[0])
  const [editando, setEditando] = useState<number | null>(null)
  const [borrando, setBorrando] = useState<Etiqueta | null>(null)

  const agregar = () => {
    if (!nombre.trim()) return
    crear.mutate({ departamento, nombre: nombre.trim(), color }, {
      onSuccess: (e) => {
        toast.success(`Etiqueta “${e.nombre}” creada`)
        setNombre('')
        setColor(COLORES_ETIQUETA[((q.data?.length ?? 0) + 1) % COLORES_ETIQUETA.length])
      },
    })
  }

  return (
    <Card className="h-fit">
      <CardHeader title="Etiquetas" subtitle="Tipos de proyecto del departamento, para clasificarlos y filtrarlos." />
      {editable && (
        <div className="border-b border-border p-5">
          <div className="flex items-end gap-2">
            <TextField fieldClassName="flex-1" label="Nueva etiqueta" maxLength={60} value={nombre} placeholder="p. ej. Redes"
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar() } }} />
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-fg">Color</span>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-lg border border-border-strong bg-surface p-1" />
            </label>
            <Button icon={<Plus className="size-4" />} loading={crear.isPending} disabled={!nombre.trim()} onClick={agregar}>Agregar</Button>
          </div>
          <FormError error={crear.error} />
        </div>
      )}
      {q.isPending ? <div className="space-y-2 p-5"><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
        : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
        : q.data.length === 0 ? (
          <EmptyState icon={<Tag className="size-6" />} title="Sin etiquetas"
            description={editable ? 'Crea la primera para clasificar los proyectos.' : 'Este departamento aún no define etiquetas.'} />
        ) : (
          <ul className="divide-y divide-border">
            {q.data.map((e) => editando === e.id_etiqueta ? (
              <EtiquetaEdicion key={e.id_etiqueta} etiqueta={e} onClose={() => setEditando(null)} />
            ) : (
              <li key={e.id_etiqueta} className="flex items-center justify-between gap-2 px-5 py-2.5">
                <EtiquetaChip etiqueta={e} />
                {editable && (
                  <div className="flex gap-1">
                    <IconButton label={`Editar ${e.nombre}`} onClick={() => setEditando(e.id_etiqueta)}><Pencil className="size-4" /></IconButton>
                    <IconButton label={`Eliminar ${e.nombre}`} onClick={() => setBorrando(e)}><Trash2 className="size-4" /></IconButton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      {borrando && (
        <ConfirmDialog open title="Eliminar etiqueta" confirmLabel="Eliminar" danger loading={eliminar.isPending}
          error={eliminar.error} onClose={() => { eliminar.reset(); setBorrando(null) }}
          onConfirm={() => eliminar.mutate(borrando.id_etiqueta, {
            onSuccess: () => { toast.success(`Etiqueta “${borrando.nombre}” eliminada`); setBorrando(null) },
          })}>
          <p>Se quitará <strong className="text-fg">“{borrando.nombre}”</strong> de todos los proyectos que la tengan.</p>
        </ConfirmDialog>
      )}
    </Card>
  )
}

function EtiquetaEdicion({ etiqueta, onClose }: { etiqueta: Etiqueta; onClose: () => void }) {
  const toast = useToast()
  const actualizar = useActualizarEtiqueta()
  const [nombre, setNombre] = useState(etiqueta.nombre)
  const [color, setColor] = useState(etiqueta.color)
  const guardar = () => actualizar.mutate({ id_etiqueta: etiqueta.id_etiqueta, nombre: nombre.trim(), color }, {
    onSuccess: () => { toast.success('Etiqueta actualizada'); onClose() },
  })
  return (
    <li className="px-5 py-2.5">
      <div className="flex items-center gap-2">
        <input type="color" aria-label="Color" value={color} onChange={(e) => setColor(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-border-strong bg-surface p-1" />
        <input aria-label="Nombre" maxLength={60} value={nombre} autoFocus onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') onClose() }}
          className="h-9 min-w-0 flex-1 rounded-lg border border-border-strong bg-surface px-3 text-sm focus:border-brand focus:ring-4 focus:ring-[var(--ring)] focus:outline-none" />
        <IconButton label="Guardar" disabled={!nombre.trim() || actualizar.isPending} onClick={guardar}><Check className="size-4" /></IconButton>
        <IconButton label="Cancelar" onClick={onClose}><X className="size-4" /></IconButton>
      </div>
      <FormError error={actualizar.error} />
    </li>
  )
}
