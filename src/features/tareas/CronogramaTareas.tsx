import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, GanttChart, Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/Feedback'
import { Card } from '@/components/ui/Layout'
import { cn } from '@/lib/cn'
import { formatHours } from '@/lib/format'
import { DEPARTAMENTOS_PROYECTO, fechaFinProyecto, parteTarea, type Etapa, type ProyectoDetalle, type Tarea } from '@/types/api'
import { nombreRelacionada } from './KanbanBoard'
import {
  aDia, diaSemana, fechaDe, hoyDia, LeyendaEstados, mayuscula, puntoEstado, rangoTarea, tonoBarra, useDiaInhabil, vencida,
} from './fechas'

type Escala = 'ajustar' | 'dia' | 'semana' | 'mes'
const ESCALAS: { id: Escala; label: string; px: number }[] = [
  { id: 'ajustar', label: 'Ajustar', px: 0 },
  { id: 'dia', label: 'Días', px: 44 },
  { id: 'semana', label: 'Semanas', px: 22 },
  { id: 'mes', label: 'Meses', px: 7 },
]
const FILA = 48
const CABECERA = 56
/** Ancho de la columna de nombres en escritorio (para ajustar la escala al espacio visible). */
const IZQ = 288
const INICIALES = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-MX', { ...o, timeZone: 'UTC' })
const mesLargo = fmt({ month: 'long', year: 'numeric' })
const mesCorto = fmt({ month: 'short' })
const anio = fmt({ year: 'numeric' })
const diaMes = fmt({ day: 'numeric', month: 'short' })
const corta = (d: number) => diaMes.format(fechaDe(d)).replace('.', '')
/** Día (número) local de un instante ISO. */
const diaLocal = (iso: string) => { const f = new Date(iso); return Date.UTC(f.getFullYear(), f.getMonth(), f.getDate()) / 86_400_000 }
/** Rayado de los tramos bloqueados (mismo en la leyenda). */
const RAYADO = { backgroundImage: 'repeating-linear-gradient(135deg, rgb(239 68 68 / 0.85) 0 3px, transparent 3px 6px)' }

type Rango = [number, number]
type FilaGrupo = { tipo: 'grupo'; clave: string; nombre: string; rango: Rango; total: number; hechas: number }
type FilaTarea = { tipo: 'tarea'; t: Tarea; rango: Rango }
type Fila = FilaGrupo | FilaTarea

/** Grupos del cronograma: etapas del proyecto o, en la vista general de un conjunto, sus partes
 * (General y un grupo por departamento, en ese orden). */
const grupoDe = {
  etapa: (t: Tarea) => ({ clave: String(t.orden_etapa ?? 0), orden: t.orden_etapa ?? 0 }),
  parte: (t: Tarea) => ({ clave: parteTarea(t), orden: t.departamento ? DEPARTAMENTOS_PROYECTO.indexOf(t.departamento) + 1 : 0 }),
}

/** Diagrama de Gantt: una barra por tarea (inicio → fecha límite), agrupadas por etapa (o por parte del
 * conjunto con `agruparPor="parte"`), con sus dependencias. */
