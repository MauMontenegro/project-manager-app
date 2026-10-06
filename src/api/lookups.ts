import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { http } from '@/lib/http'
import type { Etapa } from '@/types/api'
import { keys, useEmpresas, useProyectos, useUsuarios } from './hooks'

/** Mapas id → nombre para resolver FKs en tablas y listas. */
export function useUsuarioMap() {
  const q = useUsuarios({ limit: 200 })
  const map = useMemo(() => new Map((q.data ?? []).map((u) => [u.id_usuario, u])), [q.data])
  return { map, ...q }
}

export function useEmpresaMap() {
  const q = useEmpresas()
  const map = useMemo(() => new Map((q.data ?? []).map((e) => [e.id_empresa, e])), [q.data])
  return { map, ...q }
}

export function useProyectoMap() {
  const q = useProyectos({ limit: 200 })
  const map = useMemo(() => new Map((q.data?.items ?? []).map((p) => [p.id_proyecto, p])), [q.data])
  return { map, ...q }
}

/** Mapa id_etapa → etapa para un conjunto de proyectos (una consulta por proyecto, cacheada). */
export function useEtapaMap(projectIds: number[]) {
  const ids = useMemo(() => [...new Set(projectIds)].sort((a, b) => a - b), [projectIds])
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: keys.etapas(id),
      queryFn: () => http.get<Etapa[]>(`/proyectos/${id}/etapas`),
    })),
  })
  const data = results.map((r) => r.data)
  return useMemo(() => new Map(data.flatMap((l) => l ?? []).map((e) => [e.id_etapa, e])), [JSON.stringify(data)]) // eslint-disable-line react-hooks/exhaustive-deps
}
