import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight, GanttChart } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/Feedback'
import { Card } from '@/components/ui/Layout'
import { cn } from '@/lib/cn'
import { formatDate, num } from '@/lib/format'
import { fechaFinProyecto, type DepartamentoProyecto, type Proyecto, type ProyectoBase } from '@/types/api'
import { aDia, diaSemana, fechaDe, hoyDia, mayuscula } from '@/features/tareas/fechas'
import { cerrado, diasRetraso, LeyendaProyectos, rangoProyecto, tonoProyecto } from './fechasProyecto'

type Escala = 'ajustar' | 'semana' | 'mes' | 'trimestre'
const ESCALAS: { id: Escala; label: string; px: number }[] = [
  { id: 'ajustar', label: 'Ajustar', px: 0 },
  { id: 'semana', label: 'Semanas', px: 20 },
  { id: 'mes', label: 'Meses', px: 6 },
  { id: 'trimestre', label: 'Trimestres', px: 2.5 },
]
const FILA = 52
const CABECERA = 56
/** Ancho de la columna de nombres en escritorio (para ajustar la escala al espacio visible). */
const IZQ = 320

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-MX', { ...o, timeZone: 'UTC' })
const mesLargo = fmt({ month: 'long', year: 'numeric' })
const mesCorto = fmt({ month: 'short' })
const anio = fmt({ year: 'numeric' })
const diaMes = fmt({ day: 'numeric', month: 'short' })
const corta = (d: number) => diaMes.format(fechaDe(d)).replace('.', '')

type Rango = [number, number]
type Fila = { p: ProyectoBase; rango: Rango | null; anidado: boolean; atenuado: boolean; subproyectos: number }

/** Diagrama de Gantt del portafolio: una barra por proyecto (inicio → entrega o cierre) con su avance y el color
 * de su semáforo. Los conjuntos se despliegan con sus subproyectos; en el espacio de un departamento se abren por
 * defecto y atenúan los subproyectos de otros departamentos. */
