import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertOctagon, ArrowLeft, Layers, Pencil, Plus, Users } from 'lucide-react'
import { useAsignaciones, useBloqueos, useEtapas, useProyecto } from '@/api/hooks'
import { useEmpresaMap, useUsuarioMap } from '@/api/lookups'
import { EstadoBadge, EtapaBadge, ImpactoBadge, SemaforoBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton, Spinner } from '@/components/ui/Feedback'
import { Avatar, Card, CardHeader, DescriptionList, PageHeader, ProgressBar, Table, Td, Th } from '@/components/ui/Layout'
import { Tabs } from '@/components/ui/Tabs'
import { AsignacionFormModal } from '@/features/asignaciones/AsignacionFormModal'
import { BloqueoFormModal } from '@/features/bloqueos/BloqueoFormModal'
import { BloqueosTable } from '@/features/bloqueos/BloqueosTable'
import { CambiarEstadoModal } from '@/features/proyectos/CambiarEstadoModal'
import { ProyectoFormModal } from '@/features/proyectos/ProyectoFormModal'
import { EtapaFormModal } from '@/features/etapas/EtapaFormModal'
import { formatDate, formatHours, num } from '@/lib/format'
import { TRANSICIONES, type EstadoProyecto, type ProyectoDetalle as Detalle } from '@/types/api'

type TabId = 'resumen' | 'etapas' | 'asignaciones' | 'bloqueos'

export default function ProyectoDetalle() {
  const id = Number(useParams().id)
  const proyecto = useProyecto(id)
  const etapas = useEtapas(id)
  const asignaciones = useAsignaciones(id)
  const bloqueos = useBloqueos({ id_proyecto: id, limit: 200 })

  const [tab, setTab] = useState<TabId>('resumen')

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
          { id: 'etapas', label: 'Etapas', count: etapas.data?.length },
          { id: 'asignaciones', label: 'Asignaciones', count: asignaciones.data?.length },
          { id: 'bloqueos', label: 'Bloqueos', count: bloqueos.data?.length },
        ]}
      />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-6">
        {tab === 'resumen' && <Resumen p={p} />}
        {tab === 'etapas' && <EtapasTab idProyecto={id} cerrado={isFinal(p.estado_proyecto)} />}
        {tab === 'asignaciones' && <AsignacionesTab p={p} />}
        {tab === 'bloqueos' && <BloqueosTab idProyecto={id} />}
      </div>
    </>
  )
}

const isFinal = (e: EstadoProyecto) => TRANSICIONES[e].length === 0

function BackLink() {
  return (
    <Link to="/proyectos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
      <ArrowLeft className="size-4" /> Proyectos
    </Link>
  )
}

function Header({ p }: { p: Detalle }) {
  const [editing, setEditing] = useState(false)
  const [destino, setDestino] = useState<EstadoProyecto | null>(null)
  const siguientes = TRANSICIONES[p.estado_proyecto]

  return (
    <>
      <PageHeader
        back={<BackLink />}
        title={p.nombre_proyecto}
        description={undefined}
        actions={<Button icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>Editar</Button>}
      />
      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-3">
        <EstadoBadge value={p.estado_proyecto} />
        <SemaforoBadge value={p.semaforo} />
        {siguientes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:ml-2 sm:border-l sm:border-border sm:pl-4">
            <span className="text-sm text-muted">Mover a:</span>
            {siguientes.map((s) => (
              <Button key={s} size="sm" variant={s === 'Cancelado' ? 'ghost' : 'secondary'}
                className={s === 'Cancelado' ? 'text-danger hover:text-danger' : undefined} onClick={() => setDestino(s)}>
                {s}
              </Button>
            ))}
          </div>
        )}
      </div>
      {editing && <ProyectoFormModal proyecto={p} onClose={() => setEditing(false)} />}
      {destino && <CambiarEstadoModal proyecto={p} destino={destino} onClose={() => setDestino(null)} />}
    </>
  )
}

function Resumen({ p }: { p: Detalle }) {
  const { map: usuarios } = useUsuarioMap()
  const { map: empresas } = useEmpresaMap()
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
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">{text}</p>
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
                    <p className="text-sm font-medium">{empresas.get(e.id_empresa)?.nombre_empresa ?? `Empresa #${e.id_empresa}`}</p>
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
            { label: 'Fecha tentativa', value: formatDate(p.fecha_tentativa) },
            { label: 'Fecha comprometida', value: formatDate(p.fecha_comprometida) },
            { label: 'Cierre real', value: formatDate(p.fecha_real_cierre) },
          ]} />
        </div>
      </Card>
    </div>
  )
}

