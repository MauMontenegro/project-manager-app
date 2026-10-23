import { useState } from 'react'
import { Check, Copy, RefreshCw } from 'lucide-react'
import { useRestablecerPassword } from '@/api/hooks'
import { Button } from '@/components/ui/Button'
import { FormError } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { PasswordField } from '@/components/ui/PasswordField'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import type { Usuario } from '@/types/api'
import { CambiarPasswordForm, REGLAS_PASSWORD } from './CambiarPasswordForm'

export function CambiarPasswordModal({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [pendiente, setPendiente] = useState(false)
  return (
    <Modal open onClose={onClose} size="sm" title="Cambiar contraseña"
      description="Al guardarla se cierran tus sesiones abiertas en otros equipos."
      footer={<>
        <Button onClick={onClose} disabled={pendiente}>Cancelar</Button>
        <Button variant="primary" type="submit" form="cambiar-password" loading={pendiente}>Guardar contraseña</Button>
      </>}>
      <CambiarPasswordForm id="cambiar-password" onPendiente={setPendiente}
        onListo={() => { toast.success('Contraseña actualizada'); onClose() }} />
    </Modal>
  )
}

/** Asigna una contraseña temporal a otra persona (generada o escrita) y la muestra una sola vez para entregarla. */
export function RestablecerPasswordModal({ u, onClose }: { u: Usuario; onClose: () => void }) {
  const mutation = useRestablecerPassword()
  const [modo, setModo] = useState<'generar' | 'escribir'>('generar')
  const [nueva, setNueva] = useState('')
  const [intentado, setIntentado] = useState(false)
  const [copiada, setCopiada] = useState(false)
  const temporal = mutation.data?.password_temporal
  const primera = !u.tiene_password
  const invalida = modo === 'escribir' && !REGLAS_PASSWORD.every((r) => r.cumple(nueva))

  const guardar = () => {
    setIntentado(true)
    if (invalida) return
    mutation.mutate({ id: u.id_usuario, nueva: modo === 'escribir' ? nueva : undefined })
  }
  const copiar = async () => {
    try { await navigator.clipboard.writeText(temporal ?? ''); setCopiada(true) } catch { /* sin permiso: queda a la vista */ }
  }

  if (temporal) {
    return (
      <Modal open onClose={onClose} size="sm" title="Contraseña temporal lista"
        footer={<Button variant="primary" onClick={onClose}>Listo</Button>}>
        <p className="text-sm">Entrégasela a <strong>{u.nombre}</strong> por un medio privado. No se volverá a mostrar.</p>
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-surface-2 p-3">
          <code className="flex-1 font-mono text-lg tracking-wider select-all">{temporal}</code>
          <Button size="sm" icon={copiada ? <Check className="size-4" /> : <Copy className="size-4" />} onClick={() => void copiar()}>
            {copiada ? 'Copiada' : 'Copiar'}
          </Button>
        </div>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Entra con su correo <strong className="text-fg">{u.correo}</strong> y esta contraseña.</li>
          <li>Al entrar, la app le pedirá elegir una propia.</li>
          {!primera && <li>Sus sesiones abiertas se cerraron y su contraseña anterior ya no funciona.</li>}
        </ul>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} size="sm" title={primera ? 'Dar acceso con contraseña' : 'Restablecer contraseña'}
      description={primera
        ? `${u.nombre} podrá entrar con su correo y una contraseña temporal que cambiará al iniciar sesión.`
        : `Se reemplazará la contraseña de ${u.nombre} por una temporal y se cerrarán sus sesiones abiertas.`}
      footer={<>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button variant="primary" loading={mutation.isPending} icon={<RefreshCw className="size-4" />} onClick={guardar}>
          {primera ? 'Crear contraseña temporal' : 'Restablecer'}
        </Button>
      </>}>
      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-[13px] font-medium text-fg">Contraseña temporal</legend>
        {([['generar', 'Generarla automáticamente', 'Recomendado: 12 caracteres aleatorios, fáciles de dictar.'],
          ['escribir', 'Escribirla yo', 'Mínimo 8 caracteres, con letras y números.']] as const).map(([v, t, d]) => (
          <label key={v} className={cn('flex cursor-pointer gap-2.5 rounded-lg border p-3 text-sm', modo === v ? 'border-brand bg-brand/5' : 'border-border hover:bg-surface-2')}>
            <input type="radio" name="modo" className="mt-0.5 accent-[var(--brand)]" checked={modo === v} onChange={() => setModo(v)} />
            <span><span className="font-medium">{t}</span><span className="block text-xs text-muted">{d}</span></span>
          </label>
        ))}
      </fieldset>
      {modo === 'escribir' && (
        <div className="mt-4">
          <PasswordField label="Contraseña temporal" autoComplete="off" maxLength={128} value={nueva} data-autofocus
            onChange={(e) => setNueva(e.target.value)} error={intentado && invalida ? 'Mínimo 8 caracteres, con letras y números' : undefined} />
        </div>
      )}
      <div className="mt-4"><FormError error={mutation.error} /></div>
    </Modal>
  )
}
