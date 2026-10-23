import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Auth, User } from 'firebase/auth'
import { keys, useSesion } from '@/api/hooks'
import { ApiError, configureAuth, http } from '@/lib/http'
import { DEPARTAMENTOS_PROYECTO, type Departamento, type ProyectoBase, type Sesion, type SesionToken } from '@/types/api'
import { AUTH_ENABLED, cargarFirebase, cerrarSesion, FIREBASE_DISPONIBLE, iniciarSesion, type Proveedor } from './firebase'
import { guardarSesion, leerSesion } from './sesionLocal'

type Estado = 'cargando' | 'anonimo' | 'autenticado'

interface AuthValue {
  estado: Estado
  sesion?: Sesion
  error: unknown
  /** Correo y contraseña. Lanza el error de la API (credenciales, demasiados intentos) para mostrarlo en el formulario. */
  entrar: (correo: string, password: string) => Promise<void>
  /** Google / Microsoft (solo si Firebase está configurado). */
  iniciar: (p: Proveedor) => Promise<void>
  cambiarPassword: (actual: string, nueva: string) => Promise<void>
  salir: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

/**
 * Con `VITE_AUTH_ENABLED=true` se entra con correo y contraseña (la API emite la sesión) y, si está configurado,
 * con Google / Microsoft vía Firebase; el token viaja en cada petición y la API resuelve el rol. Sin ella, la API
 * responde como la persona local y la app entra directo (solo desarrollo).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const tokenRef = useRef<string | null>(null)
  const fbRef = useRef<{ auth: Auth; mod: typeof import('firebase/auth') } | null>(null)
  const [token, setTokenState] = useState<string | null>(() => (tokenRef.current = AUTH_ENABLED ? leerSesion() : null))
  const [user, setUser] = useState<User | null | undefined>(FIREBASE_DISPONIBLE ? undefined : null)
  const [loginError, setLoginError] = useState<unknown>(null)

  const setToken = useCallback((t: string | null, expira?: string) => {
    tokenRef.current = t
    guardarSesion(t, expira)
    setTokenState(t)
  }, [])

  // Se registra antes de la primera petición (en el render inicial), no en un efecto.
  useState(() => configureAuth({
    getToken: async () => tokenRef.current ?? (await fbRef.current?.auth.currentUser?.getIdToken()) ?? null,
    onUnauthorized: () => {
      if (tokenRef.current) {
        setToken(null)
        setLoginError(new ApiError(401, null, 'Tu sesión expiró o se cerró. Vuelve a iniciar sesión.'))
        qc.clear()
      }
      if (fbRef.current) void fbRef.current.mod.signOut(fbRef.current.auth)
    },
  }))

  useEffect(() => {
    if (!FIREBASE_DISPONIBLE) return
    let unsub = () => {}
    cargarFirebase().then((fb) => {
      fbRef.current = fb
      unsub = fb.mod.onAuthStateChanged(fb.auth, (u) => {
        setUser(u)
        if (!u && !tokenRef.current) qc.clear()
      })
    })
    return () => unsub()
  }, [qc])

  const sesion = useSesion(!AUTH_ENABLED || !!token || !!user)

  // Cuenta válida en Firebase pero no registrada en el Equipo (403): se cierra la sesión.
  useEffect(() => {
    if (user && !token && sesion.isError) {
      setLoginError(sesion.error)
      void cerrarSesion()
    }
  }, [user, token, sesion.isError, sesion.error])

  const entrar = useCallback(async (correo: string, password: string) => {
    setLoginError(null)
    const s = await http.post<SesionToken>('/auth/login', { correo, password })
    qc.removeQueries({ queryKey: keys.sesion })
    setToken(s.access_token, s.expira)
  }, [qc, setToken])

  const iniciar = useCallback(async (p: Proveedor) => {
    setLoginError(null)
    try {
      await iniciarSesion(p)
    } catch (e) {
      // Cerrar la ventana emergente no es un error que mostrar.
      if (!(e instanceof Error && e.message.includes('popup-closed'))) setLoginError(e)
    }
  }, [])

  const cambiarPassword = useCallback(async (actual: string, nueva: string) => {
    const s = await http.post<SesionToken>('/auth/password', { actual, nueva })
    setToken(s.access_token, s.expira)
    await Promise.all([qc.invalidateQueries({ queryKey: keys.sesion }), qc.invalidateQueries({ queryKey: ['usuarios'] })])
  }, [qc, setToken])

  const salir = useCallback(async () => {
    setLoginError(null)
    setToken(null)
    if (user) await cerrarSesion()
    qc.clear()
  }, [qc, setToken, user])

  const habilitada = !AUTH_ENABLED || !!token || !!user
  const estado: Estado =
    user === undefined || (habilitada && sesion.isPending)
      ? 'cargando'
      : habilitada && sesion.data ? 'autenticado' : 'anonimo'

  const value = useMemo(
    () => ({
      estado, sesion: habilitada ? sesion.data : undefined,
      error: loginError ?? (AUTH_ENABLED ? null : sesion.error), entrar, iniciar, cambiarPassword, salir,
    }),
    [estado, habilitada, sesion.data, sesion.error, loginError, entrar, iniciar, cambiarPassword, salir],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

/** Reglas de la interfaz; reflejan las de la API (que es la que realmente las impone). */
export function usePermisos() {
  const { sesion } = useAuth()
  return useMemo(() => {
    const rol = sesion?.rol
    const esAdmin = rol === 'Administrador'
    const gestionaEquipo = esAdmin || rol === 'Gerente'
    /** Administrador: en cualquier departamento. Gerente y Líder: en el suyo. */
    const creaProyectosEn = (d: string | null | undefined) =>
      esAdmin || ((rol === 'Gerente' || rol === 'Líder') && !!d && d === sesion?.departamento)
    return {
      esAdmin,
      gestionaEquipo,
      creaProyectosEn,
      /** Puede crear algún proyecto: Administrador, Gerente o Líder de un departamento con espacio de proyectos. */
      creaProyectos: DEPARTAMENTOS_PROYECTO.some(creaProyectosEn),
      veCostos: gestionaEquipo,
      gestionaDepartamento: (d: Departamento | null | undefined) =>
        esAdmin || (rol === 'Gerente' && (d == null || d === sesion?.departamento)),
      esYo: (id: number) => sesion?.id_usuario === id,
      puedeAsignar: (liderId: number) => gestionaEquipo || sesion?.id_usuario === liderId,
      /** Administrador o Gerente de ese departamento (crear proyectos ahí, editar su configuración). */
      gestionaDepartamentoProyecto: (d: string | null | undefined) =>
        esAdmin || (rol === 'Gerente' && !!d && d === sesion?.departamento),
      /** Administrador y líder: siempre. Un conjunto, solo ellos; los demás, también el Gerente de su
       * departamento (o cualquier Gerente si aún no tiene). */
      gestionaProyecto: (p: Pick<ProyectoBase, 'lider_id' | 'es_conjunto' | 'departamento'>) =>
        esAdmin || sesion?.id_usuario === p.lider_id
        || (!p.es_conjunto && rol === 'Gerente' && (p.departamento == null || p.departamento === sesion?.departamento)),
    }
  }, [sesion])
}