function EtapasTab({ idProyecto, cerrado }: { idProyecto: number; cerrado: boolean }) {
  const q = useEtapas(idProyecto)
  const [adding, setAdding] = useState(false)
  const siguienteOrden = (q.data?.reduce((m, e) => Math.max(m, e.orden_secuencia), 0) ?? 0) + 1

  return (
    <Card>
      <CardHeader title="Etapas del proyecto" subtitle="Horas efectivas frente a las estimadas"
        action={<Button variant="primary" size="sm" icon={<Plus className="size-4" />} disabled={cerrado} onClick={() => setAdding(true)}>Agregar etapa</Button>} />
      {q.isPending ? <div className="space-y-3 p-5"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
        : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
        : q.data.length === 0 ? (
          <EmptyState icon={<Layers className="size-6" />} title="Sin etapas" description="Define las fases del proyecto (Análisis, Desarrollo, Testing…)."
            action={!cerrado && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Agregar etapa</Button>} />
        ) : (
          <ol className="divide-y divide-border">
            {q.data.map((e) => {
              const est = num(e.horas_estimadas)
              const real = num(e.horas_efectivas_reales)
              const pct = est > 0 ? (real / est) * 100 : 0
              return (
                <li key={e.id_etapa} className="grid gap-3 px-5 py-4 sm:grid-cols-[2.5rem_1fr_16rem] sm:items-center">
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
                </li>
              )
            })}
          </ol>
        )}
      {adding && <EtapaFormModal idProyecto={idProyecto} sugeridoOrden={siguienteOrden} onClose={() => setAdding(false)} />}
    </Card>
  )
}

function AsignacionesTab({ p }: { p: Detalle }) {
  const q = useAsignaciones(p.id_proyecto)
  const etapas = useEtapas(p.id_proyecto)
  const { map: usuarios } = useUsuarioMap()
  const [adding, setAdding] = useState(false)
  const cerrado = isFinal(p.estado_proyecto)
  const etapaMap = new Map(etapas.data?.map((e) => [e.id_etapa, e]))
  const totalHoras = q.data?.reduce((s, a) => s + num(a.horas_asignadas), 0) ?? 0
  const sinEtapas = !etapas.isPending && (etapas.data?.length ?? 0) === 0

  return (
    <Card>
      <CardHeader title="Recursos asignados" subtitle={q.data?.length ? `${formatHours(totalHoras)} asignadas en total` : undefined}
        action={<Button variant="primary" size="sm" icon={<Plus className="size-4" />} disabled={cerrado || sinEtapas} onClick={() => setAdding(true)}>Asignar recurso</Button>} />
      {(cerrado || sinEtapas) && (
        <p className="border-b border-border bg-surface-2/50 px-5 py-2.5 text-sm text-muted">
          {cerrado ? `No se pueden asignar recursos a un proyecto en estado “${p.estado_proyecto}”.` : 'Crea al menos una etapa para poder asignar recursos.'}
        </p>
      )}
      {q.isPending ? <div className="space-y-3 p-5"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
        : q.data.length === 0 ? <EmptyState icon={<Users className="size-6" />} title="Sin asignaciones" description="Aún no hay personas asignadas a las etapas de este proyecto." />
        : (
          <Table>
            <thead><tr><Th>Persona</Th><Th>Rol</Th><Th>Etapa</Th><Th className="text-right">Horas</Th><Th className="min-w-40">Utilización</Th></tr></thead>
            <tbody>
              {q.data.map((a) => {
                const u = usuarios.get(a.id_usuario)
                const pct = num(a.porcentaje_utilizacion)
                return (
                  <tr key={a.id_asignacion}>
                    <Td><div className="flex items-center gap-3"><Avatar name={u?.nombre ?? '?'} /><span className="font-medium whitespace-nowrap">{u?.nombre ?? `Usuario #${a.id_usuario}`}</span></div></Td>
                    <Td className="text-muted">{a.perfil_requerido}</Td>
                    <Td className="whitespace-nowrap text-muted">{etapaMap.get(a.id_etapa)?.nombre_etapa ?? `#${a.id_etapa}`}</Td>
                    <Td className="text-right whitespace-nowrap tabular-nums">{formatHours(a.horas_asignadas)}</Td>
                    <Td>
                      <div className="flex items-center gap-2"><div className="flex-1"><ProgressBar label="Utilización" value={pct} tone={pct > 90 ? 'warn' : 'brand'} /></div><span className="w-10 text-right text-xs text-muted tabular-nums">{Math.round(pct)}%</span></div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      {adding && etapas.data && <AsignacionFormModal idProyecto={p.id_proyecto} etapas={etapas.data} onClose={() => setAdding(false)} />}
    </Card>
  )
}

function BloqueosTab({ idProyecto }: { idProyecto: number }) {
  const q = useBloqueos({ id_proyecto: idProyecto, limit: 200 })
  const etapas = useEtapas(idProyecto)
  const [adding, setAdding] = useState(false)
  const etapaMap = new Map(etapas.data?.map((e) => [e.id_etapa, e]))

  return (
    <Card>
      <CardHeader title="Bloqueos e interrupciones" subtitle="Historial del proyecto"
        action={<Button variant="primary" size="sm" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Reportar bloqueo</Button>} />
      {q.isPending ? <div className="space-y-3 p-5"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
        : q.data.length === 0 ? <EmptyState icon={<AlertOctagon className="size-6" />} title="Sin bloqueos" description="Este proyecto no ha registrado interrupciones." />
        : <BloqueosTable bloqueos={q.data} etapas={etapaMap} />}
      {adding && <BloqueoFormModal idProyecto={idProyecto} onClose={() => setAdding(false)} />}
    </Card>
  )
}
