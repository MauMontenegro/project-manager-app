/** Tipos y enums del backend (ver API.md). Los decimales viajan como string. */

/** Áreas de la DTI a las que puede pertenecer una persona del Equipo. */
export const DEPARTAMENTOS = ['Dirección', 'Infraestructura', 'Procesos', 'Desarrollo de Software'] as const
export type Departamento = (typeof DEPARTAMENTOS)[number]

/** Departamentos con espacio propio de proyectos (todos menos Dirección). */
export const DEPARTAMENTOS_PROYECTO = ['Infraestructura', 'Procesos', 'Desarrollo de Software'] as const
export type DepartamentoProyecto = (typeof DEPARTAMENTOS_PROYECTO)[number]
export const esDepartamentoProyecto = (d: string | null | undefined): d is DepartamentoProyecto =>
  DEPARTAMENTOS_PROYECTO.includes(d as DepartamentoProyecto)

export const TIPOS_RECURSO = ['Interno', 'Externo', 'Activo'] as const
export type TipoRecurso = (typeof TIPOS_RECURSO)[number]

/** Administrador: todo. Gerente: su departamento. Líder: crea proyectos en su departamento y gestiona los
 * que lidera. Usuario: consulta y trabaja sus propias tareas. */
export const ROLES = ['Administrador', 'Gerente', 'Líder', 'Usuario'] as const
export type Rol = (typeof ROLES)[number]

export const NIVELES_SKILL = ['Básico', 'Intermedio', 'Experto'] as const
export type NivelSkill = (typeof NIVELES_SKILL)[number]

export const TIPOS_AUSENCIA = ['Vacaciones', 'Permiso', 'Incapacidad', 'Capacitación', 'Otro'] as const
export type TipoAusencia = (typeof TIPOS_AUSENCIA)[number]

/** Estatus ("salud") del proyecto en su etapa actual; las etapas usan los mismos valores. */
export const ESTADOS_PROYECTO = [
  'Sin Iniciar', 'Activo', 'En Revisión', 'Pausado', 'Bloqueado', 'Cancelado', 'Completado',
] as const
export type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number]

export const SEMAFOROS = ['Verde', 'Amarillo', 'Rojo'] as const
export type Semaforo = (typeof SEMAFOROS)[number]

export const NIVELES_IMPACTO = ['Alto', 'Medio', 'Bajo'] as const
export type NivelImpacto = (typeof NIVELES_IMPACTO)[number]

export type EstadoEtapa = EstadoProyecto

/** Causas que se reportan a mano. */
export const CAUSAS_RAIZ = [
  'Cambio de Prioridad', 'Dependencia Externa', 'Falta de Información', 'Recurso Reasignado',
  'Incidente Operativo', 'Cambio de Alcance', 'Retrabajo', 'Espera del Cliente', 'Decisión Pendiente',
] as const
/** La registra el sistema: la tarea llegó a su inicio con dependencias sin terminar. */
export const CAUSA_DEPENDENCIA = 'Dependencia Interna'
export type CausaRaiz = (typeof CAUSAS_RAIZ)[number] | typeof CAUSA_DEPENDENCIA

export const RESPONSABLES_ORIGEN = ['DTI', 'Cliente', 'Tercero'] as const
export type ResponsableOrigen = (typeof RESPONSABLES_ORIGEN)[number]

/** Decimal serializado por el backend. */
export type Decimal = string

/** Estatus que cada departamento elige por etapa. `Activo` siempre se permite, `Sin Iniciar` solo en la
 * primera etapa y `Completado` solo en la última. */
export const ESTADOS_OPCIONALES_ETAPA: EstadoProyecto[] = ['En Revisión', 'Pausado', 'Bloqueado', 'Cancelado']

/** Estatus definitivos: sin más cambios de ciclo ni nuevas asignaciones. */
export const ESTADOS_FINALES: EstadoProyecto[] = ['Completado', 'Cancelado']

