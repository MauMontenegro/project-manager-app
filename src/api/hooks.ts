import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/http'
import type {
  Area, AreaCreate, Asignacion, ConfiguracionGuardada, EventoTarea, Involucrado, Notificaciones, ConfiguracionLaboral, HorasLaborales, AsignacionCreate, AsignacionPersona, Ausencia, AusenciaCreate, Bitacora, Bloqueo,
  BloqueoCreate, BloqueosFiltro, BloqueoUpdate, CapacidadFiltro, CapacidadPersona, Departamento, Empresa,
  EmpresaCreate, EmpresasEliminadas, CambioCiclo, DepartamentoProyecto, Etapa, EtapaUpdate, Etiqueta, EtiquetaIn,
  PlantillaEtapa, PlantillaEtapaIn, SubproyectoIn, NivelSkill, Paginado, Proyecto, ProyectoCreate,
  ProyectoDetalle, ProyectosFiltro, ProyectoUpdate, Puesto, PuestoCreate, Sesion, SkillCatalogo, Tarea, TareaCreate,
  TareaUpdate, TipoRecurso,
  SkillAsignada, Usuario, UsuarioCreate, UsuarioUpdate,
  TareaRecurrente, TareaRecurrenteCreate, TareaRecurrenteUpdate, TareasRecurrentesFiltro, Reprogramacion, ResumenBloqueos,
  EquipoTrabajo, EquipoTrabajoIn,
} from '@/types/api'

export const keys = {
  empresas: ['empresas'] as const,
  areas: (id_empresa?: number) => ['areas', { id_empresa }] as const,
  sesion: ['sesion'] as const,
  puestos: ['puestos'] as const,
  skills: ['skills'] as const,
  usuarios: (f: object) => ['usuarios', 'list', f] as const,
  usuario: (id: number) => ['usuarios', 'detail', id] as const,
  asignacionesPersona: (id: number) => ['usuarios', 'asignaciones', id] as const,
  ausencias: (id: number) => ['ausencias', id] as const,
  capacidad: (f: object) => ['capacidad', f] as const,
  bitacora: (id: number) => ['bitacora', id] as const,
  proyectos: (f: object) => ['proyectos', 'list', f] as const,
  proyecto: (id: number) => ['proyectos', 'detail', id] as const,
  etapas: (id: number) => ['etapas', id] as const,
  asignaciones: (id: number) => ['asignaciones', id] as const,
  bloqueos: (f: object) => ['bloqueos', f] as const,
  tareasProyecto: (id: number) => ['tareas', 'proyecto', id] as const,
  tareasPersona: (id_usuario?: number) => ['tareas', 'persona', id_usuario ?? 'yo'] as const,
  configuracion: ['configuracion'] as const,
  involucrados: (id_proyecto: number) => ['involucrados', id_proyecto] as const,
  actividadTarea: (id_tarea: number) => ['tareas', 'actividad', id_tarea] as const,
  notificaciones: ['notificaciones'] as const,
  horasLaborales: (desde: string, hasta: string) => ['configuracion', 'horas', desde, hasta] as const,
  plantillaEtapas: (d: DepartamentoProyecto) => ['departamentos', d, 'etapas'] as const,
  etiquetas: (d?: DepartamentoProyecto) => ['etiquetas', d ?? 'todas'] as const,
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

/** Solo Administrador. Elimina las que no están en uso (con sus áreas) y reporta las demás. */
export function useEliminarEmpresas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) => http.post<EmpresasEliminadas>('/empresas/eliminar', { ids }),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['empresas'] }), qc.invalidateQueries({ queryKey: ['areas'] })]),
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

// ---------- Sesión ----------
export const useSesion = (enabled = true) =>
  useQuery({ queryKey: keys.sesion, queryFn: () => http.get<Sesion>('/sesion'), enabled, staleTime: Infinity, retry: false })

// ---------- Puestos ----------
export const usePuestos = () =>
  useQuery({ queryKey: keys.puestos, queryFn: () => http.get<Puesto[]>('/puestos') })

export function useCreatePuesto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PuestoCreate) => http.post<Puesto>('/puestos', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.puestos }),
  })
}

