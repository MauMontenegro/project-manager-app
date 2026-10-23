import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronLeft, ChevronRight, Flag, Play } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Layout'
import { cn } from '@/lib/cn'
import { aplanarProyectos, type DepartamentoProyecto, type Proyecto, type ProyectoBase } from '@/types/api'
import { aDia, diaSemana, fechaDe, hoyDia, mayuscula, useDiaInhabil } from '@/features/tareas/fechas'
import { diasRetraso, LeyendaProyectos, resumenProyecto, tonoProyecto } from './fechasProyecto'

const MS_DIA = 86_400_000
const mesFmt = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const diaDeMes = (y: number, m: number, d = 1) => Date.UTC(y, m, d) / MS_DIA

type Tipo = 'inicio' | 'entrega' | 'cierre'
type Evento = { p: ProyectoBase; tipo: Tipo; dia: number; texto: string }
const ICONO = { inicio: Play, entrega: Flag, cierre: CheckCircle2 } as const
const ORDEN: Record<Tipo, number> = { entrega: 0, cierre: 1, inicio: 2 }

/** Fechas clave de cada proyecto (inicio, entrega comprometida o tentativa y cierre real) en un calendario
 * mensual. Los conjuntos se muestran por sus subproyectos (en el espacio de un departamento, solo el suyo). */
export function CalendarioProyectos({ proyectos, departamento }: { proyectos: Proyecto[]; departamento?: DepartamentoProyecto }) {
  const inhabil = useDiaInhabil()
  const hoy = hoyDia()

  const eventos = useMemo(() => aplanarProyectos(proyectos, true)
    .filter((p) => !departamento || p.departamento === departamento)
    .flatMap((p): Evento[] => [
      ...(p.fecha_inicio ? [{ p, tipo: 'inicio' as const, dia: aDia(p.fecha_inicio), texto: 'Inicio' }] : []),
      ...(p.fecha_comprometida ? [{ p, tipo: 'entrega' as const, dia: aDia(p.fecha_comprometida), texto: 'Entrega' }]
        : p.fecha_tentativa ? [{ p, tipo: 'entrega' as const, dia: aDia(p.fecha_tentativa), texto: 'Entrega tentativa' }] : []),
      ...(p.fecha_real_cierre ? [{ p, tipo: 'cierre' as const, dia: aDia(p.fecha_real_cierre), texto: p.estado_proyecto === 'Cancelado' ? 'Cancelado' : 'Cierre' }] : []),
    ]), [proyectos, departamento])
  const porDia = useMemo(() => {
    const m = new Map<number, Evento[]>()
    for (const e of eventos) m.set(e.dia, [...(m.get(e.dia) ?? []), e])
    for (const lista of m.values()) lista.sort((a, b) => ORDEN[a.tipo] - ORDEN[b.tipo])
    return m
  }, [eventos])

  const [mes, setMes] = useState(() => { const f = fechaDe(hoy); return { y: f.getUTCFullYear(), m: f.getUTCMonth() } })
  const mover = (delta: number) => setMes(({ y, m }) => ({ y: y + Math.floor((m + delta) / 12), m: (((m + delta) % 12) + 12) % 12 }))
  const irAHoy = () => { const f = fechaDe(hoy); setMes({ y: f.getUTCFullYear(), m: f.getUTCMonth() }) }

  const primero = diaDeMes(mes.y, mes.m)
  const ultimo = diaDeMes(mes.y, mes.m + 1) - 1
  const desde = primero - ((diaSemana(primero) + 6) % 7)
  const hasta = ultimo + ((7 - diaSemana(ultimo)) % 7)
  const dias = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i)
  const delMes = eventos.filter((e) => e.dia >= primero && e.dia <= ultimo)
  const entregas = delMes.filter((e) => e.tipo === 'entrega').length
  const inicios = delMes.filter((e) => e.tipo === 'inicio').length

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <IconButton label="Mes anterior" onClick={() => mover(-1)}><ChevronLeft className="size-4" /></IconButton>
        <IconButton label="Mes siguiente" onClick={() => mover(1)}><ChevronRight className="size-4" /></IconButton>
        <h3 className="min-w-40 text-base font-semibold" aria-live="polite">{mayuscula(mesFmt.format(fechaDe(primero)))}</h3>
        <Button size="sm" onClick={irAHoy}>Hoy</Button>
        <span className="text-xs text-muted">{entregas} entrega(s) · {inicios} inicio(s) este mes</span>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted sm:ml-auto">
          {(['inicio', 'entrega', 'cierre'] as const).map((t) => {
            const Icono = ICONO[t]
            return <li key={t} className="flex items-center gap-1"><Icono className="size-3.5" aria-hidden />{t === 'inicio' ? 'Inicio' : t === 'entrega' ? 'Entrega' : 'Cierre'}</li>
          })}
        </ul>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-surface-2 text-center text-xs font-medium text-muted">
          {DIAS.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {dias.map((d) => {
            const fuera = d < primero || d > ultimo
            return (
              <div key={d} className={cn('min-h-24 min-w-0 border-r border-b border-border p-1 sm:min-h-28 [&:nth-child(7n)]:border-r-0',
                inhabil(d) && 'bg-surface-2/70', fuera && 'bg-surface-2/40')}>
                <span className={cn('flex size-6 items-center justify-center rounded-full text-xs tabular-nums',
                  d === hoy ? 'bg-brand font-semibold text-brand-fg' : fuera ? 'text-muted/60' : 'text-fg')}>
                  {fechaDe(d).getUTCDate()}
                </span>
                <ul className="mt-0.5 space-y-0.5">
                  {(porDia.get(d) ?? []).map((e) => <Chip key={`${e.p.id_proyecto}-${e.tipo}`} e={e} />)}
                </ul>
              </div>
            )
          })}
        </div>
      </Card>
      <LeyendaProyectos conAvance={false} />
    </div>
  )
}

function Chip({ e }: { e: Evento }) {
  const Icono = ICONO[e.tipo]
  // Entrega vencida de un proyecto abierto: resaltada.
  const vencida = e.tipo === 'entrega' && diasRetraso(e.p) > 0
  const etiqueta = `${e.texto}: ${resumenProyecto(e.p)}`
  return (
    <li>
      <Link to={`/proyectos/${e.p.id_proyecto}`} title={etiqueta} aria-label={etiqueta}
        className={cn('flex items-center gap-1 rounded px-1 py-0.5 text-[11px] leading-tight hover:bg-surface-2',
          e.tipo === 'entrega' ? 'font-semibold' : 'text-muted', vencida && 'bg-red-500/10 text-red-600 ring-1 ring-red-500 dark:text-red-400')}>
        <span className={cn('size-2 shrink-0 rounded-full', tonoProyecto(e.p).punto)} aria-hidden />
        <Icono className="size-3 shrink-0" aria-hidden />
        <span className={cn('truncate', e.p.estado_proyecto === 'Cancelado' && 'line-through')}>{e.p.nombre_proyecto}</span>
      </Link>
    </li>
  )
}
