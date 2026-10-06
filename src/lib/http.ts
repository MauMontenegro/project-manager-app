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

type Query = Record<string, string | number | boolean | undefined | null>

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${BASE_URL}${PREFIX}${path}`)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

export async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  opts: { query?: Query; body?: unknown } = {},
): Promise<T> {
  let res: Response
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new ApiError(0, null, 'No se pudo conectar con el servidor. Verifica que el backend esté en ejecución.')
  }

  if (res.status === 204) return undefined as T
  const text = await res.text()
  const data = text ? safeJson(text) : null

  if (!res.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail
    throw new ApiError(res.status, detail, `Error ${res.status} del servidor`)
  }
  return data as T
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
  delete: (path: string) => request<void>('DELETE', path),
}
