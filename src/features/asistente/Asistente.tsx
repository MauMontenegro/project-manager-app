import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowUp, Loader2, RotateCcw, Sparkles, Square, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { IconButton } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { ApiError, streamNdjson } from '@/lib/http'
import { Markdown } from './Markdown'

type Evento =
  | { tipo: 'sesion'; id: string }
  | { tipo: 'estado'; texto: string }
  | { tipo: 'texto'; delta: string }
  | { tipo: 'final'; texto: string }
  | { tipo: 'fin' }
  | { tipo: 'error'; mensaje: string }

interface Mensaje {
  id: number
  rol: 'persona' | 'asistente'
  texto: string
  error?: boolean
}

const SUGERENCIAS = [
  '¿Qué debería atender primero hoy?',
  '¿Qué está bloqueado en mis proyectos y desde cuándo?',
  '¿Cómo van mis proyectos?',
  '¿Quién está sobrecargado esta semana?',
]

/** Botón flotante y panel lateral del asistente de IA. Solo consulta, con los permisos de quien pregunta; la conversación
 * se conserva al navegar por la app (el panel vive en el layout). */
export function Asistente() {
  const { sesion } = useAuth()
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [conversacion, setConversacion] = useState<string | null>(null)
  const [estado, setEstado] = useState<string | null>(null)
  const [enCurso, setEnCurso] = useState(false)
  const [texto, setTexto] = useState('')
  const [anuncio, setAnuncio] = useState('')
  const abortar = useRef<AbortController | null>(null)
  const lista = useRef<HTMLDivElement>(null)
  const entrada = useRef<HTMLTextAreaElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const pegado = useRef(true)

  // Ctrl/⌘ + J abre o cierra el asistente desde cualquier pantalla.
  useEffect(() => {
    const tecla = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); setAbierto((a) => !a) }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])
  useEffect(() => { if (abierto) entrada.current?.focus() }, [abierto])
  // Baja con la respuesta mientras llega, salvo que la persona haya subido a leer.
  useEffect(() => {
    if (pegado.current) lista.current?.scrollTo({ top: lista.current.scrollHeight })
  }, [mensajes, estado])

  const cerrar = useCallback(() => { setAbierto(false); requestAnimationFrame(() => boton.current?.focus()) }, [])

  const enviar = async (pregunta: string) => {
    const limpia = pregunta.trim()
    if (!limpia || enCurso) return
    const idRespuesta = Date.now()
    setMensajes((m) => [...m, { id: idRespuesta - 1, rol: 'persona', texto: limpia }, { id: idRespuesta, rol: 'asistente', texto: '' }])
    setTexto('')
    setEnCurso(true)
    setEstado('Pensando')
    pegado.current = true
    const ctrl = new AbortController()
    abortar.current = ctrl
    const actualizar = (f: (t: string) => string, error = false) =>
      setMensajes((m) => m.map((x) => (x.id === idRespuesta ? { ...x, texto: f(x.texto), error } : x)))
    try {
      await streamNdjson<Evento>('/asistente/chat', { mensaje: limpia, id_conversacion: conversacion }, (e) => {
        if (e.tipo === 'sesion') setConversacion(e.id)
        else if (e.tipo === 'estado') setEstado(e.texto)
        else if (e.tipo === 'texto') { setEstado(null); actualizar((t) => t + e.delta) }
        else if (e.tipo === 'final') { setEstado(null); actualizar(() => e.texto) }
        else if (e.tipo === 'error') actualizar(() => e.mensaje, true)
      }, ctrl.signal)
      setAnuncio('Respuesta del asistente lista')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') actualizar((t) => (t ? `${t}\n\n*(Detenido)*` : '*(Detenido)*'))
      else actualizar(() => (e instanceof ApiError ? e.message : 'No se pudo obtener respuesta.'), true)
    } finally {
      setEnCurso(false)
      setEstado(null)
      abortar.current = null
      entrada.current?.focus()
    }
  }

  const nueva = () => {
    abortar.current?.abort()
    setMensajes([]); setConversacion(null); setTexto('')
    entrada.current?.focus()
  }
  const teclas = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void enviar(texto) }
    if (e.key === 'Escape') cerrar()
  }

  if (!sesion?.asistente_disponible) return null
  const nombre = sesion.nombre.split(' ')[0]
  const ultima = mensajes[mensajes.length - 1]

  return (
    <>
      {!abierto && (
        <button ref={boton} type="button" onClick={() => setAbierto(true)} aria-keyshortcuts="Control+J Meta+J"
          title="Asistente (Ctrl/⌘ + J)"
          className="animate-pop-in fixed right-4 bottom-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-brand px-4 text-sm font-medium text-brand-fg shadow-lg transition-transform hover:scale-[1.03] hover:bg-brand-hover focus-visible:ring-4 focus-visible:ring-[var(--ring)] focus-visible:outline-none sm:right-6 sm:bottom-6">
          <Sparkles className="size-5" aria-hidden />
          <span className="hidden sm:inline">Asistente</span>
          <span className="sr-only sm:hidden">Abrir asistente</span>
        </button>
      )}

      {abierto && (
        <aside role="dialog" aria-label="Asistente" aria-modal="false"
          onKeyDown={(e) => { if (e.key === 'Escape') cerrar() }}
          className="animate-slide-in fixed inset-0 z-50 flex flex-col border-l border-border bg-surface shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[26rem]">
          <header className="flex items-center gap-3 border-b border-border px-4 py-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand"><Sparkles className="size-4" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Asistente</h2>
              <p className="truncate text-xs text-muted">Consulta con tus permisos · no modifica nada</p>
            </div>
            {mensajes.length > 0 && <IconButton label="Nueva conversación" onClick={nueva}><RotateCcw className="size-4" /></IconButton>}
            <IconButton label="Cerrar asistente" onClick={cerrar}><X className="size-5" /></IconButton>
          </header>

          <div ref={lista} aria-busy={enCurso}
            onScroll={(e) => { const el = e.currentTarget; pegado.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40 }}
            className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
            {mensajes.length === 0 ? (
              <div className="space-y-4">
                <div>
                  <p className="text-base font-semibold">Hola, {nombre}.</p>
                  <p className="mt-1 text-sm text-muted">
                    Pregúntame por el estatus de tus proyectos y tareas, sus bloqueos y desfases, o qué atender primero.
                    Respondo solo con lo que tu rol te permite ver.
                  </p>
                </div>
                <ul className="space-y-2">
                  {SUGERENCIAS.map((s) => (
                    <li key={s}>
                      <button type="button" onClick={() => void enviar(s)}
                        className="w-full rounded-xl border border-border px-3.5 py-2.5 text-left text-sm transition-colors hover:border-brand hover:bg-brand-soft/40 focus-visible:ring-4 focus-visible:ring-[var(--ring)] focus-visible:outline-none">
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : mensajes.map((m) => m.rol === 'persona' ? (
              <div key={m.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-3.5 py-2 text-sm whitespace-pre-wrap text-brand-fg">{m.texto}</p>
              </div>
            ) : (
              <div key={m.id} className="flex gap-2.5">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand"><Sparkles className="size-3.5" aria-hidden /></span>
                <div className={cn('min-w-0 flex-1', m.error && 'text-danger')}>
                  {m.texto ? <Markdown texto={m.texto} onEnlace={() => { if (window.innerWidth < 640) setAbierto(false) }} />
                    : m === ultima && enCurso ? null : <p className="text-sm text-muted">Sin respuesta.</p>}
                  {m === ultima && estado && (
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />{estado}…
                    </p>
                  )}
                  {m.error && m === ultima && !enCurso && (
                    <button type="button" className="mt-1 text-xs font-medium text-brand hover:underline"
                      onClick={() => {
                        const pregunta = [...mensajes].reverse().find((x) => x.rol === 'persona')?.texto ?? ''
                        setMensajes((ms) => ms.slice(0, -2))
                        void enviar(pregunta)
                      }}>Reintentar</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="sr-only" aria-live="polite">{anuncio}</p>

          <form className="border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); void enviar(texto) }}>
            <div className="flex items-end gap-2 rounded-xl border border-border-strong bg-surface px-3 py-2 focus-within:border-brand focus-within:ring-4 focus-within:ring-[var(--ring)]">
              <label htmlFor="pregunta-asistente" className="sr-only">Pregunta al asistente</label>
              <textarea id="pregunta-asistente" ref={entrada} rows={1} value={texto} maxLength={2000} onKeyDown={teclas}
                onChange={(e) => { setTexto(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px` }}
                placeholder="Pregunta sobre tus proyectos o tareas…"
                style={{ outline: 'none' }} /* el foco se muestra en el contenedor */
                className="max-h-32 min-h-6 flex-1 resize-none border-0 bg-transparent py-1 text-sm placeholder:text-muted/80 focus:outline-none focus-visible:outline-none" />
              {enCurso ? (
                <IconButton label="Detener respuesta" onClick={() => abortar.current?.abort()} className="size-8 rounded-lg bg-surface-2">
                  <Square className="size-3.5" />
                </IconButton>
              ) : (
                <button type="submit" disabled={!texto.trim()} aria-label="Enviar pregunta"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-fg transition-opacity disabled:opacity-40">
                  <ArrowUp className="size-4" aria-hidden />
                </button>
              )}
            </div>
            <p className="mt-1.5 px-1 text-[11px] text-muted">Puede equivocarse: verifica en los enlaces. Enter envía · Shift+Enter, nueva línea.</p>
          </form>
        </aside>
      )}
    </>
  )
}