export function useDeletePuesto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => http.delete(`/puestos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.puestos }),
  })
}

// ---------- Catálogo de skills ----------
export const useSkills = () =>
  useQuery({ queryKey: keys.skills, queryFn: () => http.get<SkillCatalogo[]>('/skills') })

/** Renombrar, fusionar o eliminar un skill afecta a las personas que lo tienen. */
function useSkillMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: keys.skills }), qc.invalidateQueries({ queryKey: ['usuarios'] })]),
  })
}
export const useRenameSkill = () =>
  useSkillMutation(({ id, nombre }: { id: number; nombre: string }) => http.patch(`/skills/${id}`, { nombre }))
export const useMergeSkill = () =>
  useSkillMutation(({ id, id_destino }: { id: number; id_destino: number }) => http.post(`/skills/${id}/fusionar`, { id_destino }))
export const useDeleteSkill = () => useSkillMutation((id: number) => http.delete(`/skills/${id}`))

// ---------- Usuarios ----------
export interface UsuariosFiltro {
  id_puesto?: number
  departamento?: Departamento
  tipo_recurso?: TipoRecurso
  id_jefe?: number
  skill?: string
  nivel_min?: NivelSkill
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

export const useUsuario = (id: number, enabled = true) =>
  useQuery({ queryKey: keys.usuario(id), queryFn: () => http.get<Usuario>(`/usuarios/${id}`), enabled })

/** Ficha de quien inició sesión (solo si la sesión está ligada a una persona del Equipo). */
/** Asigna una contraseña temporal (la indicada o una generada por la API) que la persona cambia al entrar. */
export function useRestablecerPassword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, nueva }: { id: number; nueva?: string }) =>
      http.post<{ password_temporal: string }>(`/usuarios/${id}/password`, { nueva: nueva || null }),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['usuarios'] }), qc.invalidateQueries({ queryKey: ['bitacora'] }),
    ]),
  })
}

export const usePerfil = (enabled: boolean) =>
  useQuery({ queryKey: ['usuarios', 'perfil'], queryFn: () => http.get<Usuario>('/perfil'), enabled })

/** Cada persona edita su nombre y sus skills. */
export function useActualizarPerfil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { nombre?: string; skills?: SkillAsignada[] }) => http.patch<Usuario>('/perfil', body),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['usuarios'] }), qc.invalidateQueries({ queryKey: ['sesion'] }),
      qc.invalidateQueries({ queryKey: ['skills'] }), qc.invalidateQueries({ queryKey: ['bitacora'] }),
    ]),
  })
}

export const useAsignacionesPersona = (id: number) =>
  useQuery({ queryKey: keys.asignacionesPersona(id), queryFn: () => http.get<AsignacionPersona[]>(`/usuarios/${id}/asignaciones`) })

export const useBitacoraPersona = (id: number) =>
  useQuery({ queryKey: keys.bitacora(id), queryFn: () => http.get<Bitacora[]>(`/usuarios/${id}/bitacora`, { limit: 30 }) })

/** Cambios en el Equipo afectan listas, fichas, catálogo de skills, capacidad y bitácora. */
const invalidarEquipo = (qc: ReturnType<typeof useQueryClient>) =>
  Promise.all(['usuarios', 'skills', 'capacidad', 'bitacora'].map((k) => qc.invalidateQueries({ queryKey: [k] })))

export function useCreateUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UsuarioCreate) => http.post<Usuario>('/usuarios', body),
    onSuccess: () => invalidarEquipo(qc),
  })
}

export function useUpdateUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UsuarioUpdate }) => http.patch<Usuario>(`/usuarios/${id}`, body),
    onSuccess: () => invalidarEquipo(qc),
  })
}

export function useDeactivateUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => http.delete(`/usuarios/${id}`),
    onSuccess: () => invalidarEquipo(qc),
  })
}

// ---------- Ausencias ----------
export const useAusencias = (id_usuario: number) =>
  useQuery({ queryKey: keys.ausencias(id_usuario), queryFn: () => http.get<Ausencia[]>(`/usuarios/${id_usuario}/ausencias`) })

export function useCreateAusencia(id_usuario: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AusenciaCreate) => http.post<Ausencia>(`/usuarios/${id_usuario}/ausencias`, body),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: keys.ausencias(id_usuario) }), invalidarEquipo(qc)]),
  })
}

export function useDeleteAusencia(id_usuario: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => http.delete(`/ausencias/${id}`),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: keys.ausencias(id_usuario) }), invalidarEquipo(qc)]),
  })
}

// ---------- Capacidad ----------
export const useCapacidad = (filtro: CapacidadFiltro, enabled = true) =>
  useQuery({
    queryKey: keys.capacidad(filtro),
    queryFn: () => http.get<CapacidadPersona[]>('/capacidad', { ...filtro }),
    placeholderData: keepPreviousData,
    enabled,
  })

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
    mutationFn: (body: CambioCiclo) => http.patch<ProyectoDetalle>(`/proyectos/${id}/estado`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proyectos'] })
      qc.invalidateQueries({ queryKey: keys.etapas(id) })
      qc.invalidateQueries({ queryKey: ['usuarios', 'asignaciones'] })
      qc.invalidateQueries({ queryKey: ['capacidad'] })
    },
  })
}

export function useDeleteProyecto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => http.delete(`/proyectos/${id}`),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: keys.proyecto(id) })
      for (const key of [['proyectos'], ['bloqueos'], ['usuarios', 'asignaciones'], ['capacidad']]) {
        qc.invalidateQueries({ queryKey: key })
      }
    },
  })
}

/** Elimina varios proyectos (uno por uno). No se detiene ante un fallo: devuelve cuáles no se pudieron
 * eliminar y por qué. Incluir un conjunto ya elimina sus subproyectos. */
export function useDeleteProyectos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => {
      const fallidos: { id: number; motivo: string }[] = []
      for (const id of ids) {
        try {
          await http.delete(`/proyectos/${id}`)
          qc.removeQueries({ queryKey: keys.proyecto(id) })
        } catch (e) {
          fallidos.push({ id, motivo: e instanceof Error ? e.message : 'Error desconocido' })
        }
      }
      return { eliminados: ids.length - fallidos.length, fallidos }
    },
    onSettled: () => {
      for (const key of [['proyectos'], ['bloqueos'], ['usuarios', 'asignaciones'], ['capacidad'], ['tareas']]) {
        qc.invalidateQueries({ queryKey: key })
      }
    },
  })
}

/** Suma un departamento a un proyecto conjunto. */
export function useAgregarSubproyecto(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SubproyectoIn) => http.post<ProyectoDetalle>(`/proyectos/${id}/subproyectos`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proyectos'] }),
  })
}

/** Quita un departamento del conjunto (solo si su subproyecto no tiene tareas). */
export function useQuitarSubproyecto(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id_subproyecto: number) => http.delete<ProyectoDetalle>(`/proyectos/${id}/subproyectos/${id_subproyecto}`),
    onSuccess: (_, id_subproyecto) => {
      qc.removeQueries({ queryKey: keys.proyecto(id_subproyecto) })
      qc.invalidateQueries({ queryKey: ['proyectos'] })
    },
  })
}

// ---------- Departamentos: plantilla de etapas y etiquetas ----------
const enc = encodeURIComponent

export const usePlantillaEtapas = (d: DepartamentoProyecto | null | undefined) =>
  useQuery({
    queryKey: keys.plantillaEtapas(d!),
    queryFn: () => http.get<PlantillaEtapa[]>(`/departamentos/${enc(d!)}/etapas`),
    enabled: !!d,
  })

/** Reemplaza las etapas del departamento; solo afecta a los proyectos que se creen después. */
export function useGuardarPlantillaEtapas(d: DepartamentoProyecto) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (etapas: PlantillaEtapaIn[]) => http.put<PlantillaEtapa[]>(`/departamentos/${enc(d)}/etapas`, { etapas }),
    onSuccess: (data) => qc.setQueryData(keys.plantillaEtapas(d), data),
  })
}

export const useEtiquetas = (d?: DepartamentoProyecto) =>
  useQuery({ queryKey: keys.etiquetas(d), queryFn: () => http.get<Etiqueta[]>('/etiquetas', { departamento: d }) })

/** Las etiquetas viajan dentro de cada proyecto: al cambiarlas se refrescan también los proyectos. */
function useInvalidarEtiquetas() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['etiquetas'] })
    qc.invalidateQueries({ queryKey: ['proyectos'] })
  }
}

export function useCrearEtiqueta() {
  const invalidar = useInvalidarEtiquetas()
  return useMutation({
    mutationFn: ({ departamento, ...body }: EtiquetaIn & { departamento: DepartamentoProyecto }) =>
      http.post<Etiqueta>(`/departamentos/${enc(departamento)}/etiquetas`, body),
    onSuccess: invalidar,
  })
}

export function useActualizarEtiqueta() {
  const invalidar = useInvalidarEtiquetas()
  return useMutation({
    mutationFn: ({ id_etiqueta, ...body }: EtiquetaIn & { id_etiqueta: number }) =>
      http.patch<Etiqueta>(`/etiquetas/${id_etiqueta}`, body),
    onSuccess: invalidar,
  })
}

export function useEliminarEtiqueta() {
  const invalidar = useInvalidarEtiquetas()
  return useMutation({
    mutationFn: (id_etiqueta: number) => http.delete(`/etiquetas/${id_etiqueta}`),
    onSuccess: invalidar,
  })
}

// ---------- Etapas ----------
export const useEtapas = (id_proyecto: number) =>
  useQuery({ queryKey: keys.etapas(id_proyecto), queryFn: () => http.get<Etapa[]>(`/proyectos/${id_proyecto}/etapas`), enabled: id_proyecto > 0 })

export function useUpdateEtapa(id_proyecto: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id_etapa, ...body }: EtapaUpdate & { id_etapa: number }) =>
      http.patch<Etapa>(`/proyectos/${id_proyecto}/etapas/${id_etapa}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.etapas(id_proyecto) })
      qc.invalidateQueries({ queryKey: ['capacidad'] })
    },
  })
}