export interface Empresa {
  id_empresa: number
  nombre_empresa: string
  division: string | null
  grupo: string | null
  activo: boolean
  fecha_creacion: string
}
/** Resultado de eliminar empresas en lote: las que están en uso se reportan con su motivo. */
export interface EmpresasEliminadas {
  eliminadas: number[]
  no_eliminadas: { id_empresa: number; nombre_empresa: string | null; motivo: string }[]
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

export interface Puesto {
  id_puesto: number
  nombre_puesto: string
}
export type PuestoCreate = Omit<Puesto, 'id_puesto'>

export interface SkillAsignada {
  nombre: string
  nivel: NivelSkill
}

export interface Usuario {
  id_usuario: number
  tipo_recurso: TipoRecurso
  nombre: string
  /** Nulo en activos. */
  correo: string | null
  /** Nulos en personas registradas antes de existir puesto/departamento (y puesto en activos). */
  id_puesto: number | null
  departamento: Departamento | null
  id_jefe: number | null
  rol: Rol
  skills: SkillAsignada[]
  capacidad_horas_semanales: Decimal
  /** % de la capacidad dedicado a proyectos (el resto es operación). */
  porcentaje_proyectos: Decimal
  /** Solo visible para Administrador y Gerentes. */
  costo_hora: Decimal | null
  proveedor: string | null
  fecha_fin_contrato: string | null
  activo: boolean
  /** Ya puede entrar con contraseña. */
  tiene_password: boolean
}
export interface UsuarioCreate {
  tipo_recurso?: TipoRecurso
  nombre: string
  correo?: string | null
  id_puesto?: number | null
  departamento: Departamento
  id_jefe?: number | null
  rol?: Rol
  skills?: SkillAsignada[]
  capacidad_horas_semanales: number | string
  porcentaje_proyectos?: number | string
  costo_hora?: number | string | null
  proveedor?: string | null
  fecha_fin_contrato?: string | null
  activo?: boolean
}
export type UsuarioUpdate = Partial<UsuarioCreate>

export interface Sesion {
  id_usuario: number | null
  nombre: string
  correo: string | null
  rol: Rol
  departamento: Departamento | null
  auth_habilitada: boolean
  /** Entró con una contraseña temporal: debe cambiarla antes de usar la app. */
  password_temporal: boolean
  /** El asistente de IA está configurado para esta sesión. */
  asistente_disponible: boolean
}

export interface SesionToken {
  access_token: string
  token_type: 'bearer'
  expira: string
  password_temporal: boolean
}

export interface SkillCatalogo {
  id_skill: number
  nombre: string
  personas: number
}

export interface Ausencia {
  id_ausencia: number
  id_usuario: number
  tipo: TipoAusencia
  fecha_inicio: string
  fecha_fin: string
  nota: string | null
}
export type AusenciaCreate = Omit<Ausencia, 'id_ausencia' | 'id_usuario'>

export interface SemanaCapacidad {
  inicio: string
  horas_disponibles: Decimal
  horas_asignadas: Decimal
  /** Nulo si no hay horas disponibles esa semana. */
  utilizacion: Decimal | null
  dias_ausencia: number
  /** Operación (tareas recurrentes) contra la parte de la capacidad que no es de proyectos. */
  horas_operacion_disponibles: Decimal
  horas_operacion_asignadas: Decimal
  utilizacion_operacion: Decimal | null
}
export interface CapacidadPersona {
  id_usuario: number
  capacidad_planificable: Decimal
  /** Capacidad semanal × (100 − % dedicado a proyectos). */
  capacidad_operacion: Decimal
  semanas: SemanaCapacidad[]
}
export interface CapacidadFiltro {
  desde?: string
  semanas?: number
  id_usuario?: number
  departamento?: Departamento
  id_puesto?: number
  tipo_recurso?: TipoRecurso
  skill?: string
  nivel_min?: NivelSkill
}

export interface AsignacionPersona {
  id_asignacion: number
  id_proyecto: number
  nombre_proyecto: string
  estado_proyecto: EstadoProyecto
  id_etapa: number
  nombre_etapa: string
  estado_etapa: EstadoEtapa
  fecha_inicio_est: string | null
  fecha_fin_est: string | null
  perfil_requerido: string
  /** Horas estimadas de sus tareas en esa etapa (todas, incluidas las finalizadas). */
  horas_en_tareas: Decimal
  /** Etapa no completada y proyecto activo. */
  vigente: boolean
  /** horas_en_tareas × costo por hora. */
  costo_estimado: Decimal | null
}

export interface Bitacora {
  id_bitacora: number
  fecha: string
  id_actor: number | null
  actor_nombre: string
  entidad: string
  id_entidad: number
  accion: string
  resumen: string
  cambios: Record<string, [unknown, unknown]> | null
}

export interface EmpresaImpactada {
  id_empresa: number
  /** Obligatoria al crear; nula en proyectos registrados antes de pedirla. */
  id_area: number | null
  nivel_impacto: NivelImpacto
  notas_impacto?: string | null
}

/** Tipo de proyecto; cada departamento administra su catálogo. */
export interface Etiqueta {
  id_etiqueta: number
  departamento: DepartamentoProyecto
  nombre: string
  /** Hexadecimal, p. ej. #2563eb. */
  color: string
}
export type EtiquetaIn = Pick<Etiqueta, 'nombre' | 'color'>

/** Etapa de la plantilla de un departamento: se copia a cada proyecto nuevo. */
export interface PlantillaEtapa {
  departamento: DepartamentoProyecto
  orden: number
  nombre: string
  descripcion: string | null
  estados_permitidos: EstadoProyecto[]
}
export interface PlantillaEtapaIn {
  nombre: string
  descripcion?: string | null
  /** Solo los opcionales; el backend agrega los fijos. */
  estados_permitidos: EstadoProyecto[]
}

export interface ProyectoBase {
  id_proyecto: number
  nombre_proyecto: string
  problema_oportunidad: string
  objetivo: string
  alcance: string
  fuera_de_alcance: string
  /** Inicio y fin (comprometida o, si no hay, tentativa) delimitan las fechas de las tareas. */
  fecha_inicio: string | null
  fecha_tentativa: string | null
  fecha_comprometida: string | null
  fecha_real_cierre: string | null
  /** Presupuesto de horas: las tareas no pueden sumar más (nulo = sin límite). */
  horas_presupuestadas: Decimal | null
  /** false: se calcula con el calendario laboral entre inicio y fin. true: fijado a mano. */
  horas_presupuestadas_manual: boolean
  id_solicitud: number | null
  lider_id: number
  /** Espacio al que pertenece. Nulo en conjuntos y en proyectos antiguos aún sin asignar. */
  departamento: DepartamentoProyecto | null
  /** Agrupa un subproyecto por departamento; su avance, fechas y semáforo se consolidan de ellos. */
  es_conjunto: boolean
  id_proyecto_padre: number | null
  /** Equipo de trabajo (workspace); opcional. Un subproyecto tiene siempre el de su conjunto. */
  id_equipo_trabajo: number | null
  /** Nombre de una de sus etapas. Nulo en los conjuntos. */
  etapa_actual: string | null
  estado_proyecto: EstadoProyecto
  porcentaje_avance: Decimal
  /** Calculado por el backend a partir del avance y las fechas. */
  semaforo: Semaforo
  /** Por qué el semáforo tiene ese color (p. ej. "Avance 20 % vs. 38 % esperado"). */
  semaforo_motivo: string | null
  etiquetas: Etiqueta[]
}
export interface Proyecto extends ProyectoBase {
  /** Solo en un conjunto. */
  subproyectos: ProyectoBase[]
}
export interface ProyectoDetalle extends Proyecto {
  /** Conjunto al que pertenece (subproyectos). */
  padre: { id_proyecto: number; nombre_proyecto: string; lider_id: number } | null
  empresas_impactadas: EmpresaImpactada[]
  /** Suma de horas asignadas en sus tareas. */
  horas_en_tareas: Decimal
}
export interface ProyectoCreate {
  nombre_proyecto: string
  problema_oportunidad: string
  objetivo: string
  alcance: string
  fuera_de_alcance: string
  lider_id: number
  fecha_inicio?: string | null
  fecha_tentativa?: string | null
  fecha_comprometida?: string | null
  /** Con valor: fijado a mano. `null`: cálculo automático. */
  horas_presupuestadas?: number | string | null
  empresas_impactadas?: Array<EmpresaImpactada & { id_area: number }>
  /** Obligatorio salvo en un conjunto. */
  departamento?: DepartamentoProyecto | null
  es_conjunto?: boolean
  /** Solo en un conjunto: un subproyecto por departamento (mínimo dos). */
  subproyectos?: SubproyectoIn[]
  /** Ids de etiquetas de sus departamentos. */
  etiquetas?: number[]
  /** Equipo de trabajo (opcional); los subproyectos lo heredan. */
  id_equipo_trabajo?: number | null
}
export interface SubproyectoIn {
  departamento: DepartamentoProyecto
  lider_id: number
}
/** `empresas_impactadas` y `etiquetas`, si se envían, reemplazan la lista completa. */
export type ProyectoUpdate = Partial<Omit<ProyectoCreate, 'es_conjunto' | 'subproyectos'>>
export interface Paginado<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}
export interface ProyectosFiltro {
  /** Espacio: sus proyectos y los conjuntos en que participa. */
  departamento?: DepartamentoProyecto
  semaforo?: Semaforo
  id_empresa?: number
  estado?: EstadoProyecto
  etapa?: string
  lider_id?: number
  /** Con cualquiera de estas etiquetas. */
  etiquetas?: number[]
  id_equipo_trabajo?: number
  limit?: number
  offset?: number
}

