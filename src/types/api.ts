/** Tipos y enums del backend (ver API.md). Los decimales viajan como string. */

export const PERFILES_TECNICOS = [
  'Análisis Funcional', 'Backend', 'Frontend', 'Testing', 'Infraestructura', 'Líder', 'Cliente',
] as const
export type PerfilTecnico = (typeof PERFILES_TECNICOS)[number]

export const ESTADOS_PROYECTO = [
  'Iniciación', 'Planeación', 'Ejecución', 'Cierre', 'Cancelado', 'Pausado',
] as const
export type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number]

export const SEMAFOROS = ['Verde', 'Amarillo', 'Rojo'] as const
export type Semaforo = (typeof SEMAFOROS)[number]

export const NIVELES_IMPACTO = ['Alto', 'Medio', 'Bajo'] as const
export type NivelImpacto = (typeof NIVELES_IMPACTO)[number]

export const NOMBRES_ETAPA = ['Análisis', 'Arquitectura', 'Desarrollo', 'Testing', 'Implementación'] as const
export type NombreEtapa = (typeof NOMBRES_ETAPA)[number]

export const ESTADOS_ETAPA = ['Pendiente', 'En Curso', 'Detenido', 'Completado'] as const
export type EstadoEtapa = (typeof ESTADOS_ETAPA)[number]

export const CAUSAS_RAIZ = [
  'Cambio de Prioridad', 'Dependencia Externa', 'Falta de Información', 'Recurso Reasignado',
  'Incidente Operativo', 'Cambio de Alcance', 'Retrabajo', 'Espera del Cliente', 'Decisión Pendiente',
] as const
export type CausaRaiz = (typeof CAUSAS_RAIZ)[number]

export const RESPONSABLES_ORIGEN = ['DTI', 'Cliente', 'Tercero'] as const
export type ResponsableOrigen = (typeof RESPONSABLES_ORIGEN)[number]

/** Decimal serializado por el backend. */
export type Decimal = string

/** Transiciones válidas del ciclo de vida (API.md §5.1). */
export const TRANSICIONES: Record<EstadoProyecto, EstadoProyecto[]> = {
  Iniciación: ['Planeación', 'Pausado', 'Cancelado'],
  Planeación: ['Ejecución', 'Pausado', 'Cancelado'],
  Ejecución: ['Cierre', 'Pausado', 'Cancelado'],
  Pausado: ['Planeación', 'Ejecución', 'Cancelado'],
  Cierre: [],
  Cancelado: [],
}

export interface Empresa {
  id_empresa: number
  nombre_empresa: string
  division: string | null
  grupo: string | null
  activo: boolean
  fecha_creacion: string
}
export interface EmpresaCreate {
  nombre_empresa: string
  division?: string | null
  grupo?: string | null
}

export interface Area {
  id_area: number
  id_empresa: number
  nombre_area: string
  codigo_area: string
}
export type AreaCreate = Omit<Area, 'id_area'>

export interface Usuario {
  id_usuario: number
  nombre: string
  correo: string
  perfil_tecnico: PerfilTecnico
  capacidad_horas_semanales: Decimal
  id_area: number
  activo: boolean
}
export interface UsuarioCreate {
  nombre: string
  correo: string
  perfil_tecnico: PerfilTecnico
  capacidad_horas_semanales: number | string
  id_area: number
  activo?: boolean
}
export type UsuarioUpdate = Partial<UsuarioCreate>

export interface EmpresaImpactada {
  id_empresa: number
  nivel_impacto: NivelImpacto
  notas_impacto?: string | null
}

export interface Proyecto {
  id_proyecto: number
  nombre_proyecto: string
  problema_oportunidad: string
  objetivo: string
  alcance: string
  fuera_de_alcance: string
  fecha_tentativa: string | null
  fecha_comprometida: string | null
  fecha_real_cierre: string | null
  id_solicitud: number | null
  lider_id: number
  estado_proyecto: EstadoProyecto
  semaforo: Semaforo
}
export interface ProyectoDetalle extends Proyecto {
  empresas_impactadas: EmpresaImpactada[]
}
export interface ProyectoCreate {
  nombre_proyecto: string
  problema_oportunidad: string
  objetivo: string
  alcance: string
  fuera_de_alcance: string
  lider_id: number
  fecha_tentativa?: string | null
  fecha_comprometida?: string | null
  semaforo?: Semaforo
  empresas_impactadas?: EmpresaImpactada[]
}
export type ProyectoUpdate = Partial<
  Omit<ProyectoCreate, 'empresas_impactadas'>
>
export interface Paginado<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}
export interface ProyectosFiltro {
  semaforo?: Semaforo
  id_empresa?: number
  estado?: EstadoProyecto
  lider_id?: number
  limit?: number
  offset?: number
}

export interface Etapa {
  id_etapa: number
  id_proyecto: number
  nombre_etapa: NombreEtapa
  orden_secuencia: number
  horas_estimadas: Decimal
  horas_efectivas_reales: Decimal
  fecha_inicio_est: string | null
  fecha_fin_est: string | null
  estado_etapa: EstadoEtapa
}
export interface EtapaCreate {
  nombre_etapa: NombreEtapa
  orden_secuencia: number
  horas_estimadas: number | string
  fecha_inicio_est?: string | null
  fecha_fin_est?: string | null
}

export interface Asignacion {
  id_asignacion: number
  id_proyecto: number
  id_usuario: number
  id_etapa: number
  perfil_requerido: string
  horas_asignadas: Decimal
  porcentaje_utilizacion: Decimal
}
export interface AsignacionCreate {
  id_usuario: number
  id_etapa: number
  perfil_requerido: string
  horas_asignadas: number | string
  porcentaje_utilizacion: number | string
}

export interface Bloqueo {
  id_bloqueo: number
  id_proyecto: number
  id_etapa: number
  causa_raiz: CausaRaiz
  responsable_origen: ResponsableOrigen
  fecha_inicio_bloqueo: string
  fecha_fin_bloqueo: string | null
  dias_impacto: Decimal | null
}
export interface BloqueoCreate {
  id_proyecto: number
  id_etapa: number
  causa_raiz: CausaRaiz
  responsable_origen: ResponsableOrigen
  fecha_inicio_bloqueo?: string
  fecha_fin_bloqueo?: string | null
}
export type BloqueoUpdate = Partial<
  Pick<BloqueoCreate, 'causa_raiz' | 'responsable_origen' | 'fecha_inicio_bloqueo' | 'fecha_fin_bloqueo'>
>
export interface BloqueosFiltro {
  id_proyecto?: number
  id_etapa?: number
  causa_raiz?: CausaRaiz
  responsable_origen?: ResponsableOrigen
  abierto?: boolean
  limit?: number
  offset?: number
}
