/** Sesión iniciada con correo y contraseña: el token que emite la API, guardado en este navegador hasta que expira. */
const CLAVE = 'pm.sesion'

export function leerSesion(): string | null {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as { token: string; expira: string } | null
    if (s && new Date(s.expira).getTime() > Date.now()) return s.token
    localStorage.removeItem(CLAVE)
  } catch { /* almacenamiento bloqueado: la sesión dura lo que la pestaña */ }
  return null
}

export function guardarSesion(token: string | null, expira?: string) {
  try {
    if (token && expira) localStorage.setItem(CLAVE, JSON.stringify({ token, expira }))
    else localStorage.removeItem(CLAVE)
  } catch { /* idem */ }
}