/** Equipo de trabajo (workspace): personas de cualquier departamento y los proyectos de una línea de negocio.
 * Solo organiza (filtros y métricas); los permisos siguen por rol y departamento. */
export interface EquipoTrabajo {
  id_equipo_trabajo: number
  nombre: string
  descripcion: string | null
  color: string
  fecha_creacion: string
  miembros: { id_usuario: number; nombre: string; departamento: string | null }[]
  /** Proyectos de primer nivel (un conjunto cuenta una vez). */
  proyectos: number
  proyectos_abiertos: number
  /** Abiertos con semáforo Amarillo o Rojo. */
  proyectos_en_riesgo: number
  bloqueos_abiertos: number
}
export interface EquipoTrabajoIn {
  nombre: string
  descripcion?: string | null
  color: string
  /** Reemplaza la lista completa. */
  miembros: number[]
}

export interface Etapa {
  id_etapa: number
  id_proyecto: number
  nombre_etapa: string
  orden_secuencia: number
  descripcion: string | null
  estados_permitidos: EstadoProyecto[]
  horas_estimadas: Decimal
  horas_efectivas_reales: Decimal
  fecha_inicio_est: string | null
  fecha_fin_est: string | null
  estado_etapa: EstadoEtapa
}
/** Las etapas se copian de la plantilla del departamento al crear el proyecto; solo se planifican horas y fechas. */
export interface EtapaUpdate {
  horas_estimadas?: number | string
  fecha_inicio_est?: string | null
  fecha_fin_est?: string | null
}

