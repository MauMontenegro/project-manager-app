/** Firebase se carga bajo demanda: sin él configurado no entra en el bundle inicial. */
import type { Auth, User } from 'firebase/auth'

export type Proveedor = 'google' | 'microsoft'

const env = import.meta.env
export const AUTH_ENABLED = env.VITE_AUTH_ENABLED === 'true'
/** Google / Microsoft solo si el proyecto de Firebase está configurado; el correo y contraseña siempre. */
export const FIREBASE_DISPONIBLE = AUTH_ENABLED && !!env.VITE_FIREBASE_API_KEY

let cache: Promise<{ auth: Auth; mod: typeof import('firebase/auth') }> | undefined

export function cargarFirebase() {
  cache ??= Promise.all([import('firebase/app'), import('firebase/auth')]).then(([{ initializeApp }, mod]) => {
    const app = initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY as string,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string,
      projectId: env.VITE_FIREBASE_PROJECT_ID as string,
    })
    return { auth: mod.getAuth(app), mod }
  })
  return cache
}

export async function iniciarSesion(proveedor: Proveedor): Promise<User> {
  const { auth, mod } = await cargarFirebase()
  const provider = proveedor === 'google' ? new mod.GoogleAuthProvider() : new mod.OAuthProvider('microsoft.com')
  if (proveedor === 'microsoft' && env.VITE_MICROSOFT_TENANT) {
    ;(provider as InstanceType<typeof mod.OAuthProvider>).setCustomParameters({ tenant: env.VITE_MICROSOFT_TENANT as string })
  }
  provider.setCustomParameters?.({ prompt: 'select_account' })
  return (await mod.signInWithPopup(auth, provider)).user
}

export async function cerrarSesion() {
  const { auth, mod } = await cargarFirebase()
  await mod.signOut(auth)
}
