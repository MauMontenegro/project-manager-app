import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/http'
import type {
  Area, AreaCreate, Asignacion, AsignacionCreate, Bloqueo, BloqueoCreate, BloqueosFiltro, BloqueoUpdate,
  Empresa, EmpresaCreate, EstadoProyecto, Etapa, EtapaCreate, Paginado, PerfilTecnico, Proyecto,
  ProyectoCreate, ProyectoDetalle, ProyectosFiltro, ProyectoUpdate, Usuario, UsuarioCreate, UsuarioUpdate,
} from '@/types/api'

export const keys = {
  empresas: ['empresas'] as const,
  areas: (id_empresa?: number) => ['areas', { id_empresa }] as const,
  usuarios: (f: object) => ['usuarios', f] as const,
  proyectos: (f: object) => ['proyectos', 'list', f] as const,
  proyecto: (id: number) => ['proyectos', 'detail', id] as const,
  etapas: (id: number) => ['etapas', id] as const,
  asignaciones: (id: number) => ['asignaciones', id] as const,
  bloqueos: (f: object) => ['bloqueos', f] as const,
}

// ---------- Empresas y áreas ----------
export const useEmpresas = () =>
  useQuery({ queryKey: keys.empresas, queryFn: () => http.get<Empresa[]>('/empresas') })

export function useCreateEmpresa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: EmpresaCreate) => http.post<Empresa>('/empresas', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['empresas'] }),
  })
}

export const useAreas = (id_empresa?: number) =>
  useQuery({ queryKey: keys.areas(id_empresa), queryFn: () => http.get<Area[]>('/areas', { id_empresa }) })

export function useCreateArea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AreaCreate) => http.post<Area>('/areas', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['areas'] }),
  })
}

// ---------- Usuarios ----------
export interface UsuariosFiltro {
  id_area?: number
  perfil_tecnico?: PerfilTecnico
  activo?: boolean
  q?: string
  limit?: number
  offset?: number
}

export const useUsuarios = (filtro: UsuariosFiltro = {}) =>
  useQuery({
    queryKey: keys.usuarios(filtro),
    queryFn: () => http.get<Usuario[]>('/usuarios', { limit: 200, ...filtro }),
    placeholderData: keepPreviousData,
  })

export function useCreateUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UsuarioCreate) => http.post<Usuario>('/usuarios', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })
}

export function useUpdateUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UsuarioUpdate }) =>
      http.patch<Usuario>(`/usuarios/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })
}

export function useDeactivateUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => http.delete(`/usuarios/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })
}

// ---------- Proyectos ----------
export const useProyectos = (filtro: ProyectosFiltro = {}) =>
  useQuery({
    queryKey: keys.proyectos(filtro),
    queryFn: () => http.get<Paginado<Proyecto>>('/proyectos', { limit: 50, ...filtro }),
    placeholderData: keepPreviousData,
  })

/** Solo el `total` con los filtros dados (una llamada ligera, `limit=1`). */
export const useProyectosTotal = (filtro: Omit<ProyectosFiltro, 'limit' | 'offset'>) =>
  useQuery({
    queryKey: keys.proyectos({ ...filtro, count: true }),
    queryFn: async () => (await http.get<Paginado<Proyecto>>('/proyectos', { ...filtro, limit: 1 })).total,
  })

export const useProyecto = (id: number) =>
  useQuery({ queryKey: keys.proyecto(id), queryFn: () => http.get<ProyectoDetalle>(`/proyectos/${id}`) })

export function useCreateProyecto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ProyectoCreate) => http.post<ProyectoDetalle>('/proyectos', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proyectos'] }),
  })
}

export function useUpdateProyecto(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ProyectoUpdate) => http.patch<ProyectoDetalle>(`/proyectos/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proyectos'] }),
  })
}

export function useCambiarEstado(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { estado_proyecto: EstadoProyecto; fecha_real_cierre?: string }) =>
      http.patch<ProyectoDetalle>(`/proyectos/${id}/estado`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proyectos'] }),
  })
}

// ---------- Etapas ----------
export const useEtapas = (id_proyecto: number) =>
  useQuery({ queryKey: keys.etapas(id_proyecto), queryFn: () => http.get<Etapa[]>(`/proyectos/${id_proyecto}/etapas`) })

export function useCreateEtapa(id_proyecto: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: EtapaCreate) => http.post<Etapa>(`/proyectos/${id_proyecto}/etapas`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.etapas(id_proyecto) }),
  })
}

// ---------- Asignaciones ----------
export const useAsignaciones = (id_proyecto: number) =>
  useQuery({
    queryKey: keys.asignaciones(id_proyecto),
    queryFn: () => http.get<Asignacion[]>(`/proyectos/${id_proyecto}/asignaciones`),
  })

export function useCreateAsignacion(id_proyecto: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AsignacionCreate) => http.post<Asignacion>(`/proyectos/${id_proyecto}/asignaciones`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.asignaciones(id_proyecto) }),
  })
}

// ---------- Bloqueos ----------
export const useBloqueos = (filtro: BloqueosFiltro = {}) =>
  useQuery({
    queryKey: keys.bloqueos(filtro),
    queryFn: () => http.get<Bloqueo[]>('/bloqueos', { limit: 50, ...filtro }),
    placeholderData: keepPreviousData,
  })

export function useCreateBloqueo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BloqueoCreate) => http.post<Bloqueo>('/bloqueos', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bloqueos'] }),
  })
}

export function useUpdateBloqueo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: BloqueoUpdate }) => http.patch<Bloqueo>(`/bloqueos/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bloqueos'] }),
  })
}

export function useCerrarBloqueo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fecha_fin_bloqueo }: { id: number; fecha_fin_bloqueo?: string }) =>
      http.post<Bloqueo>(`/bloqueos/${id}/cerrar`, fecha_fin_bloqueo ? { fecha_fin_bloqueo } : {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bloqueos'] }),
  })
}

export function useDeleteBloqueo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => http.delete(`/bloqueos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bloqueos'] }),
  })
}
