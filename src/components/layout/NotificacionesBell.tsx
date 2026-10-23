import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AtSign, Bell } from 'lucide-react'
import { useLeerNotificacion, useNotificaciones } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import { IconButton } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { enlaceTarea, type Notificacion } from '@/types/api'

/** Campana con las menciones (@) de quien inició sesión. Al abrir una, lleva a la tarea y la marca como leída. */
export function NotificacionesBell({ alinear = 'izquierda' }: { alinear?: 'izquierda' | 'derecha' }) {
  const { sesion } = useAuth()
  const q = useNotificaciones()
  const leer = useLeerNotificacion()
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [abierto])

  if (sesion?.id_usuario == null) return null  // sesión no ligada a una persona: nadie puede mencionarla
  const noLeidas = q.data?.no_leidas ?? 0

  const abrir = (n: Notificacion) => {
    if (!n.leida) leer.mutate(n.id_mencion)
    setAbierto(false)
    navigate(enlaceTarea({ id_tarea: n.id_tarea, id_proyecto: n.id_proyecto }))
  }

  return (
    <div ref={ref} className="relative">
      <IconButton label={noLeidas ? `Notificaciones: ${noLeidas} sin leer` : 'Notificaciones'} aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}>
        <Bell className="size-5" />
        {noLeidas > 0 && (
          <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4 font-semibold text-white tabular-nums">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </IconButton>

      {abierto && (
        <div role="dialog" aria-label="Notificaciones"
          className={cn('absolute z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-xl',
            alinear === 'izquierda' ? 'bottom-full left-0 mb-2' : 'top-full right-0')}>
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-sm font-medium">Menciones</p>
            {noLeidas > 0 && (
              <button type="button" className="text-xs font-medium text-brand hover:underline" onClick={() => leer.mutate(undefined)}>
                Marcar todas como leídas
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {q.data?.items.map((n) => (
              <li key={n.id_mencion}>
                <button type="button" onClick={() => abrir(n)}
                  className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-2', !n.leida && 'bg-brand-soft/40')}>
                  <AtSign className={cn('mt-0.5 size-4 shrink-0', n.leida ? 'text-muted' : 'text-brand')} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm"><strong>{n.autor_nombre}</strong> te mencionó en «{n.titulo_tarea}»</span>
                    <span className="mt-0.5 block truncate text-xs text-muted">{n.texto}</span>
                    <span className="mt-0.5 block text-xs text-muted">{n.nombre_proyecto ?? 'Tarea recurrente'} · {formatDateTime(n.fecha)}</span>
                  </span>
                  {!n.leida && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-label="Sin leer" />}
                </button>
              </li>
            ))}
            {q.data?.items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">No tienes menciones.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