// ---------- Asignaciones ----------
export const useAsignaciones = (id_proyecto: number) =>
  useQuery({
    queryKey: keys.asignaciones(id_proyecto),
    queryFn: () => http.get<Asignacion[]>(`/proyectos/${id_proyecto}/asignaciones`),
    enabled: id_proyecto > 0,
  })

export function useCreateAsignacion(id_proyecto: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AsignacionCreate) => http.post<Asignacion>(`/proyectos/${id_proyecto}/asignaciones`, body),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: keys.asignaciones(id_proyecto) }),
      ...['capacidad', 'bitacora'].map((k) => qc.invalidateQueries({ queryKey: [k] })),
      qc.invalidateQueries({ queryKey: ['usuarios', 'asignaciones'] }),
    ]),
  })
}

// ---------- Equipos de trabajo ----------
export const useEquiposTrabajo = () =>
  useQuery({ queryKey: ['equipos-trabajo'], queryFn: () => http.get<EquipoTrabajo[]>('/equipos-trabajo') })

function useInvalidarEquiposTrabajo() {
  const qc = useQueryClient()
  return () => { for (const key of [['equipos-trabajo'], ['proyectos'], ['bitacora']]) qc.invalidateQueries({ queryKey: key }) }
}

export function useCrearEquipoTrabajo() {
  const invalidar = useInvalidarEquiposTrabajo()
  return useMutation({ mutationFn: (body: EquipoTrabajoIn) => http.post<EquipoTrabajo>('/equipos-trabajo', body), onSuccess: invalidar })
}

