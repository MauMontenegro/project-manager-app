import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Field } from './Field'

type Props = { label: ReactNode; error?: string; hint?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

/** Campo de contraseña con botón para mostrarla u ocultarla. */
export const PasswordField = forwardRef<HTMLInputElement, Props>(function PasswordField(
  { label, error, hint, required, className, 'aria-describedby': extra, ...rest }, ref,
) {
  const [visible, setVisible] = useState(false)
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            ref={ref} id={id} type={visible ? 'text' : 'password'} aria-invalid={invalid}
            aria-describedby={[describedBy, extra].filter(Boolean).join(' ') || undefined}
            autoCapitalize="none" autoCorrect="off" spellCheck={false}
            className={cn(
              'h-10 w-full rounded-lg border border-border-strong bg-surface pr-10 pl-3 text-sm text-fg placeholder:text-muted/70',
              'transition-shadow focus:border-brand focus:ring-4 focus:ring-[var(--ring)] focus:outline-none aria-[invalid=true]:border-danger',
              className,
            )}
            {...rest}
          />
          <button
            type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={visible} aria-controls={id}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted hover:text-fg focus-visible:ring-4 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
          >
            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
      )}
    </Field>
  )
})