export function CronogramaProyectos({ proyectos, departamento, lider }: {
  proyectos: Proyecto[]
  departamento?: DepartamentoProyecto
  lider: (id: number) => string
}) {
  const [elegida, setElegida] = useState<Escala>('ajustar')
  const [abiertos, setAbiertos] = useState<Set<number>>(
    () => new Set(departamento ? proyectos.filter((p) => p.es_conjunto).map((p) => p.id_proyecto) : []),
  )
  const [tip, setTip] = useState<{ p: ProyectoBase; x: number; y: number } | null>(null)
  const [visible, setVisible] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const hoy = hoyDia()

  // Primero los que tienen fechas, por inicio; al final los que no.
  const ordenados = useMemo(() => [...proyectos].sort((a, b) => {
    const ra = rangoProyecto(a), rb = rangoProyecto(b)
    return (ra ? ra[0] : Infinity) - (rb ? rb[0] : Infinity) || a.nombre_proyecto.localeCompare(b.nombre_proyecto)
  }), [proyectos])

  const filas: Fila[] = ordenados.flatMap((p) => [
    { p, rango: rangoProyecto(p), anidado: false, atenuado: false, subproyectos: p.subproyectos.length },
    ...(p.es_conjunto && abiertos.has(p.id_proyecto) ? p.subproyectos.map((s) => ({
      p: s, rango: rangoProyecto(s), anidado: true, atenuado: !!departamento && s.departamento !== departamento, subproyectos: 0,
    })) : []),
  ])

  const { inicio, finDatos } = useMemo(() => {
    const puntos = proyectos.flatMap((p) => [p, ...p.subproyectos]).flatMap((p) => rangoProyecto(p) ?? [])
    if (!puntos.length) return { inicio: 0, finDatos: 0 }
    puntos.push(hoy)
    let inicio = Math.min(...puntos) - 7
    inicio -= (diaSemana(inicio) + 6) % 7 // desde un lunes
    return { inicio, finDatos: Math.max(...puntos) + 14 }
  }, [proyectos, hoy])

  // "Ajustar" estira el portafolio al ancho visible; la cabecera usa semanas, meses o trimestres según el espacio.
  const util = Math.max(visible - IZQ, 320)
  const px = elegida === 'ajustar'
    ? Math.min(Math.max(util / (finDatos - inicio + 1), 1.5), 30)
    : ESCALAS.find((e) => e.id === elegida)!.px
  const escala: Escala = px >= 10 ? 'semana' : px >= 4 ? 'mes' : 'trimestre'
  const fin = Math.max(finDatos, inicio + Math.ceil(util / px)) // la línea de tiempo llena el ancho visible
  const x = (dia: number) => (dia - inicio) * px
  const alto = filas.length * FILA
  const conFechas = filas.some((f) => f.rango)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setVisible(el.clientWidth)
    const obs = new ResizeObserver(() => setVisible(el.clientWidth))
    obs.observe(el)
    return () => obs.disconnect()
  }, [conFechas])

  const irA = (dia: number, suave = true) => {
    const el = scrollRef.current
    if (el) el.scrollTo({ left: Math.max((dia - inicio) * px - (el.clientWidth - IZQ) / 3, 0), behavior: suave ? 'smooth' : 'auto' })
  }
  useEffect(() => { irA(hoy, false) }, [px, inicio]) // eslint-disable-line react-hooks/exhaustive-deps

  const alternar = (id: number) => setAbiertos((s) => {
    const n = new Set(s)
    if (!n.delete(id)) n.add(id)
    return n
  })

  if (!conFechas) {
    return (
      <EmptyState icon={<GanttChart className="size-6" />} title="Nada que mostrar en el cronograma"
        description="Los proyectos aparecen aquí cuando tienen fecha de inicio y fecha de entrega (tentativa o comprometida)." />
    )
  }

  const dias = Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i)
  // Cabecera: arriba meses (o años); abajo semanas, meses o trimestres.
  const esPrimeroDeMes = (d: number) => fechaDe(d).getUTCDate() === 1
  const grupoArriba = (d: number) => escala === 'semana' ? esPrimeroDeMes(d) : esPrimeroDeMes(d) && fechaDe(d).getUTCMonth() === 0
  const segmentos = dias.filter((d, i) => i === 0 || grupoArriba(d))
  const marcas = escala === 'semana' ? dias.filter((d) => diaSemana(d) === 1)
    : escala === 'mes' ? dias.filter(esPrimeroDeMes)
    : dias.filter((d) => esPrimeroDeMes(d) && fechaDe(d).getUTCMonth() % 3 === 0)
  const textoMarca = (d: number) => escala === 'semana' ? corta(d)
    : escala === 'mes' ? mayuscula(mesCorto.format(fechaDe(d)).replace('.', ''))
    : `T${fechaDe(d).getUTCMonth() / 3 + 1}`

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Escala del cronograma" className="inline-flex rounded-lg border border-border p-0.5">
          {ESCALAS.map((e) => (
            <button key={e.id} type="button" aria-pressed={elegida === e.id} onClick={() => setElegida(e.id)}
              title={e.id === 'ajustar' ? 'Todo el portafolio a lo ancho de la pantalla' : undefined}
              className={cn('rounded-md px-3 py-1 text-xs font-medium transition-colors',
                elegida === e.id ? 'bg-brand-soft text-brand' : 'text-muted hover:text-fg')}>{e.label}</button>
          ))}
        </div>
        <Button size="sm" onClick={() => irA(hoy)}>Ir a hoy</Button>
        <div className="xl:ml-auto"><LeyendaProyectos /></div>
      </div>

      <Card className="overflow-hidden">
        <div ref={scrollRef} className="overflow-x-auto" onScroll={() => setTip(null)}>
          <div className="flex w-max min-w-full">
            {/* Columna fija con los nombres */}
            <div className="sticky left-0 z-30 w-56 shrink-0 border-r border-border bg-surface shadow-[4px_0_8px_-6px_rgb(0_0_0/0.25)] sm:w-80">
              <div style={{ height: CABECERA + 18 }} className="flex items-end justify-between border-b border-border px-4 pb-2 text-xs font-medium text-muted">
                <span>Proyecto</span><span>Avance</span>
              </div>
              {filas.map((f) => {
                const p = f.p
                const retraso = diasRetraso(p)
                return (
                  <div key={p.id_proyecto} style={{ height: FILA }}
                    className={cn('flex items-center gap-2 border-b border-border pr-3', f.anidado ? 'bg-surface-2/40 pl-9' : 'pl-3', f.atenuado && 'opacity-60')}>
                    {!f.anidado && (p.es_conjunto ? (
                      <button type="button" aria-expanded={abiertos.has(p.id_proyecto)} onClick={() => alternar(p.id_proyecto)}
                        aria-label={`${abiertos.has(p.id_proyecto) ? 'Ocultar' : 'Mostrar'} subproyectos de ${p.nombre_proyecto}`}
                        className="rounded p-0.5 text-muted hover:bg-surface-2 hover:text-fg">
                        <ChevronRight className={cn('size-4 transition-transform', abiertos.has(p.id_proyecto) && 'rotate-90')} />
                      </button>
                    ) : <span className="w-5 shrink-0" />)}
                    <span className={cn('size-2.5 shrink-0 rounded-full', tonoProyecto(p).punto)} title={`Semáforo ${p.semaforo}`} />
                    <div className="min-w-0 flex-1">
                      <Link to={`/proyectos/${p.id_proyecto}`}
                        className={cn('block truncate text-sm font-medium hover:text-brand hover:underline', p.estado_proyecto === 'Cancelado' && 'text-muted line-through')}>
                        {f.anidado && p.departamento ? p.departamento : p.nombre_proyecto}
                      </Link>
                      <p className="truncate text-xs text-muted">
                        {lider(p.lider_id)} · {p.es_conjunto ? `Conjunto · ${f.subproyectos} departamentos` : cerrado(p) ? p.estado_proyecto : p.etapa_actual}
                      </p>
                    </div>
                    {retraso > 0 && <AlertTriangle className="size-4 shrink-0 text-red-500" aria-label={`${retraso} días de retraso`} />}
                    <span className="w-9 shrink-0 text-right text-xs text-muted tabular-nums">{Math.round(num(p.porcentaje_avance))}%</span>
                  </div>
                )
              })}
            </div>

            {/* Línea de tiempo */}
            <div className="relative flex-1" style={{ minWidth: (fin - inicio + 1) * px }}>
              <div className="relative border-b border-border">
                <div className="relative h-7 border-b border-border">
                  {segmentos.map((m, k) => {
                    const largo = (segmentos[k + 1] ?? fin + 1) - m
                    const texto = escala === 'semana' ? (largo * px > 120 ? mesLargo : mesCorto).format(fechaDe(m)) : anio.format(fechaDe(m))
                    return (
                      <div key={m} className="absolute inset-y-0 flex items-center overflow-hidden border-l border-border px-2 text-xs font-semibold whitespace-nowrap"
                        style={{ left: x(m), width: largo * px }}>{largo * px > 28 && mayuscula(texto)}</div>
                    )
                  })}
                </div>
                <div className="relative h-7 border-b border-border/60 text-[11px] text-muted tabular-nums">
                  {marcas.map((d) => (
                    <span key={d} className="absolute inset-y-0 flex items-center border-l border-border pl-1.5 whitespace-nowrap" style={{ left: x(d) }}>
                      {textoMarca(d)}
                    </span>
                  ))}
                </div>
                <div className="relative h-[18px]">
                  <span className="absolute top-0.5 z-10 -translate-x-1/2 rounded bg-red-500 px-1.5 text-[10px] leading-[14px] font-semibold text-white"
                    style={{ left: x(hoy + 0.5) }}>Hoy</span>
                </div>
              </div>

              <div className="relative" style={{ height: alto }}>
                {filas.map((f, i) => (
                  <div key={f.p.id_proyecto} className={cn('absolute inset-x-0 border-b border-border', f.anidado && 'bg-surface-2/40')}
                    style={{ top: i * FILA, height: FILA }} />
                ))}
                {marcas.map((d) => <div key={d} className="absolute inset-y-0 border-l border-border/70" style={{ left: x(d) }} aria-hidden />)}
                <div className="absolute inset-y-0 z-20 w-0.5 bg-red-500" style={{ left: x(hoy + 0.5) - 1 }} aria-hidden />

                {filas.map((f, i) => {
                  const p = f.p
                  const top = i * FILA
                  if (!f.rango) {
                    return (
                      <span key={p.id_proyecto} className="absolute flex items-center text-xs text-muted italic"
                        style={{ top, height: FILA, left: x(hoy) + 8 }}>Sin fechas definidas</span>
                    )
                  }
                  const [a, b] = f.rango
                  const w = Math.max((b - a + 1) * px, 6)
                  const tono = tonoProyecto(p)
                  const retraso = diasRetraso(p)
                  const entrega = p.fecha_comprometida ? aDia(p.fecha_comprometida) : null
                  const abrirTip = (el: HTMLElement) => { const r = el.getBoundingClientRect(); setTip({ p, x: r.left, y: r.bottom }) }
                  return (
                    <div key={p.id_proyecto} className={cn(f.atenuado && 'opacity-50')}>
                      {/* Retraso: de la entrega vencida a hoy. */}
                      {retraso > 0 && (
                        <div className="absolute z-10 flex items-center" style={{ top, height: FILA, left: x(b + 1), width: x(hoy + 1) - x(b + 1) }}>
                          <div className="flex-1 border-t-2 border-dashed border-red-500" />
                          <span className="ml-1 rounded bg-red-500/10 px-1 text-[10px] font-semibold whitespace-nowrap text-red-600 dark:text-red-400">+{retraso} d</span>
                        </div>
                      )}
                      <Link to={`/proyectos/${p.id_proyecto}`} aria-label={`${p.nombre_proyecto}: abrir`}
                        onMouseEnter={(e) => abrirTip(e.currentTarget)} onMouseLeave={() => setTip(null)}
                        onFocus={(e) => abrirTip(e.currentTarget)} onBlur={() => setTip(null)}
                        className={cn('absolute z-10 overflow-hidden rounded-md shadow-sm transition-[filter,box-shadow] hover:shadow-md hover:brightness-110',
                          f.anidado ? 'h-4' : 'h-6', tono.pista, p.estado_proyecto === 'Cancelado' && 'opacity-50',
                          retraso > 0 && 'ring-2 ring-red-500 ring-offset-1 ring-offset-surface')}
                        style={{ top: top + FILA / 2 - (f.anidado ? 8 : 12), left: x(a), width: w }}>
                        <span className={cn('block h-full', tono.relleno)} style={{ width: `${Math.min(num(p.porcentaje_avance), 100)}%` }} />
                      </Link>
                      {/* La entrega comprometida, cuando la barra no termina en ella (cerró antes o después). */}
                      {entrega !== null && entrega !== b && (
                        <span title={`Entrega comprometida: ${formatDate(p.fecha_comprometida)}`}
                          className="absolute z-20 size-2.5 -translate-x-1/2 rotate-45 bg-amber-500 ring-1 ring-surface"
                          style={{ top: top + FILA / 2 - 5, left: x(entrega + 1) }} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </Card>
      {tip && <TarjetaProyecto p={tip.p} x={tip.x} y={tip.y} lider={lider} />}
    </div>
  )
}

/** Tarjeta flotante al pasar sobre una barra. */
function TarjetaProyecto({ p, x, y, lider }: { p: ProyectoBase; x: number; y: number; lider: (id: number) => string }) {
  const left = Math.min(Math.max(x, 8), window.innerWidth - 312)
  const arriba = y + 240 > window.innerHeight
  const retraso = diasRetraso(p)
  return (
    <div role="tooltip" className="pointer-events-none fixed z-50 w-76 rounded-xl border border-border bg-surface p-3 text-sm shadow-xl"
      style={arriba ? { left, bottom: window.innerHeight - y + 40 } : { left, top: y + 8 }}>
      <div className="flex items-start gap-2">
        <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', tonoProyecto(p).punto)} />
        <p className="leading-snug font-semibold">{p.nombre_proyecto}</p>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted">Estatus</dt><dd>{p.estado_proyecto}{p.etapa_actual && ` · ${p.etapa_actual}`}</dd>
        <dt className="text-muted">Avance</dt><dd>{Math.round(num(p.porcentaje_avance))} %</dd>
        <dt className="text-muted">Semáforo</dt><dd>{p.semaforo}{p.semaforo_motivo && <span className="text-muted"> · {p.semaforo_motivo}</span>}</dd>
        <dt className="text-muted">Líder</dt><dd className="truncate">{lider(p.lider_id)}</dd>
        <dt className="text-muted">Inicio</dt><dd>{formatDate(p.fecha_inicio)}</dd>
        <dt className="text-muted">Entrega</dt>
        <dd>
          {formatDate(fechaFinProyecto(p))}{!p.fecha_comprometida && p.fecha_tentativa && ' (tentativa)'}
          {retraso > 0 && <span className="font-medium text-red-500"> · {retraso} días de retraso</span>}
        </dd>
        {p.fecha_real_cierre && <><dt className="text-muted">Cierre</dt><dd>{formatDate(p.fecha_real_cierre)}</dd></>}
      </dl>
      <p className="mt-2 text-[11px] text-muted">Clic para abrir el proyecto</p>
    </div>
  )
}
