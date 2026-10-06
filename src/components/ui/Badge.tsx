import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type {
  EstadoEtapa, EstadoProyecto, NivelImpacto, ResponsableOrigen, Semaforo,
} from '@/types/api'

type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral' | 'brand'

const tones: Record<Tone, { box: string; dot: string }> = {
  ok: { box: 'bg-ok-soft text-ok', dot: 'bg-ok' },
  warn: { box: 'bg-warn-soft text-warn', dot: 'bg-warn' },
  danger: { box: 'bg-danger-soft text-danger', dot: 'bg-danger' },
  info: { box: 'bg-info-soft text-info', dot: 'bg-info' },
  brand: { box: 'bg-brand-soft text-brand', dot: 'bg-brand' },
  neutral: { box: 'bg-neutral-soft text-muted', dot: 'bg-muted' },
}

export function Badge({ tone = 'neutral', dot, children, className }: {
  tone?: Tone; dot?: boolean; children: ReactNode; className?: string
}) {
  const t = tones[tone]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', t.box, className)}>
      {dot && <span className={cn('size-1.5 rounded-full', t.dot)} aria-hidden />}
      {children}
    </span>
  )
}

export const semaforoTone: Record<Semaforo, Tone> = { Verde: 'ok', Amarillo: 'warn', Rojo: 'danger' }
/** El texto acompaña siempre al color (accesibilidad para daltonismo). */
export const SemaforoBadge = ({ value }: { value: Semaforo }) => <Badge tone={semaforoTone[value]} dot>{value}</Badge>

const estadoTone: Record<EstadoProyecto, Tone> = {
  Iniciación: 'info', Planeación: 'brand', Ejecución: 'ok', Cierre: 'neutral', Cancelado: 'danger', Pausado: 'warn',
}
export const EstadoBadge = ({ value }: { value: EstadoProyecto }) => <Badge tone={estadoTone[value]}>{value}</Badge>

const etapaTone: Record<EstadoEtapa, Tone> = { Pendiente: 'neutral', 'En Curso': 'brand', Detenido: 'danger', Completado: 'ok' }
export const EtapaBadge = ({ value }: { value: EstadoEtapa }) => <Badge tone={etapaTone[value]}>{value}</Badge>

const impactoTone: Record<NivelImpacto, Tone> = { Alto: 'danger', Medio: 'warn', Bajo: 'ok' }
export const ImpactoBadge = ({ value }: { value: NivelImpacto }) => <Badge tone={impactoTone[value]}>Impacto {value.toLowerCase()}</Badge>

const origenTone: Record<ResponsableOrigen, Tone> = { DTI: 'brand', Cliente: 'warn', Tercero: 'neutral' }
export const OrigenBadge = ({ value }: { value: ResponsableOrigen }) => <Badge tone={origenTone[value]}>{value}</Badge>