export function useActualizarEquipoTrabajo() {
  const invalidar = useInvalidarEquiposTrabajo()
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<EquipoTrabajoIn> & { id: number }) => http.patch<EquipoTrabajo>(`/equipos-trabajo/${id}`, body),
    onSuccess: invalidar,
  })
}

export function useEliminarEquipoTrabajo() {
  const invalidar = useInvalidarEquiposTrabajo()
  return useMutation({ mutationFn: (id: number) => http.delete(`/equipos-trabajo/${id}`), onSuccess: invalidar })
}

// ---------- Bloqueos ----------
export const useBloqueos = (filtro: BloqueosFiltro = {}, enabled = true) =>
  useQuery({
    queryKey: keys.bloqueos(filtro),
    queryFn: () => http.get<Bloqueo[]>('/bloqueos', { limit: 50, ...filtro }),
    placeholderData: keepPreviousData,
    enabled,
  })

export const useResumenBloqueos = (filtro: {
  id_proyecto?: number; departamento?: DepartamentoProyecto; id_equipo_trabajo?: number; desde?: string; hasta?: string
} = {}) =>
  useQuery({
    queryKey: ['bloqueos', 'resumen', filtro],
    queryFn: () => http.get<ResumenBloqueos>('/bloqueos/resumen', filtro),
    placeholderData: keepPreviousData,
  })

/** Un bloqueo cambia también lo que muestran las tareas (marca, tiempo bloqueado) y su bitácora. */
function useInvalidarBloqueos() {
  const qc = useQueryClient()
  return () => { for (const key of [['bloqueos'], ['tareas']]) qc.invalidateQueries({ queryKey: key }) }
}

