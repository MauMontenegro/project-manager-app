import { useEquipoTrabajoActivo } from '@/features/equipos-trabajo/EquipoTrabajoActivo'
import { useMemo, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCapacidad, usePuestos, useSkills, useUsuarios } from '@/api/hooks'
import { Button, IconButton } from '@/components/ui/Button'
import { FilterSelect } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Card } from '@/components/ui/Layout'
import { cn } from '@/lib/cn'
import { BANDAS, bandaSemana, formatSemana, formatUtilizacion, lunesISO, semanaLibre, type Banda } from '@/lib/capacidad'
import { formatHours, num } from '@/lib/format'
import { DEPARTAMENTOS, type Departamento, type SemanaCapacidad, type Usuario } from '@/types/api'
import { RecursoAvatar } from './RecursoAvatar'

type Orden = 'nombre' | 'carga' | 'libre'
interface Hover { x: number; y: number; persona: Usuario; semana: SemanaCapacidad }

const pico = (semanas: SemanaCapacidad[]) =>
  Math.max(0, ...semanas.map((s) => (s.utilizacion === null ? (num(s.horas_asignadas) > 0 ? 999 : 0) : num(s.utilizacion))))

/**
 * Mapa de calor personas × semanas: responde «¿quién está libre y cuándo?».
 * Cada celda muestra el % (el color refuerza, no sustituye, al número).
 */
