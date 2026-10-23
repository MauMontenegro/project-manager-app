import { useState, type ReactNode } from 'react'
import { KeyRound, Loader2, LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { FIREBASE_DISPONIBLE, type Proveedor } from '@/auth/firebase'
import { Button } from '@/components/ui/Button'
import { FormError } from '@/components/ui/Feedback'
import { TextField } from '@/components/ui/Field'
import { PasswordField } from '@/components/ui/PasswordField'
import { CambiarPasswordForm } from '@/features/usuarios/CambiarPasswordForm'

const GoogleMark = () => (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
    <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
  </svg>
)

const MicrosoftMark = () => (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
    <path fill="#F25022" d="M2 2h9.5v9.5H2z" /><path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
    <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" /><path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
  </svg>
)

/** Marco común de las pantallas sin sesión. */
function Marco({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl" />
      <div className="animate-pop-in relative w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-xl">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-brand text-lg font-bold text-brand-fg">P</span>
          <h1 className="text-xl font-semibold tracking-tight text-fg">{titulo}</h1>
          <p className="mt-1 text-sm text-muted">{subtitulo}</p>
        </div>
        {children}
      </div>
    </main>
  )
}

export default function Login() {
  const { entrar, iniciar, error } = useAuth()
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [intentado, setIntentado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [errorForm, setErrorForm] = useState<unknown>(null)
  const [proveedor, setProveedor] = useState<Proveedor | null>(null)

  const errores = {
    correo: intentado && !/^\S+@\S+\.\S+$/.test(correo.trim()) ? 'Escribe tu correo corporativo' : undefined,
    password: intentado && !password ? 'Escribe tu contraseña' : undefined,
  }

  const enviar = async () => {
    setIntentado(true)
    if (!/^\S+@\S+\.\S+$/.test(correo.trim()) || !password) return
    setEnviando(true)
    setErrorForm(null)
    try {
      await entrar(correo.trim().toLowerCase(), password)
    } catch (e) {
      setErrorForm(e)
      setPassword('')
    } finally {
      setEnviando(false)
    }
  }

  const conProveedor = async (p: Proveedor) => {
    setProveedor(p)
    try { await iniciar(p) } finally { setProveedor(null) }
  }

  const boton = (p: Proveedor, label: string, mark: ReactNode) => (
    <button
      type="button" onClick={() => conProveedor(p)} disabled={proveedor !== null || enviando}
      className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-border-strong bg-surface text-sm font-medium text-fg transition-colors hover:bg-surface-2 focus-visible:ring-4 focus-visible:ring-[var(--ring)] focus-visible:outline-none disabled:opacity-60"
    >
      {proveedor === p ? <Loader2 className="size-5 animate-spin" aria-hidden /> : mark}
      {label}
    </button>
  )

  return (
    <Marco titulo="Gestión de proyectos DTI" subtitulo="Inicia sesión con tu cuenta corporativa.">
      <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); void enviar() }}>
        <TextField label="Correo" type="email" name="username" autoComplete="username" inputMode="email" autoCapitalize="none"
          autoFocus placeholder="nombre@petroil.com.mx" value={correo} onChange={(e) => setCorreo(e.target.value)} error={errores.correo} />
        <PasswordField label="Contraseña" name="password" autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} error={errores.password} />
        <FormError error={errorForm ?? error} />
        <Button type="submit" variant="primary" className="h-11 w-full" loading={enviando} disabled={proveedor !== null}>Iniciar sesión</Button>
      </form>
      <p className="mt-3 text-center text-xs text-muted">
        ¿Olvidaste tu contraseña o aún no tienes una? Pide a tu gerente o al administrador una contraseña temporal.
      </p>

      {FIREBASE_DISPONIBLE && (
        <>
          <div className="my-6 flex items-center gap-3 text-xs text-muted" aria-hidden>
            <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-3">
            {boton('google', 'Continuar con Google', <GoogleMark />)}
            {boton('microsoft', 'Continuar con Microsoft', <MicrosoftMark />)}
          </div>
        </>
      )}
      <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted">
        <ShieldCheck className="size-3.5" aria-hidden /> El acceso depende de tu rol en el Equipo.
      </p>
    </Marco>
  )
}

/** Tras entrar con una contraseña temporal: hay que elegir una propia antes de usar la app (la API también lo exige). */
export function CambiarPasswordTemporal() {
  const { sesion, salir } = useAuth()
  const [pendiente, setPendiente] = useState(false)
  return (
    <Marco titulo="Crea tu contraseña" subtitulo={`Hola, ${sesion?.nombre.split(' ')[0] ?? ''}. Entraste con una contraseña temporal; elige una propia para continuar.`}>
      <CambiarPasswordForm id="cambiar-temporal" onListo={() => {}} onPendiente={setPendiente} />
      <Button type="submit" form="cambiar-temporal" variant="primary" className="mt-5 h-11 w-full" loading={pendiente}
        icon={<KeyRound className="size-4" />}>Guardar y continuar</Button>
      <Button variant="ghost" className="mt-2 w-full" icon={<LogOut className="size-4" />} onClick={() => void salir()}>Salir</Button>
    </Marco>
  )
}