export function useCreateBloqueo() {
  const invalidar = useInvalidarBloqueos()
  return useMutation({
    mutationFn: (body: BloqueoCreate) => http.post<Bloqueo>('/bloqueos', body),
    onSuccess: invalidar,
  })
}

export function useUpdateBloqueo() {
  const invalidar = useInvalidarBloqueos()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: BloqueoUpdate }) => http.patch<Bloqueo>(`/bloqueos/${id}`, body),
    onSuccess: invalidar,
  })
}

export function useCerrarBloqueo() {
  const invalidar = useInvalidarBloqueos()
  return useMutation({
    mutationFn: ({ id, fecha_fin_bloqueo, nota_resolucion }: { id: number; fecha_fin_bloqueo?: string; nota_resolucion?: string | null }) =>
      http.post<Bloqueo>(`/bloqueos/${id}/cerrar`, { ...(fecha_fin_bloqueo && { fecha_fin_bloqueo }), nota_resolucion: nota_resolucion || null }),
    onSuccess: invalidar,
  })
}

export function useDeleteBloqueo() {
  const invalidar = useInvalidarBloqueos()
  return useMutation({
    mutationFn: (id: number) => http.delete(`/bloqueos/${id}`),
    onSuccess: invalidar,
  })
}

export const useReprogramaciones = (id_tarea: number) =>
  useQuery({
    queryKey: ['tareas', 'reprogramaciones', id_tarea],
    queryFn: () => http.get<Reprogramacion[]>(`/tareas/${id_tarea}/reprogramaciones`),
  })

export function useLineaBase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id_tarea, motivo }: { id_tarea: number; motivo: string }) => http.post<Tarea>(`/tareas/${id_tarea}/linea-base`, { motivo }),
    onSuccess: () => { for (const key of [['tareas'], ['bloqueos'], ['bitacora']]) qc.invalidateQueries({ queryKey: key }) },
  })
}

// ---------- Tareas ----------
export const useTareasProyecto = (id_proyecto: number) =>
  useQuery({
    queryKey: keys.tareasProyecto(id_proyecto),
    queryFn: () => http.get<Tarea[]>(`/proyectos/${id_proyecto}/tareas`),
    enabled: id_proyecto > 0,
  })

/** Sin `id_usuario`, las de quien inició sesión. */
export const useTareasPersona = (id_usuario?: number) =>
  useQuery({
    queryKey: keys.tareasPersona(id_usuario),
    queryFn: () => http.get<Tarea[]>('/tareas', { id_usuario }),
  })

/** Las tareas mueven el avance, la etapa, el estatus y el semáforo del proyecto. */
function useInvalidarTareas() {
  const qc = useQueryClient()
  return () => {
    // Las tareas cuentan en la carga (capacidad) y en las horas en tareas de cada asignación.
    for (const key of [['tareas'], ['proyectos'], ['etapas'], ['asignaciones'], ['capacidad']]) qc.invalidateQueries({ queryKey: key })
  }
}

export function useCreateTarea(id_proyecto: number) {
  const invalidar = useInvalidarTareas()
  return useMutation({
    mutationFn: (body: TareaCreate) => http.post<Tarea>(`/proyectos/${id_proyecto}/tareas`, body),
    onSuccess: invalidar,
  })
}

export function useUpdateTarea() {
  const qc = useQueryClient()
  const invalidar = useInvalidarTareas()
  return useMutation({
    mutationFn: ({ id_tarea, ...body }: TareaUpdate & { id_tarea: number }) => http.patch<Tarea>(`/tareas/${id_tarea}`, body),
    onSuccess: (t) => {
      // La respuesta ya trae la tarea al día: se refleja en las listas al instante, sin esperar a recargarlas.
      qc.setQueriesData<Tarea[]>({ queryKey: ['tareas'] }, (old) => Array.isArray(old) ? old.map((x) => (x.id_tarea === t.id_tarea ? t : x)) : old)
      invalidar()
    },
  })
}

export function useDeleteTarea() {
  const invalidar = useInvalidarTareas()
  return useMutation({ mutationFn: (id_tarea: number) => http.delete(`/tareas/${id_tarea}`), onSuccess: invalidar })
}

// ---------- Configuración ----------
export const useConfiguracion = () =>
  useQuery({ queryKey: keys.configuracion, queryFn: () => http.get<ConfiguracionLaboral>('/configuracion') })