export function DisponibilidadTab() {
  const [offset, setOffset] = useState(0)
  const [semanas, setSemanas] = useState('12')
  const [departamento, setDepartamento] = useState('')
  const [skill, setSkill] = useState('')
  const [orden, setOrden] = useState<Orden>('nombre')
  const [hover, setHover] = useState<Hover | null>(null)

  const hoy = lunesISO()
  const desde = lunesISO(new Date(), offset)
  const capacidad = useCapacidad({
    desde, semanas: Number(semanas), departamento: (departamento || undefined) as Departamento | undefined, skill: skill || undefined,
  })
  const usuarios = useUsuarios({ activo: true })
  const puestos = usePuestos()
  const skills = useSkills()
  const personas = new Map(usuarios.data?.map((u) => [u.id_usuario, u]))
  const puestoNombre = new Map(puestos.data?.map((p) => [p.id_puesto, p.nombre_puesto]))

  const { id: equipoActivo, miembros } = useEquipoTrabajoActivo()
  const filas = useMemo(() => {
    const lista = (capacidad.data ?? []).flatMap((c) => {
      const persona = personas.get(c.id_usuario)
      return persona && (equipoActivo == null || miembros.has(c.id_usuario)) ? [{ persona, ...c }] : []
    })
    if (orden === 'carga') lista.sort((a, b) => pico(b.semanas) - pico(a.semanas))
    else if (orden === 'libre') lista.sort((a, b) => pico(a.semanas) - pico(b.semanas))
    return lista
  }, [capacidad.data, usuarios.data, orden, equipoActivo, miembros]) // eslint-disable-line react-hooks/exhaustive-deps

  const columnas = capacidad.data?.[0]?.semanas.map((s) => s.inicio) ?? []
  const sobreasignados = columnas.map((_, i) => filas.filter((f) => bandaSemana(f.semanas[i]) === 'sobrecarga').length)
  const hasta = columnas.at(-1)

  const mostrar = (e: MouseEvent, persona: Usuario, semana: SemanaCapacidad) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setHover({ x: r.left + r.width / 2, y: r.top, persona, semana })
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
        <div className="flex items-center gap-1 rounded-lg border border-border-strong p-0.5">
          <IconButton label="Semanas anteriores" className="size-8" onClick={() => setOffset((o) => o - 4)}><ChevronLeft className="size-4" /></IconButton>
          <Button size="sm" variant="ghost" onClick={() => setOffset(0)} disabled={offset === 0}>Hoy</Button>
          <IconButton label="Semanas siguientes" className="size-8" onClick={() => setOffset((o) => o + 4)}><ChevronRight className="size-4" /></IconButton>
        </div>
        {hasta && (
          <span className="flex items-center gap-1.5 px-1 text-sm text-muted">
            <CalendarRange className="size-4" aria-hidden /> {formatSemana(desde)} – {formatSemana(hasta)}
          </span>
        )}
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <FilterSelect label="Horizonte" value={semanas} onChange={setSemanas}>
            {['8', '12', '16', '26'].map((n) => <option key={n} value={n}>{n} semanas</option>)}
          </FilterSelect>
          <FilterSelect label="Departamento" value={departamento} onChange={setDepartamento}>
            <option value="">Todos los departamentos</option>
            {DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}
          </FilterSelect>
          <FilterSelect label="Skill" value={skill} onChange={setSkill}>
            <option value="">Cualquier skill</option>
            {skills.data?.map((s) => <option key={s.id_skill}>{s.nombre}</option>)}
          </FilterSelect>
          <FilterSelect label="Ordenar" value={orden} onChange={(v) => setOrden(v as Orden)}>
            <option value="nombre">Por nombre</option>
            <option value="libre">Más disponibles primero</option>
            <option value="carga">Más cargados primero</option>
          </FilterSelect>
        </div>
      </div>

      <Leyenda />

      {capacidad.isPending || usuarios.isPending ? (
        <div className="space-y-2 p-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
      ) : capacidad.isError ? (
        <ErrorState error={capacidad.error} onRetry={() => capacidad.refetch()} />
      ) : filas.length === 0 ? (
        <EmptyState icon={<CalendarRange className="size-6" />} title="Sin recursos para mostrar" description="Ajusta los filtros." />
      ) : (
        <div className={cn('overflow-x-auto pb-2', capacidad.isPlaceholderData && 'opacity-60 transition-opacity')} onMouseLeave={() => setHover(null)}>
          <table className="w-full border-separate border-spacing-[3px] px-3 text-sm">
            <caption className="sr-only">Utilización semanal por persona. Cada celda indica el porcentaje de su capacidad planificable asignado esa semana.</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-surface px-2 py-2 text-left text-xs font-medium tracking-wide text-muted uppercase">Recurso</th>
                {columnas.map((c) => (
                  <th key={c} scope="col" className={cn('min-w-14 px-1 py-2 text-center text-xs font-medium whitespace-nowrap', c === hoy ? 'text-brand' : 'text-muted')}>
                    {formatSemana(c)}
                    {c === hoy && <span className="mx-auto mt-1 block h-0.5 w-6 rounded-full bg-brand" aria-label="(esta semana)" />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map(({ persona, semanas: detalle }) => (
                <tr key={persona.id_usuario}>
                  <th scope="row" className="sticky left-0 z-10 max-w-56 bg-surface px-2 py-1 text-left font-normal">
                    <div className="flex items-center gap-2.5">
                      <RecursoAvatar usuario={persona} className="size-7" />
                      <div className="min-w-0">
                        <Link to={`/equipo/${persona.id_usuario}`} className="block truncate text-sm font-medium text-fg hover:text-brand hover:underline">{persona.nombre}</Link>
                        <p className="truncate text-xs text-muted">{(persona.id_puesto && puestoNombre.get(persona.id_puesto)) || persona.tipo_recurso}</p>
                      </div>
                    </div>
                  </th>
                  {detalle.map((s) => {
                    const banda = bandaSemana(s)
                    return (
                      <td key={s.inicio} className="p-0"
                        onMouseEnter={(e) => mostrar(e, persona, s)}
                        aria-label={`${persona.nombre}, semana del ${formatSemana(s.inicio)}: ${formatUtilizacion(s)}, ${BANDAS[banda].label}`}>
                        <div className={cn(
                          'flex h-9 items-center justify-center rounded-[4px] text-xs font-medium tabular-nums transition-[filter] hover:brightness-95',
                          semanaLibre(s) ? 'bg-surface-2/70 text-muted/70' : BANDAS[banda].cell,
                          s.inicio === hoy && 'ring-2 ring-brand/40',
                          s.dias_ausencia > 0 && banda !== 'sobrecarga' && 'bg-[repeating-linear-gradient(45deg,transparent_0_4px,rgb(0_0_0/0.06)_4px_6px)]',
                        )}>
                          {formatUtilizacion(s)}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="sticky left-0 z-10 bg-surface px-2 pt-3 text-left text-xs font-medium text-muted">Sobreasignados</th>
                {sobreasignados.map((n, i) => (
                  <td key={columnas[i]} className={cn('pt-3 text-center text-xs tabular-nums', n > 0 ? 'font-semibold text-danger' : 'text-muted')}>{n}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {hover && <Tooltip {...hover} />}
    </Card>
  )
}

function Leyenda() {
  const orden: Banda[] = ['disponible', 'saludable', 'al-limite', 'sobrecarga', 'ausente']
  return (
    <ul aria-label="Leyenda" className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3 pb-1 text-xs text-muted">
      {orden.map((b) => (
        <li key={b} className="flex items-center gap-1.5">
          <span className={cn('size-3 rounded-[3px]', BANDAS[b].cell)} aria-hidden /> {BANDAS[b].label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-[3px] border border-border bg-[repeating-linear-gradient(45deg,transparent_0_2px,rgb(0_0_0/0.25)_2px_3px)]" aria-hidden />
        Con ausencias
      </li>
    </ul>
  )
}

function Tooltip({ x, y, persona, semana }: Hover) {
  const banda = BANDAS[bandaSemana(semana)]
  return (
    <div role="tooltip" style={{ left: x, top: y }}
      className="pointer-events-none fixed z-50 w-56 -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-lg border border-border bg-surface p-3 text-xs shadow-lg">
      <p className="font-semibold text-fg">{persona.nombre}</p>
      <p className="text-muted">Semana del {formatSemana(semana.inicio)}</p>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
        <dt className="text-muted">Utilización</dt><dd className="text-right font-medium text-fg tabular-nums">{formatUtilizacion(semana)}</dd>
        <dt className="text-muted">Asignadas</dt><dd className="text-right text-fg tabular-nums">{formatHours(semana.horas_asignadas)}</dd>
        <dt className="text-muted">Disponibles</dt><dd className="text-right text-fg tabular-nums">{formatHours(semana.horas_disponibles)}</dd>
        {semana.dias_ausencia > 0 && <><dt className="text-muted">Ausencia</dt><dd className="text-right text-fg">{semana.dias_ausencia} día(s)</dd></>}
        {num(semana.horas_operacion_asignadas) > 0 && <>
          <dt className="text-muted">Operación</dt>
          <dd className={cn('text-right tabular-nums', num(semana.horas_operacion_asignadas) > num(semana.horas_operacion_disponibles) ? 'text-danger' : 'text-fg')}>
            {formatHours(semana.horas_operacion_asignadas)} / {formatHours(semana.horas_operacion_disponibles)}
          </dd>
        </>}
      </dl>
      <p className="mt-2 border-t border-border pt-2 text-muted">{banda.label}</p>
    </div>
  )
}
