import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

const control =
  'w-full rounded-lg border border-border-strong bg-surface text-sm text-fg placeholder:text-muted/70 ' +
  'transition-shadow focus:border-brand focus:outline-none focus:ring-4 focus:ring-[var(--ring)] ' +
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-70 aria-[invalid=true]:border-danger'

interface FieldProps {
  label: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
}

export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-fg">
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

type Common = { label: string; error?: string; hint?: string; fieldClassName?: string }

export const TextField = forwardRef<HTMLInputElement, Common & InputHTMLAttributes<HTMLInputElement>>(
  function TextField({ label, error, hint, fieldClassName, className, required, ...rest }, ref) {
    return (
      <Field label={label} error={error} hint={hint} required={required} className={fieldClassName}>
        {({ id, describedBy, invalid }) => (
          <input
            ref={ref} id={id} aria-invalid={invalid} aria-describedby={describedBy}
            className={cn(control, 'h-10 px-3', className)} {...rest}
          />
        )}
      </Field>
    )
  },
)

export const TextArea = forwardRef<HTMLTextAreaElement, Common & TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ label, error, hint, fieldClassName, className, required, rows = 3, ...rest }, ref) {
    return (
      <Field label={label} error={error} hint={hint} required={required} className={fieldClassName}>
        {({ id, describedBy, invalid }) => (
          <textarea
            ref={ref} id={id} rows={rows} aria-invalid={invalid} aria-describedby={describedBy}
            className={cn(control, 'resize-y px-3 py-2', className)} {...rest}
          />
        )}
      </Field>
    )
  },
)

export const SelectField = forwardRef<HTMLSelectElement, Common & SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectField({ label, error, hint, fieldClassName, className, required, children, ...rest }, ref) {
    return (
      <Field label={label} error={error} hint={hint} required={required} className={fieldClassName}>
        {({ id, describedBy, invalid }) => (
          <div className="relative">
            <select
              ref={ref} id={id} aria-invalid={invalid} aria-describedby={describedBy}
              className={cn(control, 'h-10 appearance-none pr-9 pl-3', className)} {...rest}
            >
              {children}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          </div>
        )}
      </Field>
    )
  },
)

/** Select compacto para barras de filtros (sin etiqueta visible). */
export function FilterSelect({
  label, value, onChange, children, className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(control, 'h-9 appearance-none pr-8 pl-3', value && 'border-brand/50 bg-brand-soft/40')}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  )
}
