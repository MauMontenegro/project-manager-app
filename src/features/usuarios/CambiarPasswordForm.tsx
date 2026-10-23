import { useId, useState } from 'react'
import { Check, Circle } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { FormError } from '@/components/ui/Feedback'
import { PasswordField } from '@/components/ui/PasswordField'
import { cn } from '@/lib/cn'

/** Mismas reglas que la API (que es la que las impone). */
export const REGLAS_PASSWORD = [
  { texto: 'Al menos 8 caracteres', cumple: (p: string) => p.length >= 8 },
  { texto: 'Letras y números', cumple: (p: string) => /\p{L}/u.test(p) && /\d/.test(p) },
]

/** Cambio de la contraseña propia: actual, nueva y confirmación, con las reglas a la vista. El botón lo pone quien
 * lo usa (con `form={id}`); al terminar, la API emite una sesión nueva y cierra las de otros equipos. */
export function CambiarPasswordForm({ id, onListo, onPendiente }: {
  id: string; onListo: () => void; onPendiente?: (p: boolean) => void
}) {
  const { cambiarPassword } = useAuth()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [intentado, setIntentado] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const reglasId = useId()

  const reglasOk = REGLAS_PASSWORD.every((r) => r.cumple(nueva))
  const coinciden = nueva === confirmar
  const errores = {
    actual: intentado && !actual ? 'Escribe tu contraseña actual' : undefined,
    nueva: intentado && !reglasOk ? 'No cumple los requisitos' : intentado && nueva === actual && !!nueva ? 'Debe ser distinta de la actual' : undefined,
    confirmar: intentado && !coinciden ? 'No coincide con la nueva contraseña' : undefined,
  }

  const enviar = async () => {
    setIntentado(true)
    if (Object.values(errores).some(Boolean) || !actual || !reglasOk || !coinciden || nueva === actual) return
    setError(null)
    onPendiente?.(true)
    try {
      await cambiarPassword(actual, nueva)
      onListo()
    } catch (e) {
      setError(e)
    } finally {
      onPendiente?.(false)
    }
  }

  return (
    <form id={id} noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); void enviar() }}>
      {/* Para que el gestor de contraseñas del navegador asocie la cuenta. */}
      <input type="email" name="username" autoComplete="username" hidden readOnly />
      <PasswordField label="Contraseña actual" required autoComplete="current-password" data-autofocus value={actual}
        onChange={(e) => setActual(e.target.value)} error={errores.actual} />
      <div>
        <PasswordField label="Nueva contraseña" required autoComplete="new-password" maxLength={128} value={nueva}
          onChange={(e) => setNueva(e.target.value)} error={errores.nueva} aria-describedby={reglasId} />
        <ul id={reglasId} className="mt-2 space-y-1">
          {REGLAS_PASSWORD.map((r) => {
            const ok = r.cumple(nueva)
            return (
              <li key={r.texto} className={cn('flex items-center gap-1.5 text-xs', ok ? 'text-ok' : 'text-muted')}>
                {ok ? <Check className="size-3.5" aria-hidden /> : <Circle className="size-3.5" aria-hidden />}
                {r.texto}<span className="sr-only">{ok ? ': cumple' : ': pendiente'}</span>
              </li>
            )
          })}
        </ul>
      </div>
      <PasswordField label="Confirma la nueva contraseña" required autoComplete="new-password" maxLength={128} value={confirmar}
        onChange={(e) => setConfirmar(e.target.value)} error={errores.confirmar} />
      <FormError error={error} />
    </form>
  )
}
