import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarOff, FolderKanban, History, KeyRound, Pencil, Trash2 } from 'lucide-react'
import {
  useAsignacionesPersona, useAusencias, useBitacoraPersona, useCapacidad, useDeleteAusencia, useProyectos, usePuestos,
  useUsuario, useUsuarios,
} from '@/api/hooks'
import { useAuth, usePermisos } from '@/auth/AuthProvider'
import { Badge, EstadoBadge, EtapaBadge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton, Spinner } from '@/components/ui/Feedback'
import { Card, CardHeader, DescriptionList, PageHeader, Table, Td, Th } from '@/components/ui/Layout'
import { SkillChip } from '@/components/ui/SkillsInput'
import { Tabs } from '@/components/ui/Tabs'
import { UtilizacionBar } from '@/components/ui/Utilizacion'
import { RecursoAvatar } from '@/features/equipo/RecursoAvatar'
import { AusenciaFormModal } from '@/features/usuarios/AusenciaFormModal'
import { MisTareasCard } from '@/features/usuarios/MisTareasCard'
import { CambiarPasswordModal, RestablecerPasswordModal } from '@/features/usuarios/PasswordModals'
import { PerfilFormModal } from '@/features/usuarios/PerfilFormModal'
import { UsuarioFormModal } from '@/features/usuarios/UsuarioFormModal'
import { cn } from '@/lib/cn'
import { BANDAS, bandaSemana, formatSemana, formatUtilizacion, lunesISO } from '@/lib/capacidad'
import { formatDate, formatDateTime, formatHours, formatNumber, num, todayISO } from '@/lib/format'
import type { CapacidadPersona, Usuario } from '@/types/api'

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

export default function PersonaDetalle() {
  const id = Number(useParams().id)
  const usuario = useUsuario(id)
  if (usuario.isPending) return <Spinner className="py-24" />
  if (usuario.isError) return <ErrorState error={usuario.error} onRetry={() => usuario.refetch()} />
  return <Ficha u={usuario.data} />
}