/** El avance no se envía: lo calculan las tareas. */
export interface CambioCiclo {
  etapa_actual?: string
  estado_proyecto?: EstadoProyecto
  fecha_real_cierre?: string
}

/** Periodicidad de una tarea recurrente: una tarea por día laborable, semana o mes. */
export const FRECUENCIAS = ['Diaria', 'Semanal', 'Mensual'] as const
export type Frecuencia = (typeof FRECUENCIAS)[number]

/** Plantilla de operación del día a día: genera una tarea por periodo para su responsable. */
export interface TareaRecurrente {
  id_recurrente: number
  titulo: string
  descripcion: string | null
  id_usuario: number
  frecuencia: Frecuencia
  horas_por_periodo: Decimal
  fecha_inicio: string
  fecha_fin: string | null
  /** false: pausada (no genera tareas). */
  activa: boolean
  generada_hasta: string | null
  fecha_creacion: string
  etiquetas: Etiqueta[]
  /** Tareas generadas aún no finalizadas. */
  tareas_abiertas: number
}
export interface TareaRecurrenteCreate {
  titulo: string
  descripcion?: string | null
  id_usuario: number
  frecuencia: Frecuencia
  horas_por_periodo: number | string
  fecha_inicio: string
  fecha_fin?: string | null
  etiquetas?: number[]
}
/** Aplica a las tareas que se generen después. */
export type TareaRecurrenteUpdate = Partial<Omit<TareaRecurrenteCreate, 'frecuencia' | 'fecha_inicio'>> & { activa?: boolean }
export interface TareasRecurrentesFiltro {
  id_usuario?: number
  departamento?: Departamento
  frecuencia?: Frecuencia
  etiquetas?: number[]
  activa?: boolean
}
export interface PanelOperacionFiltro extends Omit<TareasRecurrentesFiltro, 'activa'> {
  estado?: EstadoTarea
  id_recurrente?: number
  /** Tareas cuyo fin es igual o posterior. */
  desde?: string
  /** Tareas cuyo inicio es igual o anterior. */
  hasta?: string
  /** Solo no finalizadas cuyo fin ya pasó. */
  vencidas?: boolean
}

