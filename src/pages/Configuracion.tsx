import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarOff, Lock, Plus, X } from 'lucide-react'
import { useConfiguracion, useGuardarConfiguracion } from '@/api/hooks'
import { useAuth, usePermisos } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { EmptyState, ErrorState, FormError, Skeleton } from '@/components/ui/Feedback'
import { Card, CardHeader, PageHeader } from '@/components/ui/Layout'
import { Tabs } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { formatDate, num, todayISO } from '@/lib/format'
import { ConfiguracionDepartamento } from '@/features/configuracion/ConfiguracionDepartamento'
import { DEPARTAMENTOS_PROYECTO } from '@/types/api'

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const nombreDia = (iso: string) => DIAS[new Date(`${iso}T12:00:00`).getDay()]

const SECCIONES = [
  { id: 'calendario', label: 'Calendario laboral' },
  { id: 'infraestructura', label: 'Infraestructura', departamento: DEPARTAMENTOS_PROYECTO[0] },
  { id: 'procesos', label: 'Procesos', departamento: DEPARTAMENTOS_PROYECTO[1] },
  { id: 'desarrollo', label: 'Desarrollo de Software', departamento: DEPARTAMENTOS_PROYECTO[2] },
] as const
type SeccionId = (typeof SECCIONES)[number]['id']

/** Calendario laboral (solo Administrador) y, por departamento, sus etapas y etiquetas (su Gerente o el
 * Administrador las editan; los demás Gerentes las consultan). */
export default function Configuracion() {
  const { esAdmin, gestionaEquipo, gestionaDepartamentoProyecto } = usePermisos()
  const { sesion } = useAuth()
  const [params, setParams] = useSearchParams()
  if (!gestionaEquipo) {
    return (
      <>
        <PageHeader title="Configuración" />
        <Card><EmptyState icon={<Lock className="size-6" />} title="Sin acceso" description="Solo el Administrador y los Gerentes pueden ver la configuración." /></Card>
      </>
    )
  }
  const visibles = SECCIONES.filter((s) => s.id !== 'calendario' || esAdmin)
  const propia = visibles.find((s) => 'departamento' in s && s.departamento === sesion?.departamento)
  const seccion = visibles.find((s) => s.id === params.get('seccion')) ?? propia ?? visibles[0]
  const cambiar = (id: SeccionId) => setParams({ seccion: id }, { replace: true })

  return (
    <>
      <PageHeader title="Configuración"
        description={'departamento' in seccion
          ? `Etapas y etiquetas de los proyectos de ${seccion.departamento}.`
          : 'Con estos valores se calculan automáticamente las horas presupuestadas de los proyectos.'} />
      <Tabs label="Secciones de configuración" value={seccion.id} onChange={cambiar}
        tabs={visibles.map(({ id, label }) => ({ id, label }))} />
      <div role="tabpanel" id={`panel-${seccion.id}`} aria-labelledby={`tab-${seccion.id}`} className="pt-6">
        {'departamento' in seccion
          ? <ConfiguracionDepartamento key={seccion.id} departamento={seccion.departamento}
              editable={gestionaDepartamentoProyecto(seccion.departamento)} />
          : <CalendarioLaboral />}
      </div>
    </>
  )
}

function CalendarioLaboral() {
  const toast = useToast()
  const q = useConfiguracion()
  const guardar = useGuardarConfiguracion()
  const [entreSemana, setEntreSemana] = useState('')
  const [sabado, setSabado] = useState('')
  const [dias, setDias] = useState<string[]>([])
  const [nuevo, setNuevo] = useState('')

  useEffect(() => {
    if (!q.data) return
    setEntreSemana(String(num(q.data.horas_entre_semana)))
    setSabado(String(num(q.data.horas_sabado)))
    setDias(q.data.dias_inactivos)
  }, [q.data])

  const errorHoras = (v: string) => v === '' ? 'Obligatorio' : Number(v) < 0 || Number(v) > 24 ? 'Entre 0 y 24' : undefined
  const errorNuevo = nuevo && dias.includes(nuevo) ? 'Ya está en la lista'
    : nuevo && nombreDia(nuevo) === 'domingo' ? 'El domingo nunca cuenta' : undefined
  const sucio = !!q.data && (
    Number(entreSemana) !== num(q.data.horas_entre_semana) || Number(sabado) !== num(q.data.horas_sabado)
    || JSON.stringify(dias) !== JSON.stringify(q.data.dias_inactivos)
  )
  const valido = !errorHoras(entreSemana) && !errorHoras(sabado)

  const agregar = () => {
    if (!nuevo || errorNuevo) return
    setDias((d) => [...d, nuevo].sort())
    setNuevo('')
  }

  const onGuardar = () =>
    guardar.mutate({ horas_entre_semana: entreSemana, horas_sabado: sabado, dias_inactivos: dias }, {
      onSuccess: (r) => {
        toast.success(r.proyectos_recalculados
          ? `Configuración guardada · ${r.proyectos_recalculados} proyecto(s) recalculado(s)`
          : 'Configuración guardada')
        if (r.proyectos_excedidos) toast.info(`${r.proyectos_excedidos} proyecto(s) quedaron con más horas en tareas que presupuesto.`)
      },
    })

  if (q.isPending) return <Skeleton className="h-80" />
  if (q.isError) return <Card><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" loading={guardar.isPending} disabled={!sucio || !valido} onClick={onGuardar}>Guardar cambios</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-fit">
          <CardHeader title="Horas por día" subtitle="El domingo nunca cuenta" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <TextField type="number" min={0} max={24} step="0.5" label="Lunes a viernes (h)" value={entreSemana}
              error={errorHoras(entreSemana)} onChange={(e) => setEntreSemana(e.target.value)} />
            <TextField type="number" min={0} max={24} step="0.5" label="Sábado (h)" value={sabado}
              error={errorHoras(sabado)} hint="0 = el sábado no cuenta" onChange={(e) => setSabado(e.target.value)} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Días desactivados" subtitle="Fechas que no cuentan como laborables (festivos, descansos…)" />
          <div className="space-y-4 p-5">
            <div className="flex items-end gap-2">
              <TextField fieldClassName="flex-1" type="date" label="Agregar fecha" min={todayISO()} value={nuevo}
                error={errorNuevo} onChange={(e) => setNuevo(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar() } }} />
              <Button icon={<Plus className="size-4" />} disabled={!nuevo || !!errorNuevo} onClick={agregar}>Agregar</Button>
            </div>
            {dias.length === 0 ? (
              <EmptyState icon={<CalendarOff className="size-6" />} title="Ninguno" description="Todos los días cuentan según las horas por día." />
            ) : (
              <ul className="flex flex-wrap gap-2">
                {dias.map((d) => (
                  <li key={d} className={cn('inline-flex items-center gap-1 rounded-full border border-border py-1 pr-1 pl-3 text-sm tabular-nums', d < todayISO() && 'text-muted')}>
                    <span className="capitalize">{nombreDia(d).slice(0, 3)}</span> {formatDate(d)}
                    <button type="button" aria-label={`Quitar ${formatDate(d)}`} onClick={() => setDias((l) => l.filter((x) => x !== d))}
                      className="rounded-full p-0.5 text-muted hover:bg-surface-2 hover:text-fg"><X className="size-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <p className="mt-4 text-sm text-muted">
        Al guardar se recalculan las horas presupuestadas de los proyectos abiertos en cálculo automático (los ajustados a mano no cambian).
      </p>
      <FormError error={guardar.error} />
    </>
  )
}