/** Ficha de una persona. Con `perfil` es "Mi perfil": la persona edita su nombre y skills y ve sus tareas. */
export function Ficha({ u, perfil }: { u: Usuario; perfil?: boolean }) {
  const permisos = usePermisos()
  const [editing, setEditing] = useState(false)
  const [editandoPerfil, setEditandoPerfil] = useState(false)
  const [ausencia, setAusencia] = useState(false)
  const [password, setPassword] = useState(false)
  const { sesion } = useAuth()
  const puestos = usePuestos()
  const capacidad = useCapacidad({ id_usuario: u.id_usuario, semanas: 12, desde: lunesISO() })
  const asignaciones = useAsignacionesPersona(u.id_usuario)
  const jefe = useUsuario(u.id_jefe ?? 0, u.id_jefe !== null)
  const puesto = puestos.data?.find((p) => p.id_puesto === u.id_puesto)?.nombre_puesto
  const editable = permisos.gestionaDepartamento(u.departamento)
  const gestionaAusencias = editable || permisos.esYo(u.id_usuario)
  // Contraseñas: solo con inicio de sesión habilitado y para personas activas con correo (no activos no humanos).
  const accede = !!sesion?.auth_habilitada && u.activo && u.tipo_recurso !== 'Activo' && !!u.correo
  const restablecePassword = accede && !perfil && !permisos.esYo(u.id_usuario)
    && (permisos.esAdmin || (editable && u.rol !== 'Administrador' && u.rol !== 'Gerente'))

  const cap = capacidad.data?.[0]
  const vigentes = asignaciones.data?.filter((a) => a.vigente) ?? []
  const contratoPorVencer = u.fecha_fin_contrato && u.fecha_fin_contrato <= sumarDias(todayISO(), 30)

  return (
    <>
      <PageHeader
        back={perfil ? undefined : <Link to="/equipo" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" /> Equipo</Link>}
        title={perfil ? 'Mi perfil' : u.nombre}
        description={[puesto, u.departamento].filter(Boolean).join(' · ') || u.tipo_recurso}
        actions={<>
          {gestionaAusencias && u.activo && <Button icon={<CalendarOff className="size-4" />} onClick={() => setAusencia(true)}>Registrar ausencia</Button>}
          {perfil && accede && <Button icon={<KeyRound className="size-4" />} onClick={() => setPassword(true)}>Cambiar contraseña</Button>}
          {restablecePassword && (
            <Button icon={<KeyRound className="size-4" />} onClick={() => setPassword(true)}>{u.tiene_password ? 'Restablecer contraseña' : 'Dar acceso'}</Button>
          )}
          {perfil
            ? <Button variant="primary" icon={<Pencil className="size-4" />} onClick={() => setEditandoPerfil(true)}>Editar mi perfil</Button>
            : editable && <Button variant="primary" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>Editar</Button>}
        </>}
      />

      <Card className="mb-6 flex flex-wrap items-center gap-4 p-5">
        <RecursoAvatar usuario={u} className="size-14 text-lg" />
        <div className="min-w-0 flex-1">
          {perfil && <p className="mb-1 text-lg font-semibold">{u.nombre}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={u.tipo_recurso === 'Interno' ? 'brand' : u.tipo_recurso === 'Externo' ? 'warn' : 'neutral'}>{u.tipo_recurso}</Badge>
            {u.tipo_recurso !== 'Activo' && <Badge>{u.rol}</Badge>}
            {u.activo ? <Badge tone="ok" dot>Activo</Badge> : <Badge dot>Inactivo</Badge>}
            {accede && !u.tiene_password && <Badge tone="warn">Sin contraseña</Badge>}
            {contratoPorVencer && <Badge tone="danger">Contrato vence {formatDate(u.fecha_fin_contrato)}</Badge>}
          </div>
          <p className="mt-1.5 truncate text-sm text-muted">
            {u.correo ?? 'Sin correo'}
            {u.id_jefe && jefe.data && <> · Reporta a <Link to={`/equipo/${jefe.data.id_usuario}`} className="text-fg hover:text-brand hover:underline">{jefe.data.nombre}</Link></>}
          </p>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Utilización esta semana">
          {cap ? <span className={cn(bandaSemana(cap.semanas[0]) === 'sobrecarga' && 'text-danger')}>{formatUtilizacion(cap.semanas[0])}</span> : '—'}
          {cap && <span className="block text-xs font-normal text-muted">{BANDAS[bandaSemana(cap.semanas[0])].label}</span>}
        </Stat>
        <Stat label="Capacidad planificable">
          {cap ? formatHours(cap.capacidad_planificable) : '—'}
          <span className="block text-xs font-normal text-muted">{formatNumber(u.porcentaje_proyectos)} % de {formatHours(u.capacidad_horas_semanales)} / sem</span>
          {cap && num(cap.semanas[0].horas_operacion_asignadas) > 0 && (
            <span className={cn('block text-xs font-normal', num(cap.semanas[0].horas_operacion_asignadas) > num(cap.semanas[0].horas_operacion_disponibles) ? 'text-danger' : 'text-muted')}>
              Operación esta semana: {formatHours(cap.semanas[0].horas_operacion_asignadas)} de {formatHours(cap.semanas[0].horas_operacion_disponibles)}
            </span>
          )}
        </Stat>
        <Stat label="Asignaciones vigentes">{asignaciones.isPending ? '…' : vigentes.length}</Stat>
        {permisos.veCostos
          ? <Stat label="Costo por hora">{u.costo_hora ? moneda.format(num(u.costo_hora)) : '—'}</Stat>
          : <Stat label="Skills">{u.skills.length}</Stat>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {perfil && <MisTareasCard />}
          <CargaChart cap={cap} loading={capacidad.isPending} />
          <AsignacionesCard u={u} />
          <LideraCard id={u.id_usuario} />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Datos" />
            <div className="p-5">
              <DescriptionList items={[
                { label: 'Departamento', value: u.departamento ?? 'Sin asignar' },
                { label: 'Puesto', value: puesto ?? '—' },
                ...(u.tipo_recurso === 'Externo' ? [
                  { label: 'Proveedor', value: u.proveedor ?? '—' },
                  { label: 'Fin de contrato', value: formatDate(u.fecha_fin_contrato) },
                ] : []),
                { label: 'Capacidad', value: `${formatHours(u.capacidad_horas_semanales)} / semana` },
                { label: 'Dedicación a proyectos', value: `${formatNumber(u.porcentaje_proyectos)} %` },
              ]} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Skills" subtitle="●○○ básico · ●●○ intermedio · ●●● experto" />
            <div className="flex flex-wrap gap-1.5 p-5">
              {u.skills.length === 0 ? <p className="text-sm text-muted">Sin skills registrados.</p>
                : u.skills.map((s) => <SkillChip key={s.nombre} skill={s} />)}
            </div>
          </Card>
          <EquipoDirectoCard id={u.id_usuario} />
          <AusenciasCard id={u.id_usuario} editable={gestionaAusencias} />
          <BitacoraCard id={u.id_usuario} />
        </div>
      </div>

      {editing && <UsuarioFormModal usuario={u} onClose={() => setEditing(false)} />}
      {editandoPerfil && <PerfilFormModal usuario={u} onClose={() => setEditandoPerfil(false)} />}
      {password && (perfil
        ? <CambiarPasswordModal onClose={() => setPassword(false)} />
        : <RestablecerPasswordModal u={u} onClose={() => setPassword(false)} />)}
      {ausencia && <AusenciaFormModal idUsuario={u.id_usuario} nombre={u.nombre} onClose={() => setAusencia(false)} />}
    </>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-fg tabular-nums">{children}</div>
    </Card>
  )
}

const TOPE = 150

/** Barras de utilización semanal con línea de referencia en 100 %. */
function CargaChart({ cap, loading }: { cap?: CapacidadPersona; loading: boolean }) {
  const hoy = lunesISO()
  return (
    <Card>
      <CardHeader title="Carga próximas 12 semanas" subtitle="% de la capacidad planificable asignado cada semana" />
      <div className="p-5">
        {loading || !cap ? <Skeleton className="h-48" /> : (
          <>
            <div className="relative h-48">
              {/* Rejilla recesiva: 0, 50, 100 (referencia) y 150 %. */}
              {[0, 50, 100, 150].map((v) => (
                <div key={v} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${(v / TOPE) * 100}%` }}>
                  <span className="w-9 -translate-y-1/2 text-right text-[10px] text-muted tabular-nums">{v} %</span>
                  <span className={cn('h-px flex-1 -translate-y-1/2', v === 100 ? 'bg-fg/40' : 'bg-border')} />
                </div>
              ))}
              <ul className="absolute inset-y-0 right-0 left-11 flex items-end gap-[2px]" aria-label="Utilización por semana">
                {cap.semanas.map((s) => {
                  const banda = BANDAS[bandaSemana(s)]
                  const valor = s.utilizacion === null ? (num(s.horas_asignadas) > 0 ? TOPE : 0) : Math.min(TOPE, num(s.utilizacion))
                  return (
                    <li key={s.inicio} className="group relative flex h-full flex-1 items-end justify-center"
                      aria-label={`Semana del ${formatSemana(s.inicio)}: ${formatUtilizacion(s)}`}>
                      <div
                        className={cn('w-full max-w-7 rounded-t-[4px] transition-opacity group-hover:opacity-80',
                          { brand: 'bg-brand', ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-danger', neutral: 'bg-muted/30' }[banda.tone])}
                        style={{ height: `${Math.max(valor > 0 ? 2 : 0, (valor / TOPE) * 100)}%` }}
                      />
                      <div role="tooltip" className="pointer-events-none absolute bottom-full z-10 mb-2 hidden w-44 rounded-lg border border-border bg-surface p-2.5 text-xs shadow-lg group-hover:block">
                        <p className="font-semibold text-fg">Semana del {formatSemana(s.inicio)}</p>
                        <p className="mt-1 text-fg tabular-nums">{formatUtilizacion(s)} · {formatHours(s.horas_asignadas)} de {formatHours(s.horas_disponibles)}</p>
                        {s.dias_ausencia > 0 && <p className="text-muted">{s.dias_ausencia} día(s) de ausencia</p>}
                        <p className="mt-1 text-muted">{banda.label}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
            <div className="mt-2 ml-11 flex gap-[2px]">
              {cap.semanas.map((s, i) => (
                <span key={s.inicio} className={cn('flex-1 text-center text-[10px] whitespace-nowrap tabular-nums', s.inicio === hoy ? 'font-semibold text-brand' : 'text-muted', i % 2 === 1 && 'max-sm:invisible')}>
                  {formatSemana(s.inicio)}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

function AsignacionesCard({ u }: { u: Usuario }) {
  const [tab, setTab] = useState<'vigentes' | 'historial'>('vigentes')
  const { veCostos } = usePermisos()
  const q = useAsignacionesPersona(u.id_usuario)
  const lista = (q.data ?? []).filter((a) => (tab === 'vigentes' ? a.vigente : !a.vigente))
  const total = lista.reduce((acc, a) => acc + num(a.costo_estimado), 0)
  return (
    <Card>
      <CardHeader title="Asignaciones" />
      <div className="px-5 pt-2">
        <Tabs label="Asignaciones" value={tab} onChange={setTab} tabs={[
          { id: 'vigentes', label: 'Vigentes', count: q.data?.filter((a) => a.vigente).length },
          { id: 'historial', label: 'Historial', count: q.data?.filter((a) => !a.vigente).length },
        ]} />
      </div>
      {q.isPending ? <div className="p-5"><Skeleton className="h-24" /></div>
        : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
        : lista.length === 0 ? <EmptyState icon={<FolderKanban className="size-6" />} title={tab === 'vigentes' ? 'Sin asignaciones vigentes' : 'Sin historial'} />
        : (
          <Table>
            <thead><tr><Th>Proyecto · etapa</Th><Th>Periodo</Th><Th>Rol</Th><Th className="text-right">Horas en tareas</Th>{veCostos && <Th className="text-right">Costo</Th>}</tr></thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id_asignacion}>
                  <Td>
                    <Link to={`/proyectos/${a.id_proyecto}`} className="font-medium hover:text-brand hover:underline">{a.nombre_proyecto}</Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">{a.nombre_etapa} <EtapaBadge value={a.estado_etapa} /> {a.estado_proyecto !== a.estado_etapa && <EstadoBadge value={a.estado_proyecto} />}</div>
                  </Td>
                  <Td className="text-xs whitespace-nowrap text-muted">{a.fecha_inicio_est || a.fecha_fin_est ? `${formatDate(a.fecha_inicio_est)} – ${formatDate(a.fecha_fin_est)}` : 'Sin fechas'}</Td>
                  <Td className="text-muted">{a.perfil_requerido}</Td>
                  <Td className="text-right whitespace-nowrap tabular-nums">{formatHours(a.horas_en_tareas)}</Td>
                  {veCostos && <Td className="text-right whitespace-nowrap tabular-nums">{a.costo_estimado ? moneda.format(num(a.costo_estimado)) : '—'}</Td>}
                </tr>
              ))}
            </tbody>
            {veCostos && total > 0 && (
              <tfoot><tr><Td className="font-medium">Total</Td><Td /><Td /><Td /><Td className="text-right font-semibold tabular-nums">{moneda.format(total)}</Td></tr></tfoot>
            )}
          </Table>
        )}
    </Card>
  )
}

function LideraCard({ id }: { id: number }) {
  const q = useProyectos({ lider_id: id, limit: 50 })
  if (!q.data?.items.length) return null
  return (
    <Card>
      <CardHeader title="Proyectos que lidera" subtitle={`${q.data.total} en total`} />
      <ul className="divide-y divide-border">
        {q.data.items.map((p) => (
          <li key={p.id_proyecto} className="flex items-center justify-between gap-3 px-5 py-3">
            <Link to={`/proyectos/${p.id_proyecto}`} className="truncate text-sm font-medium hover:text-brand hover:underline">{p.nombre_proyecto}</Link>
            <EstadoBadge value={p.estado_proyecto} />
          </li>
        ))}
      </ul>
    </Card>
  )
}

function EquipoDirectoCard({ id }: { id: number }) {
  const q = useUsuarios({ id_jefe: id, activo: true })
  const cap = useCapacidad({ semanas: 1 })
  const porId = new Map(cap.data?.map((c) => [c.id_usuario, c.semanas[0]]))
  if (!q.data?.length) return null
  return (
    <Card>
      <CardHeader title="Equipo directo" subtitle={`${q.data.length} ${q.data.length === 1 ? 'persona' : 'personas'}`} />
      <ul className="divide-y divide-border">
        {q.data.map((p) => (
          <li key={p.id_usuario} className="flex items-center gap-3 px-5 py-2.5">
            <RecursoAvatar usuario={p} className="size-7" />
            <Link to={`/equipo/${p.id_usuario}`} className="min-w-0 flex-1 truncate text-sm hover:text-brand hover:underline">{p.nombre}</Link>
            <UtilizacionBar semana={porId.get(p.id_usuario)} className="w-28 min-w-0" />
          </li>
        ))}
      </ul>
    </Card>
  )
}

function AusenciasCard({ id, editable }: { id: number; editable: boolean }) {
  const q = useAusencias(id)
  const remove = useDeleteAusencia(id)
  const hoy = todayISO()
  const proximas = (q.data ?? []).filter((a) => a.fecha_fin >= hoy)
  return (
    <Card>
      <CardHeader title="Ausencias" subtitle="Vigentes y próximas" />
      {q.isPending ? <div className="p-5"><Skeleton className="h-12" /></div> : proximas.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">Sin ausencias programadas.</p>
      ) : (
        <ul className="divide-y divide-border">
          {proximas.map((a) => (
            <li key={a.id_ausencia} className="flex items-center gap-3 py-2 pr-2 pl-5">
              <CalendarOff className="size-4 shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{a.tipo}</p>
                <p className="text-xs text-muted">{formatDate(a.fecha_inicio)}{a.fecha_fin !== a.fecha_inicio && ` – ${formatDate(a.fecha_fin)}`}{a.nota && ` · ${a.nota}`}</p>
              </div>
              {editable && (
                <IconButton label={`Eliminar ausencia ${a.tipo}`} disabled={remove.isPending} onClick={() => remove.mutate(a.id_ausencia)}>
                  <Trash2 className="size-4" />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

const ETIQUETAS: Record<string, string> = {
  tipo_recurso: 'Tipo', nombre: 'Nombre', correo: 'Correo', id_puesto: 'Puesto', departamento: 'Departamento', id_jefe: 'Jefe',
  rol: 'Rol', capacidad_horas_semanales: 'Capacidad', porcentaje_proyectos: 'Dedicación', costo_hora: 'Costo/h',
  proveedor: 'Proveedor', fecha_fin_contrato: 'Fin de contrato', activo: 'Activo', skills: 'Skills',
}

function BitacoraCard({ id }: { id: number }) {
  const q = useBitacoraPersona(id)
  return (
    <Card>
      <CardHeader title="Historial de cambios" />
      {q.isPending ? <div className="p-5"><Skeleton className="h-16" /></div> : !q.data?.length ? (
        <p className="px-5 py-4 text-sm text-muted">Sin cambios registrados.</p>
      ) : (
        <ol className="space-y-4 p-5">
          {q.data.map((b) => (
            <li key={b.id_bitacora} className="relative flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted"><History className="size-3.5" aria-hidden /></span>
              <div className="min-w-0 text-sm">
                <p className="text-fg">{b.cambios ? `Editó: ${Object.keys(b.cambios).map((k) => ETIQUETAS[k] ?? k).join(', ')}` : b.resumen}</p>
                {b.cambios?.skills && <p className="truncate text-xs text-muted" title={String(b.cambios.skills[1])}>Skills: {String(b.cambios.skills[1]) || '—'}</p>}
                <p className="text-xs text-muted">{b.actor_nombre} · {formatDateTime(b.fecha)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const x = new Date(y, m - 1, d + dias)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