/** Dónde vive la tarea: su proyecto o, si es recurrente, Mis tareas. */
export const enlaceTarea = (t: Pick<Tarea, 'id_tarea' | 'id_proyecto'>) =>
  t.id_proyecto != null ? `/proyectos/${t.id_proyecto}?tarea=${t.id_tarea}` : `/tareas?tarea=${t.id_tarea}`

/** Columnas del kanban; solo `Finalizado` cuenta para el avance. */
export const ESTADOS_TAREA = ['Pendiente', 'En progreso', 'En revisión', 'Finalizado'] as const
export type EstadoTarea = (typeof ESTADOS_TAREA)[number]

/** Tarea de proyecto (campos de proyecto y etapa; sin etapa si es propia de un conjunto) o de un periodo de una tarea recurrente
 * (`id_recurrente`, `frecuencia`, `periodo`, `etiquetas`); los del otro origen van en null. */
export interface Tarea {
  id_tarea: number
  id_proyecto: number | null
  nombre_proyecto: string | null
  estado_proyecto: EstadoProyecto | null
  /** Departamento de su proyecto; null en las propias de un conjunto y en las recurrentes. */
  departamento: DepartamentoProyecto | null
  /** Conjunto al que pertenece su proyecto, si es un subproyecto. */
  id_proyecto_padre: number | null
  /** Equipo de trabajo de su proyecto (null en las recurrentes o sin equipo). */
  id_equipo_trabajo: number | null
  id_etapa: number | null
  nombre_etapa: string | null
  orden_etapa: number | null
  id_recurrente: number | null
  frecuencia: Frecuencia | null
  /** Primer día del periodo (día, lunes de la semana o día 1 del mes). */
  periodo: string | null
  etiquetas: Etiqueta[]
  id_usuario: number
  nombre_usuario: string
  titulo: string
  descripcion: string | null
  horas_asignadas: Decimal
  /** Horas que realmente tomó; se registran al finalizarla. */
  horas_reales: Decimal | null
  fecha_inicio: string
  fecha_fin: string
  estado: EstadoTarea
  fecha_creacion: string
  fecha_finalizacion: string | null
  num_comentarios: number
  /** Tareas que deben estar `Finalizado` antes de que esta salga de `Pendiente`. */
  dependencias: TareaRelacionada[]
  /** Tareas que esperan a esta. */
  dependientes: TareaRelacionada[]
  /** Alguna dependencia sin terminar: no puede salir de `Pendiente`. */
  bloqueada: boolean
  /** Línea base (fechas originales); null en las recurrentes. */
  fecha_inicio_base: string | null
  fecha_fin_base: string | null
  /** Días hábiles de la fecha límite original a la real (finalización, o vigente / hoy si ya venció). Positivo = atraso. */
  desfase_dias: number | null
  num_reprogramaciones: number
  /** Tiempo hábil total con algún bloqueo (los abiertos, hasta ahora). */
  dias_bloqueada: Decimal
  horas_bloqueada: Decimal
  bloqueo_abierto: BloqueoActivo | null
  periodos_bloqueo: { inicio: string; fin: string | null; automatico: boolean; causa_raiz: CausaRaiz }[]
}
export interface BloqueoActivo {
  id_bloqueo: number
  causa_raiz: CausaRaiz
  /** Espera de dependencia: la abre y cierra el sistema. */
  automatico: boolean
  descripcion: string | null
  desde: string
  /** Días hábiles que lleva abierto. */
  dias: Decimal
}
export interface Reprogramacion {
  id_reprogramacion: number
  fecha: string
  actor_nombre: string
  inicio_antes: string
  inicio_despues: string
  fin_antes: string
  fin_despues: string
  /** Cuánto se movió la fecha límite en días hábiles (positivo = se retrasó). */
  dias_habiles: number
  motivo: string | null
  id_bloqueo: number | null
  causa_bloqueo: CausaRaiz | null
  es_linea_base: boolean
}
export interface TareaRelacionada {
  id_tarea: number
  titulo: string
  estado: EstadoTarea
  id_proyecto: number | null
  nombre_proyecto: string | null
  /** Null en las tareas propias de un conjunto. */
  departamento: DepartamentoProyecto | null
}