/** Solo Administrador. Recalcula el presupuesto de los proyectos abiertos en modo automático. */
export function useGuardarConfiguracion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ConfiguracionLaboral) => http.put<ConfiguracionGuardada>('/configuracion', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['configuracion'] })
      qc.invalidateQueries({ queryKey: ['proyectos'] })
    },
  })
}

/** Horas laborales entre dos fechas según el calendario vigente (vista previa del presupuesto). */
export const useHorasLaborales = (desde?: string | null, hasta?: string | null) =>
  useQuery({
    queryKey: keys.horasLaborales(desde ?? '', hasta ?? ''),
    queryFn: () => http.get<HorasLaborales>('/configuracion/horas-laborales', { desde, hasta }),
    enabled: !!desde && !!hasta && hasta >= desde,
  })

// ---------- Colaboración: comentarios, menciones y notificaciones ----------
export const useInvolucrados = (id_proyecto: number) =>
  useQuery({
    queryKey: keys.involucrados(id_proyecto),
    queryFn: () => http.get<Involucrado[]>(`/proyectos/${id_proyecto}/involucrados`),
    enabled: id_proyecto > 0,
  })

/** Quiénes pueden comentar y ser mencionados en una tarea (de proyecto o recurrente). */
export const useInvolucradosTarea = (id_tarea: number) =>
  useQuery({
    queryKey: ['involucrados', 'tarea', id_tarea],
    queryFn: () => http.get<Involucrado[]>(`/tareas/${id_tarea}/involucrados`),
  })

export const useTarea = (id_tarea: number | null) =>
  useQuery({
    queryKey: ['tareas', 'detalle', id_tarea],
    queryFn: () => http.get<Tarea>(`/tareas/${id_tarea}`),
    enabled: id_tarea != null,
  })

// ---------- Tareas recurrentes (operación) ----------
export const useTareasRecurrentes = (filtro: TareasRecurrentesFiltro = {}) =>
  useQuery({
    queryKey: ['recurrentes', filtro],
    queryFn: () => http.get<TareaRecurrente[]>('/tareas-recurrentes', { ...filtro }),
  })

/** Las plantillas generan tareas: al cambiarlas se refrescan también tareas y capacidad. */
function useInvalidarRecurrentes() {
  const qc = useQueryClient()
  return () => { for (const key of [['recurrentes'], ['tareas'], ['capacidad']]) qc.invalidateQueries({ queryKey: key }) }
}

export function useCrearRecurrente() {
  const invalidar = useInvalidarRecurrentes()
  return useMutation({
    mutationFn: (body: TareaRecurrenteCreate) => http.post<TareaRecurrente>('/tareas-recurrentes', body),
    onSuccess: invalidar,
  })
}

export function useActualizarRecurrente() {
  const invalidar = useInvalidarRecurrentes()
  return useMutation({
    mutationFn: ({ id_recurrente, ...body }: TareaRecurrenteUpdate & { id_recurrente: number }) =>
      http.patch<TareaRecurrente>(`/tareas-recurrentes/${id_recurrente}`, body),
    onSuccess: invalidar,
  })
}

export function useEliminarRecurrente() {
  const invalidar = useInvalidarRecurrentes()
  return useMutation({
    mutationFn: (id_recurrente: number) => http.delete(`/tareas-recurrentes/${id_recurrente}`),
    onSuccess: invalidar,
  })
}

/** Cambios y comentarios de la tarea, del más antiguo al más reciente. */
export const useActividadTarea = (id_tarea: number) =>
  useQuery({ queryKey: keys.actividadTarea(id_tarea), queryFn: () => http.get<EventoTarea[]>(`/tareas/${id_tarea}/actividad`) })

export function useComentar(id_tarea: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { texto: string; menciones: number[] }) => http.post<EventoTarea>(`/tareas/${id_tarea}/comentarios`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tareas'] }),
  })
}

export function useDeleteComentario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id_comentario: number) => http.delete(`/comentarios/${id_comentario}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tareas'] }),
  })
}

/** Menciones de quien inició sesión; se consulta cada minuto. */
export const useNotificaciones = () =>
  useQuery({
    queryKey: keys.notificaciones,
    queryFn: () => http.get<Notificaciones>('/notificaciones'),
    refetchInterval: 60_000,
  })

export function useLeerNotificacion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id_mencion?: number) =>
      http.post<void>(id_mencion ? `/notificaciones/${id_mencion}/leer` : '/notificaciones/leer-todas'),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notificaciones }),
  })
}
