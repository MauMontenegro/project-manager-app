import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Layout'
import { cn } from '@/lib/cn'
import { fechaFinProyecto, type ProyectoDetalle, type Tarea } from '@/types/api'
import { aDia, diaSemana, fechaDe, hoyDia, LeyendaEstados, mayuscula, rangoTarea, resumenTarea, tonoBarra, useDiaInhabil, vencida } from './fechas'

const MS_DIA = 86_400_000
const mesFmt = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const diaDeMes = (y: number, m: number, d = 1) => Date.UTC(y, m, d) / MS_DIA

/** Calendario mensual: cada tarea es una barra desde su inicio hasta su fecha límite. */
export function CalendarioTareas({ tareas, proyecto, onAbrir }: {
  tareas: Tarea[]
  proyecto: ProyectoDetalle
  onAbrir: (t: Tarea) => void
}) {
  const inhabil = useDiaInhabil()
  const hoy = hoyDia()
  const conRango = useMemo(
    () => tareas.flatMap((t) => { const r = rangoTarea(t); return r ? [{ t, a: r[0], b: r[1] }] : [] }),
    [tareas],
  )
  const sinFechas = tareas.length - conRango.length
  const pInicio = proyecto.fecha_inicio ? aDia(proyecto.fecha_inicio) : null
  const pFinIso = fechaFinProyecto(proyecto)
  const pFin = pFinIso ? aDia(pFinIso) : null

  // Mes inicial: el actual si hay tareas o el proyecto está en curso; si no, el de la primera tarea.
  const [mes, setMes] = useState(() => {
    const desde = Math.min(...conRango.map((x) => x.a), pInicio ?? Infinity)
    const hasta = Math.max(...conRango.map((x) => x.b), pFin ?? -Infinity)
    const ref = Number.isFinite(desde) && (hoy < desde || hoy > hasta) ? desde : hoy
    const f = fechaDe(ref)
    return { y: f.getUTCFullYear(), m: f.getUTCMonth() }
  })
  const mover = (delta: number) => setMes(({ y, m }) => ({ y: y + Math.floor((m + delta) / 12), m: (((m + delta) % 12) + 12) % 12 }))
  const irAHoy = () => { const f = fechaDe(hoy); setMes({ y: f.getUTCFullYear(), m: f.getUTCMonth() }) }

  const primero = diaDeMes(mes.y, mes.m)
  const ultimo = diaDeMes(mes.y, mes.m + 1) - 1
  const desde = primero - ((diaSemana(primero) + 6) % 7)
  const hasta = ultimo + ((7 - diaSemana(ultimo)) % 7)
  const semanas = Array.from({ length: (hasta - desde + 1) / 7 }, (_, i) => desde + i * 7)
  const delMes = conRango.filter((x) => x.a <= ultimo && x.b >= primero).length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <IconButton label="Mes anterior" onClick={() => mover(-1)}><ChevronLeft className="size-4" /></IconButton>
        <IconButton label="Mes siguiente" onClick={() => mover(1)}><ChevronRight className="size-4" /></IconButton>
        <h3 className="min-w-40 text-base font-semibold" aria-live="polite">{mayuscula(mesFmt.format(fechaDe(primero)))}</h3>
        <Button size="sm" onClick={irAHoy}>Hoy</Button>
        <span className="text-xs text-muted">{delMes} tarea(s) este mes{sinFechas > 0 && ` · ${sinFechas} sin fechas no se muestran`}</span>
        <div className="sm:ml-auto"><LeyendaEstados /></div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-surface-2 text-center text-xs font-medium text-muted">
          {DIAS.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        {semanas.map((w0) => {
          const w6 = w0 + 6
          // Segmentos de la semana, repartidos en carriles para que no se encimen.
          const segmentos = conRango
            .filter((x) => x.a <= w6 && x.b >= w0)
            .map((x) => ({ ...x, s: Math.max(x.a, w0), e: Math.min(x.b, w6) }))
            .sort((p, q) => p.s - q.s || q.e - q.s - (p.e - p.s))
          const finCarril: number[] = []
          const colocados = segmentos.map((seg) => {
            let carril = finCarril.findIndex((fin) => fin < seg.s)
            if (carril === -1) carril = finCarril.push(seg.e) - 1
            else finCarril[carril] = seg.e
            return { ...seg, carril }
          })
          return (
            <div key={w0} className="grid min-h-24 border-b border-border last:border-b-0 sm:min-h-28"
              style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gridTemplateRows: `28px repeat(${finCarril.length}, 24px) minmax(8px, 1fr)` }}>
              {Array.from({ length: 7 }, (_, i) => w0 + i).map((d, i) => {
                const fuera = d < primero || d > ultimo
                return (
                  <div key={d} style={{ gridColumn: i + 1, gridRow: '1 / -1' }}
                    className={cn('flex items-start justify-between gap-1 border-r border-border p-1 last:border-r-0', inhabil(d) && 'bg-surface-2/70')}>
                    <span className={cn('flex size-6 items-center justify-center rounded-full text-xs tabular-nums',
                      d === hoy ? 'bg-brand font-semibold text-brand-fg' : fuera ? 'text-muted/60' : 'text-fg')}>
                      {fechaDe(d).getUTCDate()}
                    </span>
                    {d === pInicio && <span className="truncate pt-1 text-[10px] font-medium text-ok">Inicio</span>}
                    {d === pFin && <span className="truncate pt-1 text-[10px] font-medium text-warn">Fin</span>}
                  </div>
                )
              })}
              {colocados.map(({ t, a, b, s, e, carril }) => (
                <button key={t.id_tarea} type="button" onClick={() => onAbrir(t)} title={resumenTarea(t)} aria-label={resumenTarea(t)}
                  style={{ gridColumn: `${s - w0 + 1} / ${e - w0 + 2}`, gridRow: carril + 2 }}
                  className={cn('relative z-10 mx-0.5 flex h-5 items-center gap-1 self-center overflow-hidden rounded px-1.5 text-left text-[11px] font-medium whitespace-nowrap hover:brightness-95',
                    tonoBarra[t.estado], vencida(t) && 'ring-2 ring-red-500', s > a && 'ml-0 rounded-l-none', e < b && 'mr-0 rounded-r-none')}>
                  {t.bloqueada && <Lock className="size-3 shrink-0" aria-hidden />}
                  <span className={cn('truncate', t.estado === 'Finalizado' && 'line-through')}>{t.titulo}</span>
                </button>
              ))}
            </div>
          )
        })}
      </Card>
    </div>
  )
}
