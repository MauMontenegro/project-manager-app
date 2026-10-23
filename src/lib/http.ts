const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'
const PREFIX = '/api/v1'

interface ValidationIssue {
  loc?: Array<string | number>
  msg?: string
}

/** Error de la API. `detail` puede ser string (404/409/422 de negocio) o lista (422 de esquema). */
export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(status: number, detail: unknown, fallback: string) {
    super(ApiError.toMessage(detail, fallback))
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }

  static toMessage(detail: unknown, fallback: string): string {
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return (detail as ValidationIssue[])
        .map((d) => {
          const field = d.loc?.filter((p) => p !== 'body').join('.')
          return field ? `${field}: ${d.msg}` : (d.msg ?? '')
        })
        .filter(Boolean)
        .join(' · ')
    }
    return fallback
  }
}

type Query = Record<string, string | number | boolean | number[] | undefined | null>

/** Lo registra el proveedor de autenticación: token vigente y qué hacer ante un 401. */
let getToken: () => Promise<string | null> = async () => null
let onUnauthorized: () => void = () => {}
export function configureAuth(opts: { getToken: () => Promise<string | null>; onUnauthorized: () => void }) {
  getToken = opts.getToken
  onUnauthorized = opts.onUnauthorized
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${BASE_URL}${PREFIX}${path}`)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, String(x)))
      else if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

export async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  opts: { query?: Query; body?: unknown } = {},
): Promise<T> {
  let res: Response
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  const token = await getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new ApiError(0, null, 'No se pudo conectar con el servidor. Verifica que el backend esté en ejecución.')
  }

  if (res.status === 204) return undefined as T
  const text = await res.text()
  const data = text ? safeJson(text) : null

  if (res.status === 401) onUnauthorized()
  if (!res.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail
    throw new ApiError(res.status, detail, `Error ${res.status} del servidor`)
  }
  return data as T
}

/** POST cuya respuesta llega por partes en NDJSON (una línea JSON por evento), p. ej. el asistente de IA.
 * Llama a `onEvento` con cada línea a medida que llega. */
export async function streamNdjson<E>(path: string, body: unknown, onEvento: (e: E) => void, signal?: AbortSignal): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = await getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch(buildUrl(path), { method: 'POST', headers, body: JSON.stringify(body), signal })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new ApiError(0, null, 'No se pudo conectar con el servidor. Verifica que el backend esté en ejecución.')
  }
  if (res.status === 401) onUnauthorized()
  if (!res.ok || !res.body) {
    const data = safeJson(await res.text()) as { detail?: unknown } | null
    throw new ApiError(res.status, data?.detail, `Error ${res.status} del servidor`)
  }
  const lector = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let pendiente = ''
  for (;;) {
    const { value, done } = await lector.read()
    if (done) break
    pendiente += value
    const lineas = pendiente.split('\n')
    pendiente = lineas.pop() ?? ''
    for (const l of lineas) if (l.trim()) onEvento(JSON.parse(l) as E)
  }
  if (pendiente.trim()) onEvento(JSON.parse(pendiente) as E)
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export const http = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body: body ?? {} }),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, { body }),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, { body }),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
}
