import { useId, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useActualizarEquipoTrabajo, useCrearEquipoTrabajo, useUsuarios } from '@/api/hooks'
import { Button } from '@/components/ui/Button'
import { TextArea, TextField } from '@/components/ui/Field'
import { FormError } from '@/components/ui/Feedback'
import { Avatar } from '@/components/ui/Layout'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { COLORES_ETIQUETA } from '@/features/proyectos/Etiquetas'
import type { EquipoTrabajo } from '@/types/api'

/** Crea o edita un equipo de trabajo: nombre, color y sus personas (de cualquier departamento). */
export function EquipoTrabajoFormModal({ equipo, onClose, onGuardado }: {
  equipo?: EquipoTrabajo; onClose: () => void; onGuardado?: (e: EquipoTrabajo) => void
}) {
  const formId = useId()
  const toast = useToast()
  const crear = useCrearEquipoTrabajo()
  const actualizar = useActualizarEquipoTrabajo()
  const mutation = equipo ? actualizar : crear
  const personas = useUsuarios({ activo: true })
  const [nombre, setNombre] = useState(equipo?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(equipo?.descripcion ?? '')
  const [color, setColor] = useState(equipo?.color ?? COLORES_ETIQUETA[0])
  const [miembros, setMiembros] = useState(() => new Set(equipo?.miembros.map((m) => m.id_usuario)))
  const [busqueda, setBusqueda] = useState('')
  const [intentado, setIntentado] = useState(false)

  // Personas (no activos) agrupadas por departamento; las elegidas primero dentro de cada grupo.
  const grupos = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    const lista = (personas.data ?? []).filter((u) => u.tipo_recurso !== 'Activo' && (!texto || u.nombre.toLowerCase().includes(texto)))
    const porDepto = new Map<string, typeof lista>()
    for (const u of lista) porDepto.set(u.departamento ?? 'Sin departamento', [...(porDepto.get(u.departamento ?? 'Sin departamento') ?? []), u])
    return [...porDepto].sort(([a], [b]) => a.localeCompare(b))
  }, [personas.data, busqueda])

  const alternar = (id: number) => setMiembros((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n })
  const errorNombre = intentado && !nombre.trim() ? 'Obligatorio' : undefined

  const guardar = () => {
    setIntentado(true)
    if (!nombre.trim()) return
    const body = { nombre: nombre.trim(), descripcion: descripcion.trim() || null, color, miembros: [...miembros] }
    const listo = (e: EquipoTrabajo) => { toast.success(equipo ? 'Equipo de trabajo actualizado' : 'Equipo de trabajo creado'); onGuardado?.(e); onClose() }
    if (equipo) actualizar.mutate({ id: equipo.id_equipo_trabajo, ...body }, { onSuccess: listo })
    else crear.mutate(body, { onSuccess: listo })
  }

  return (
    <Modal open onClose={onClose} size="lg" title={equipo ? 'Editar equipo de trabajo' : 'Nuevo equipo de trabajo'}
      description="Agrupa a las personas y los proyectos de una línea de negocio (p. ej. Servicios Corporativos o Combustibles), sin importar su departamento."
      footer={<>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button variant="primary" type="submit" form={formId} loading={mutation.isPending}>{equipo ? 'Guardar' : 'Crear equipo'}</Button>
      </>}>
      <form id={formId} noValidate className="space-y-5" onSubmit={(e) => { e.preventDefault(); guardar() }}>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <TextField label="Nombre" required maxLength={100} data-autofocus value={nombre} onChange={(e) => setNombre(e.target.value)}
            placeholder="p. ej. Servicios Corporativos en Software" error={errorNombre} />
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium text-fg">Color</legend>
            <div role="radiogroup" aria-label="Color del equipo" className="flex flex-wrap gap-1.5 pt-1">
              {COLORES_ETIQUETA.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)}
                  className={cn('size-7 rounded-full ring-offset-2 ring-offset-surface', color === c && 'ring-2 ring-fg')} style={{ background: c }} />
              ))}
            </div>
          </fieldset>
        </div>
        <TextArea label="Descripción" rows={2} maxLength={2000} value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
          placeholder="¿A quién atiende este equipo y qué tipo de proyectos lleva?" />

        <fieldset>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <legend className="text-[13px] font-medium text-fg">Personas <span className="font-normal text-muted">· {miembros.size} elegida(s)</span></legend>
            <label className="relative">
              <span className="sr-only">Buscar persona</span>
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar persona"
                className="w-48 rounded-lg border border-border bg-surface py-1.5 pr-2 pl-8 text-sm focus:border-brand focus:outline-none" />
            </label>
          </div>
          <p className="mb-2 text-xs text-muted">Una persona puede estar en varios equipos de trabajo. Su departamento no cambia.</p>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
            {personas.isPending ? <p className="p-3 text-sm text-muted">Cargando personas…</p>
              : grupos.length === 0 ? <p className="p-3 text-sm text-muted">Nadie coincide con la búsqueda.</p>
              : grupos.map(([depto, lista]) => (
                <div key={depto}>
                  <p className="sticky top-0 z-10 border-b border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted">{depto}</p>
                  <ul>
                    {lista.map((u) => (
                      <li key={u.id_usuario}>
                        <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-surface-2">
                          <input type="checkbox" className="accent-[var(--brand)]" checked={miembros.has(u.id_usuario)} onChange={() => alternar(u.id_usuario)} />
                          <Avatar name={u.nombre} className="size-6 text-[10px]" />
                          <span className="flex-1 truncate">{u.nombre}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </fieldset>
        <FormError error={mutation.error} />
      </form>
    </Modal>
  )
}