/** Parte de un proyecto conjunto a la que pertenece la tarea: su departamento, o "General" si es propia del conjunto. */
export const parteTarea = (t: { departamento: DepartamentoProyecto | null }) => t.departamento ?? 'General'
export interface TareaCreate {
  titulo: string
  descripcion?: string | null
  /** Obligatoria, salvo en un proyecto conjunto (no tiene etapas). */
  id_etapa?: number | null
  id_usuario: number
  horas_asignadas: number | string
  fecha_inicio: string
  fecha_fin: string
  estado?: EstadoTarea
  /** Ids de tareas del mismo proyecto o, si es parte de un conjunto, del conjunto y sus subproyectos. En la edición reemplaza la lista completa. */
  dependencias?: number[]
}
/** La persona asignada solo puede cambiar `estado` y `horas_reales` (esta, solo en tareas `Finalizado`).
 * Retrasar la fecha límite exige `motivo_cambio`; `id_bloqueo_causa` lo atribuye a un bloqueo de la tarea. */
export type TareaUpdate = Partial<TareaCreate> & {
  horas_reales?: number | string | null
  motivo_cambio?: string | null
  id_bloqueo_causa?: number | null
}

export interface Asignacion {
  id_asignacion: number
  id_proyecto: number
  id_usuario: number
  id_etapa: number
  /** Rol desempeñado en la etapa. La asignación no lleva horas: la carga sale de las tareas. */
  perfil_requerido: string
  /** Horas estimadas de las tareas de la persona en esa etapa (todas, incluidas las finalizadas). */
  horas_en_tareas: Decimal
}
export interface AsignacionCreate {
  id_usuario: number
  id_etapa: number
  perfil_requerido: string
}

/** Periodo en que una tarea (o, sin tarea, una etapa) no pudo avanzar. La duración es en tiempo hábil. */
export interface Bloqueo {
  id_bloqueo: number
  id_proyecto: number
  nombre_proyecto: string
  id_etapa: number | null
  nombre_etapa: string | null
  id_tarea: number | null
  titulo_tarea: string | null
  /** Persona asignada a la tarea: puede reportar y cerrar sus bloqueos. */
  id_usuario_tarea: number | null
  nombre_usuario_tarea: string | null
  causa_raiz: CausaRaiz
  responsable_origen: ResponsableOrigen
  descripcion: string | null
  /** Quién debe destrabarlo. */
  responsable_resolucion: string | null
  fecha_compromiso: string | null
  compromiso_vencido: boolean
  nota_resolucion: string | null
  /** Espera de dependencia: la abre y cierra el sistema. */
  automatico: boolean
  reportado_por_nombre: string | null
  fecha_inicio_bloqueo: string
  fecha_fin_bloqueo: string | null
  /** Días y horas hábiles (si sigue abierto, hasta ahora). */
  dias_impacto: Decimal
  horas_impacto: Decimal
}
export interface BloqueoCreate {
  /** Tarea bloqueada (su proyecto y etapa se toman de ella) o, sin tarea, `id_proyecto` + `id_etapa`. */
  id_tarea?: number | null
  id_proyecto?: number
  id_etapa?: number
  causa_raiz: CausaRaiz
  responsable_origen: ResponsableOrigen
  descripcion?: string | null
  responsable_resolucion?: string | null
  fecha_compromiso?: string | null
  fecha_inicio_bloqueo?: string
  fecha_fin_bloqueo?: string | null
}
export type BloqueoUpdate = Partial<
  Pick<BloqueoCreate, 'causa_raiz' | 'responsable_origen' | 'descripcion' | 'responsable_resolucion' | 'fecha_compromiso' | 'fecha_inicio_bloqueo' | 'fecha_fin_bloqueo'>