export function CronogramaTareas({ tareas, etapas, proyecto, onAbrir, agruparPor = 'etapa' }: {
  tareas: Tarea[]
  etapas: Etapa[]
  proyecto: ProyectoDetalle
  onAbrir: (t: Tarea) => void
  agruparPor?: 'etapa' | 'parte'
}) {
  const [elegida, setElegida] = useState<Escala>('ajustar')
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set())
  const [foco, setFoco] = useState<number | null>(null)
  const [tip, setTip] = useState<{ t: Tarea; x: number; y: number } | null>(null)
  const [visible, setVisible] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const markerId = useId().replace(/[^\w-]/g, '')
  const inhabil = useDiaInhabil()
  const hoy = hoyDia()
  const pInicio = proyecto.fecha_inicio ? aDia(proyecto.fecha_inicio) : null
  const pFinIso = fechaFinProyecto(proyecto)
  const pFin = pFinIso ? aDia(pFinIso) : null

  const { grupos, sinFechas, inicio, finDatos } = useMemo(() => {
    const conRango = tareas.flatMap((t) => { const r = rangoTarea(t); return r ? [{ t, rango: r }] : [] })
    const sinFechas = tareas.filter((t) => !rangoTarea(t))
    const claves = new Map(conRango.map((x) => { const g = grupoDe[agruparPor](x.t); return [g.clave, g.orden] }))
    const grupos = [...claves].sort((a, b) => a[1] - b[1]).map(([clave, orden]) => {
      const de: FilaTarea[] = conRango.filter((x) => grupoDe[agruparPor](x.t).clave === clave)
        .sort((a, b) => a.rango[0] - b.rango[0] || a.rango[1] - b.rango[1]).map((x) => ({ tipo: 'tarea', ...x }))
      const grupo: FilaGrupo = {
        tipo: 'grupo', clave,
        nombre: agruparPor === 'parte' ? clave : `${orden}. ${etapas.find((e) => e.orden_secuencia === orden)?.nombre_etapa ?? `Etapa ${orden}`}`,
        rango: [Math.min(...de.map((x) => x.rango[0])), Math.max(...de.map((x) => x.rango[1]))],
        total: de.length, hechas: de.filter((x) => x.t.estado === 'Finalizado').length,
      }
      return { grupo, tareas: de }
    })
    if (!conRango.length) return { grupos, sinFechas, inicio: 0, finDatos: 0 }
    const puntos = [
      ...conRango.flatMap((x) => x.rango), ...[pInicio, pFin].filter((d): d is number => d !== null),
      ...conRango.flatMap((x) => [x.t.fecha_inicio_base, x.t.fecha_fin_base].flatMap((f) => (f ? [aDia(f)] : []))),
    ]
    let inicio = Math.min(...puntos) - 2
    inicio -= (diaSemana(inicio) + 6) % 7 // desde un lunes
    return { grupos, sinFechas, inicio, finDatos: Math.max(...puntos) + 3 }
  }, [tareas, etapas, pInicio, pFin, agruparPor])

  // "Ajustar" estira el plan completo al ancho visible; la cabecera usa días, semanas o meses según el espacio.
  const util = Math.max(visible - IZQ, 320)
  const px = elegida === 'ajustar'
    ? Math.min(Math.max(util / (finDatos - inicio + 1), 8), 60)
    : ESCALAS.find((e) => e.id === elegida)!.px
  const escala = { id: px >= 30 ? 'dia' : px >= 10 ? 'semana' : 'mes' } as const
  const fin = Math.max(finDatos, inicio + Math.ceil(util / px)) // la línea de tiempo llena el ancho visible
  const x = (dia: number) => (dia - inicio) * px

  const filas: Fila[] = grupos.flatMap((g) => [g.grupo, ...(colapsadas.has(g.grupo.clave) ? [] : g.tareas)])
  const alto = filas.length * FILA
  const hayHoy = hoy >= inicio && hoy <= fin

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setVisible(el.clientWidth)
    const obs = new ResizeObserver(() => setVisible(el.clientWidth))
    obs.observe(el)
    return () => obs.disconnect()
  }, [grupos.length > 0])

  const irA = (dia: number, suave = true) => {
    const el = scrollRef.current
    if (el) el.scrollTo({ left: Math.max((dia - inicio) * px - (el.clientWidth - IZQ) / 3, 0), behavior: suave ? 'smooth' : 'auto' })
  }
  // Al abrir o cambiar de escala, muestra el día de hoy si cae en el plan.
  useEffect(() => { if (hayHoy) irA(hoy, false) }, [px, inicio]) // eslint-disable-line react-hooks/exhaustive-deps

  const alternar = (clave: string) => setColapsadas((s) => {
    const n = new Set(s)
    if (!n.delete(clave)) n.add(clave)
    return n
  })

  const listaSinFechas = sinFechas.length > 0 && (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="text-muted">Sin fechas (asígnalas para verlas en el cronograma):</span>
      {sinFechas.map((t) => (
        <button key={t.id_tarea} type="button" onClick={() => onAbrir(t)}
          className="rounded-full border border-border px-2.5 py-0.5 text-xs hover:border-brand hover:text-brand">{t.titulo}</button>
      ))}
    </div>
  )

  if (!grupos.length) {
    return (
      <div className="space-y-3">
        <Card>
          <EmptyState icon={<GanttChart className="size-6" />} title="Nada que mostrar en el cronograma"
            description="Las tareas aparecen aquí cuando tienen fecha de inicio o fecha límite." />
        </Card>
        {listaSinFechas}
      </div>
    )
  }

  const dias = Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i)
  // Cabecera: arriba meses (o años en escala mensual); abajo días, semanas o meses.
  const grupoArriba = (d: number) => escala.id === 'mes' ? fechaDe(d).getUTCMonth() === 0 && fechaDe(d).getUTCDate() === 1 : fechaDe(d).getUTCDate() === 1
  const segmentos = dias.filter((d, i) => i === 0 || grupoArriba(d))
  const marcas = escala.id === 'dia' ? dias : escala.id === 'semana' ? dias.filter((d) => diaSemana(d) === 1) : dias.filter((d) => fechaDe(d).getUTCDate() === 1)

  const filaDe = new Map(filas.flatMap((f, i) => (f.tipo === 'tarea' ? [[f.t.id_tarea, i] as const] : [])))
  const relacionadas = new Set<number>()
  const flechas = filas.flatMap((f, i) => {
    if (f.tipo !== 'tarea') return []
    return f.t.dependencias.flatMap((d) => {
      const j = filaDe.get(d.id_tarea)
      const dep = j === undefined ? undefined : filas[j]
      if (j === undefined || dep?.tipo !== 'tarea') return []
      const activa = foco === f.t.id_tarea || foco === d.id_tarea
      if (activa) { relacionadas.add(f.t.id_tarea); relacionadas.add(d.id_tarea) }
      const [x1, y1, x2, y2] = [x(dep.rango[1] + 1) - 1, j * FILA + FILA / 2, x(f.rango[0]) + 1, i * FILA + FILA / 2]
      const r = 5
      const dir = y2 > y1 ? 1 : -1
      // Codo con esquinas redondeadas; si la tarea empieza antes, rodea por la frontera entre filas.
      const camino = x2 >= x1 + 16
        ? `M${x1},${y1} H${x1 + 8 - r} q${r},0 ${r},${r * dir} V${y2 - r * dir} q0,${r * dir} ${r},${r * dir} H${x2}`
        : `M${x1},${y1} h8 V${i * FILA + (dir > 0 ? 0 : FILA)} H${x2 - 10} V${y2} H${x2}`
      return [{ clave: `${d.id_tarea}-${f.t.id_tarea}`, camino, conflicto: f.rango[0] <= dep.rango[1], activa }]
    })
  })
  const atenuar = foco !== null

  // Banderas Hoy / Inicio / Fin: si se enciman, la siguiente baja un nivel.
  const banderas = [
    ...(pInicio !== null ? [{ d: pInicio, texto: 'Inicio', clase: 'bg-emerald-600 text-white' }] : []),
    ...(pFin !== null ? [{ d: pFin + 1, texto: 'Fin', clase: 'bg-amber-500 text-amber-950' }] : []),
    ...(hayHoy ? [{ d: hoy + 0.5, texto: 'Hoy', clase: 'bg-red-500 text-white' }] : []),
  ].sort((a, b) => a.d - b.d).reduce<{ d: number; texto: string; clase: string; nivel: number }[]>((acc, b) => {
    const choca = (n: number) => acc.some((p) => p.nivel === n && Math.abs(x(p.d) - x(b.d)) < (p.texto.length + b.texto.length) * 3.2 + 14)
    return [...acc, { ...b, nivel: choca(0) ? (choca(1) ? 2 : 1) : 0 }]
  }, [])
  const nivelesBanderas = Math.max(0, ...banderas.map((b) => b.nivel)) + 1

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Escala del cronograma" className="inline-flex rounded-lg border border-border p-0.5">
          {ESCALAS.map((e) => (
            <button key={e.id} type="button" aria-pressed={elegida === e.id} onClick={() => setElegida(e.id)}
              title={e.id === 'ajustar' ? 'Todo el plan a lo ancho de la pantalla' : undefined}
              className={cn('rounded-md px-3 py-1 text-xs font-medium transition-colors',
                elegida === e.id ? 'bg-brand-soft text-brand' : 'text-muted hover:text-fg')}>{e.label}</button>
          ))}
        </div>
        <Button size="sm" onClick={() => irA(hoy)} disabled={!hayHoy}>Ir a hoy</Button>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 xl:ml-auto">
          <LeyendaEstados />
          {tareas.some((t) => t.fecha_fin_base && t.fecha_fin_base !== t.fecha_fin) && (
            <span className="flex items-center gap-1.5 text-xs text-muted"><span className="h-1.5 w-5 rounded-full bg-slate-400/60" aria-hidden />Plan original</span>
          )}
          {tareas.some((t) => t.periodos_bloqueo.length > 0) && (
            <span className="flex items-center gap-1.5 text-xs text-muted"><span className="h-3 w-5 rounded-sm" style={RAYADO} aria-hidden />Bloqueada</span>
          )}
          {flechas.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <svg width="22" height="8" aria-hidden><path d="M0,4 H18" className="stroke-muted" strokeWidth="1.5" /><path d="M16,1 L21,4 L16,7 z" className="fill-muted" /></svg>
              Dependencia
            </span>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div ref={scrollRef} className="overflow-x-auto" onScroll={() => setTip(null)}>
          <div className="flex w-max min-w-full">
            {/* Columna fija con los nombres */}
            <div className="sticky left-0 z-30 w-52 shrink-0 border-r border-border bg-surface shadow-[4px_0_8px_-6px_rgb(0_0_0/0.25)] sm:w-72">
              <div style={{ height: CABECERA + nivelesBanderas * 16 + 3 }} className="flex items-end justify-between border-b border-border px-4 pb-2 text-xs font-medium text-muted">
                <span>Tarea</span><span>{tareas.length - sinFechas.length} con fechas</span>
              </div>
              {filas.map((f) => f.tipo === 'grupo' ? (
                <button key={`g${f.clave}`} type="button" onClick={() => alternar(f.clave)} aria-expanded={!colapsadas.has(f.clave)}
                  style={{ height: FILA }} className="flex w-full items-center gap-2 border-b border-border bg-surface-2 px-3 text-left hover:bg-neutral-soft">
                  {colapsadas.has(f.clave) ? <ChevronRight className="size-4 shrink-0 text-muted" /> : <ChevronDown className="size-4 shrink-0 text-muted" />}
                  <span className="flex-1 truncate text-sm font-semibold">{f.nombre}</span>
                  <span className="text-xs text-muted tabular-nums">{f.hechas}/{f.total}</span>
                </button>
              ) : (
                <div key={f.t.id_tarea} style={{ height: FILA }}
                  onMouseEnter={() => setFoco(f.t.id_tarea)} onMouseLeave={() => setFoco(null)}
                  className={cn('flex items-center gap-2.5 border-b border-border pr-3 pl-5 transition-colors',
                    foco === f.t.id_tarea && 'bg-brand-soft/60', atenuar && foco !== f.t.id_tarea && !relacionadas.has(f.t.id_tarea) && 'opacity-60')}>
                  <span className={cn('size-2.5 shrink-0 rounded-full', puntoEstado[f.t.estado])} title={f.t.estado} />
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => onAbrir(f.t)}
                      className={cn('block w-full truncate text-left text-sm font-medium hover:text-brand hover:underline',
                        f.t.estado === 'Finalizado' && 'text-muted line-through')}>{f.t.titulo}</button>
                    <p className="truncate text-xs text-muted">
                      {corta(f.rango[0])}{f.rango[1] !== f.rango[0] && ` – ${corta(f.rango[1])}`} · {f.t.nombre_usuario.split(' ')[0]}
                      {agruparPor === 'parte' && f.t.nombre_etapa && ` · ${f.t.nombre_etapa}`}
                    </p>
                  </div>
                  {vencida(f.t) && <AlertTriangle className="size-4 shrink-0 text-red-500" aria-label="Vencida" />}
                </div>
              ))}
            </div>

            {/* Línea de tiempo */}
            <div className="relative flex-1" style={{ minWidth: (fin - inicio + 1) * px }}>
              <div className="relative border-b border-border">
                <div className="relative h-7 border-b border-border">
                  {segmentos.map((m, k) => {
                    const largo = (segmentos[k + 1] ?? fin + 1) - m
                    const texto = escala.id === 'mes' ? anio.format(fechaDe(m)) : largo * px > 120 ? mesLargo.format(fechaDe(m)) : mesCorto.format(fechaDe(m))
                    return (
                      <div key={m} className="absolute inset-y-0 flex items-center overflow-hidden border-l border-border px-2 text-xs font-semibold whitespace-nowrap"
                        style={{ left: x(m), width: largo * px }}>{largo * px > 28 && mayuscula(texto)}</div>
                    )
                  })}
                </div>
                <div className="relative h-7 border-b border-border/60 text-[11px] text-muted tabular-nums">
                  {marcas.map((d) => (
                    <span key={d} className={cn('absolute inset-y-0 flex items-center whitespace-nowrap',
                      escala.id === 'dia' ? 'justify-center' : 'border-l border-border pl-1.5',
                      escala.id === 'dia' && inhabil(d) && 'opacity-50', d === hoy && 'font-semibold text-red-500')}
                      style={{ left: x(d), width: escala.id === 'dia' ? px : undefined }}>
                      {escala.id === 'dia' ? `${INICIALES[diaSemana(d)]} ${fechaDe(d).getUTCDate()}`
                        : escala.id === 'semana' ? corta(d) : mayuscula(mesCorto.format(fechaDe(d)).replace('.', ''))}
                    </span>
                  ))}
                </div>
                <div className="relative" style={{ height: nivelesBanderas * 16 + 2 }}>
                  {banderas.map((b) => (
                    <span key={b.texto} className={cn('absolute z-10 -translate-x-1/2 rounded px-1.5 text-[10px] leading-[14px] font-semibold whitespace-nowrap', b.clase)}
                      style={{ left: x(b.d), top: 1 + b.nivel * 16 }}>{b.texto}</span>
                  ))}
                </div>
              </div>

              <div className="relative" style={{ height: alto }}>
                {/* Fondo: filas, fines de semana y divisiones */}
                {filas.map((f, i) => (
                  <div key={i} className={cn('absolute inset-x-0 border-b border-border',
                    f.tipo === 'grupo' ? 'bg-surface-2' : foco === f.t.id_tarea && 'bg-brand-soft/40')}
                    style={{ top: i * FILA, height: FILA }} />
                ))}
                {escala.id === 'dia' && dias.filter(inhabil).map((d) => (
                  <div key={d} className="absolute inset-y-0 bg-neutral-soft/60" style={{ left: x(d), width: px }} aria-hidden />
                ))}
                {marcas.map((d) => (
                  <div key={d} className="absolute inset-y-0 border-l border-border/70" style={{ left: x(d) }} aria-hidden />
                ))}
                {pInicio !== null && <div className="absolute inset-y-0 border-l-2 border-dashed border-emerald-500/70" style={{ left: x(pInicio) }} aria-hidden />}
                {pFin !== null && <div className="absolute inset-y-0 border-l-2 border-dashed border-amber-500/80" style={{ left: x(pFin + 1) }} aria-hidden />}
                {hayHoy && <div className="absolute inset-y-0 w-0.5 bg-red-500" style={{ left: x(hoy + 0.5) - 1 }} aria-hidden />}

                {/* Barras */}
                {filas.map((f, i) => {
                  if (f.tipo === 'grupo') {
                    const [a, b] = f.rango
                    const pct = f.total ? f.hechas / f.total : 0
                    return (
                      <div key={`g${f.clave}`} className="absolute z-10 flex items-center gap-2" style={{ top: i * FILA, height: FILA, left: x(a) }}>
                        <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-400/40" style={{ width: Math.max((b - a + 1) * px, 8) }}
                          title={`${f.nombre}: ${corta(a)} – ${corta(b)} · ${f.hechas} de ${f.total} finalizadas`}>
                          <div className="h-full bg-emerald-500" style={{ width: `${pct * 100}%` }} />
                        </div>
                        <span className="text-xs font-medium whitespace-nowrap text-muted">{Math.round(pct * 100)} %</span>
                      </div>
                    )
                  }
                  const [a, b] = f.rango
                  const w = Math.max((b - a + 1) * px - 4, 10)
                  // El nombre va dentro si cabe; si no, a la derecha de la barra.
                  const adentro = w >= f.t.titulo.length * 6.8 + (f.t.bloqueada ? 34 : 18)
                  const t = f.t
                  const atenuada = atenuar && foco !== t.id_tarea && !relacionadas.has(t.id_tarea) && 'opacity-40'
                  // Plan original (si cambió) debajo de la barra y tramos bloqueados encima.
                  const base = t.fecha_inicio_base && t.fecha_fin_base && (t.fecha_inicio_base !== t.fecha_inicio || t.fecha_fin_base !== t.fecha_fin)
                    ? [aDia(t.fecha_inicio_base), aDia(t.fecha_fin_base)] as const : null
                  const extras = (
                    <Fragment key={`x${t.id_tarea}`}>
                      {base && (
                        <div className={cn('absolute z-[9] h-1.5 rounded-full bg-slate-400/60', atenuada)}
                          title={`Plan original: ${corta(base[0])} – ${corta(base[1])}`}
                          style={{ top: i * FILA + FILA - 9, left: x(base[0]) + 2, width: Math.max((base[1] - base[0] + 1) * px - 4, 4) }} />
                      )}
                      {t.periodos_bloqueo.map((pb, k) => {
                        const ini = diaLocal(pb.inicio)
                        const fin = pb.fin ? diaLocal(pb.fin) : hoy
                        return (
                          <div key={k} className={cn('pointer-events-none absolute z-[11] h-3 rounded-sm', atenuada)} style={{
                            ...RAYADO, top: i * FILA + FILA / 2 - 6, left: x(ini) + 2, width: Math.max((fin - ini + 1) * px - 4, 4),
                          }} title={`${pb.causa_raiz}${pb.fin ? '' : ' (abierto)'}`} />
                        )
                      })}
                    </Fragment>
                  )
                  return [extras,
                    <div key={t.id_tarea} className={cn('absolute z-10 flex items-center gap-2 transition-opacity',
                      atenuar && foco !== t.id_tarea && !relacionadas.has(t.id_tarea) && 'opacity-40')}
                      style={{ top: i * FILA, height: FILA, left: x(a) + 2 }}>
                      <button type="button" onClick={() => onAbrir(t)} aria-label={`${t.titulo}: abrir detalle`}
                        onMouseEnter={(e) => { setFoco(t.id_tarea); const r = e.currentTarget.getBoundingClientRect(); setTip({ t, x: r.left, y: r.bottom }) }}
                        onMouseLeave={() => { setFoco(null); setTip(null) }}
                        onFocus={(e) => { setFoco(t.id_tarea); const r = e.currentTarget.getBoundingClientRect(); setTip({ t, x: r.left, y: r.bottom }) }}
                        onBlur={() => { setFoco(null); setTip(null) }}
                        className={cn('flex h-8 shrink-0 items-center gap-1.5 overflow-hidden rounded-md px-2 text-left text-xs font-semibold whitespace-nowrap shadow-sm transition-[filter,box-shadow] hover:shadow-md hover:brightness-110',
                          tonoBarra[t.estado], vencida(t) && 'ring-2 ring-red-500 ring-offset-1 ring-offset-surface',
                          foco === t.id_tarea && 'ring-2 ring-brand ring-offset-1 ring-offset-surface')}
                        style={{ width: w }}>
                        {t.bloqueada && <Lock className="size-3.5 shrink-0" aria-hidden />}
                        {adentro && <span className="truncate">{t.titulo}</span>}
                      </button>
                      {!adentro && <span className="pointer-events-none text-xs font-medium whitespace-nowrap text-fg">{t.titulo}</span>}
                    </div>,
                  ]
                })}

                {flechas.length > 0 && (
                  <svg className="pointer-events-none absolute inset-0 z-20 overflow-visible" width="100%" height={alto} aria-hidden>
                    <defs>
                      {(['normal', 'activa', 'conflicto'] as const).map((c) => (
                        <marker key={c} id={`${markerId}-${c}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                          <path d="M0,0 L8,4 L0,8 z" className={c === 'normal' ? 'fill-slate-400' : c === 'activa' ? 'fill-brand' : 'fill-red-500'} />
                        </marker>
                      ))}
                    </defs>
                    {flechas.map((f) => {
                      const tipo = f.activa ? 'activa' : f.conflicto ? 'conflicto' : 'normal'
                      return (
                        <path key={f.clave} d={f.camino} fill="none" strokeWidth={f.activa ? 2.5 : 1.75} strokeLinejoin="round"
                          className={cn(tipo === 'normal' ? 'stroke-slate-400' : tipo === 'activa' ? 'stroke-brand' : 'stroke-red-500',
                            atenuar && !f.activa && 'opacity-30')}
                          strokeDasharray={f.conflicto && !f.activa ? '5 3' : undefined}
                          markerEnd={`url(#${markerId}-${tipo})`} />
                      )
                    })}
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
      {listaSinFechas}
      {tip && <TarjetaTarea t={tip.t} x={tip.x} y={tip.y} />}
    </div>
  )
}

/** Tarjeta flotante al pasar sobre una barra. */
function TarjetaTarea({ t, x, y }: { t: Tarea; x: number; y: number }) {
  const [a, b] = rangoTarea(t)!
  const dias = b - a + 1
  const pendientes = t.dependencias.filter((d) => d.estado !== 'Finalizado')
  const left = Math.min(Math.max(x, 8), window.innerWidth - 296)
  const arriba = y + 200 > window.innerHeight
  return (
    <div role="tooltip" className="pointer-events-none fixed z-50 w-72 rounded-xl border border-border bg-surface p-3 text-sm shadow-xl"
      style={arriba ? { left, bottom: window.innerHeight - y + 40 } : { left, top: y + 8 }}>
      <div className="flex items-start gap-2">
        <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', puntoEstado[t.estado])} />
        <p className="leading-snug font-semibold">{t.titulo}</p>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted">Estado</dt><dd>{t.estado}{vencida(t) && <span className="font-medium text-red-500"> · vencida</span>}</dd>
        <dt className="text-muted">Fechas</dt><dd>{corta(a)}{dias > 1 && ` – ${corta(b)}`} · {dias} {dias === 1 ? 'día' : 'días'}</dd>
        <dt className="text-muted">Horas</dt><dd>{formatHours(t.horas_asignadas)}</dd>
        <dt className="text-muted">Responsable</dt>
        <dd className="truncate">{t.nombre_usuario}</dd>
      </dl>
      {t.dependencias.length > 0 && (
        <p className={cn('mt-2 text-xs', pendientes.length ? 'text-warn' : 'text-muted')}>
          {pendientes.length ? `🔒 Espera a ${pendientes.map((d) => nombreRelacionada(d, t)).join(', ')}` : `Dependencias terminadas (${t.dependencias.length})`}
        </p>
      )}
      <p className="mt-2 text-[11px] text-muted">Clic para ver el detalle</p>
    </div>
  )
}