> & { nota_resolucion?: string | null }
export interface BloqueosFiltro {
  /** Un conjunto incluye los de sus subproyectos. */
  id_proyecto?: number
  departamento?: DepartamentoProyecto
  id_equipo_trabajo?: number
  id_etapa?: number
  id_tarea?: number
  causa_raiz?: CausaRaiz
  responsable_origen?: ResponsableOrigen
  abierto?: boolean
  automatico?: boolean
  limit?: number
  offset?: number
}
export interface ConteoTiempo { clave: string; bloqueos: number; dias: Decimal }
/** Bloqueos y desfases de un proyecto, un departamento o el portafolio. */
export interface ResumenBloqueos {
  abiertos: number
  abiertos_automaticos: number
  compromisos_vencidos: number
  bloqueos_periodo: number
  /** Suma por tarea de los días hábiles bloqueada (sus bloqueos unidos). */
  dias_bloqueo: Decimal
  horas_bloqueo: Decimal
  promedio_resolucion_dias: Decimal | null
  tareas_bloqueadas: number
  por_causa: ConteoTiempo[]
  por_origen: ConteoTiempo[]
  por_proyecto: { id_proyecto: number; nombre_proyecto: string; abiertos: number; dias: Decimal; desfase_dias: number }[]
  desfase: {
    total: number
    /** Días que se movieron fechas límite por un bloqueo, por su origen. */
    por_bloqueo: ConteoTiempo[]
    reprogramado_sin_bloqueo: number
    /** Término real vs. fecha límite vigente (negativo si terminó antes). */
    ejecucion: number
  }
  tareas_con_desfase: {
    id_tarea: number; titulo: string; id_proyecto: number; nombre_proyecto: string; nombre_usuario: string; estado: EstadoTarea
    fecha_fin_base: string; fecha_fin: string; desfase_dias: number; dias_bloqueada: Decimal
  }[]
}

/** Fin del proyecto para delimitar tareas: la comprometida o, si no hay, la tentativa. */
export const fechaFinProyecto = (p: ProyectoBase) => p.fecha_comprometida ?? p.fecha_tentativa

/** Proyectos de la lista con sus subproyectos al mismo nivel; `soloConEtapas` deja fuera los conjuntos. */
export const aplanarProyectos = (items: Proyecto[], soloConEtapas = false): ProyectoBase[] =>
  items.flatMap((p) => p.es_conjunto ? [...(soloConEtapas ? [] : [p]), ...p.subproyectos] : [p])

/** Lunes a viernes `horas_entre_semana`, sábado `horas_sabado` (0 = no cuenta), domingo nunca. */
export interface ConfiguracionLaboral {
  horas_entre_semana: number | string
  horas_sabado: number | string
  /** Fechas que no cuentan como laborables. */
  dias_inactivos: string[]
}
export interface ConfiguracionGuardada extends ConfiguracionLaboral {
  proyectos_recalculados: number
  proyectos_excedidos: number
}
export interface HorasLaborales {
  desde: string
  hasta: string
  horas: Decimal
  dias_laborables: number
}

/** Persona del proyecto (líder o con asignación): se puede mencionar con @. */
export interface Involucrado {
  id_usuario: number
  nombre: string
  es_lider: boolean
}

/** Entrada de la línea de tiempo de una tarea: un cambio registrado o un comentario. */
export interface EventoTarea {
  tipo: 'cambio' | 'comentario'
  fecha: string
  id_actor: number | null
  actor_nombre: string
  accion: string | null
  resumen: string | null
  cambios: Record<string, [unknown, unknown]> | null
  id_comentario: number | null
  texto: string | null
  menciones: { id_usuario: number; nombre: string }[]
}

export interface Notificacion {
  id_mencion: number
  leida: boolean
  fecha: string
  autor_nombre: string
  texto: string
  id_tarea: number
  titulo_tarea: string
  /** Nulos en una tarea recurrente (viene `id_recurrente`). */
  id_proyecto: number | null
  nombre_proyecto: string | null
  id_recurrente: number | null
}
export interface Notificaciones {
  no_leidas: number
  items: Notificacion[]
}
