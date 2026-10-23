# Referencia del Backend y la API — Petroil Project Manager

Documento de referencia para el desarrollo del frontend. Describe convenciones, enums, modelos de datos, reglas de negocio y todos los endpoints disponibles.

- **Base URL (local):** `http://localhost:8000`
- **Prefijo de la API:** `/api/v1`
- **Documentación interactiva (OpenAPI):** `/docs` (Swagger) y `/openapi.json` (útil para generar clientes tipados)
- **Health check:** `GET /health` → `{"status": "ok"}`
- **Formato:** JSON (`Content-Type: application/json`)
- **Autenticación:** `Authorization: Bearer <ID token de Firebase>` (Google o Microsoft) en todo `/api/v1`. Con `AUTH_ENABLED=false` (desarrollo) no se pide token y cada petición actúa como un Director local; con `LOCAL_ID_USUARIO=<id>` ese Director local es esa persona del Equipo (para probar perfil, tareas propias y menciones). Ver §2.5.
- **CORS:** permitido para `http://localhost:3000` y `http://localhost:5173` (configurable con `CORS_ORIGINS`).

---

## 1. Stack

| Capa | Tecnología |
| :--- | :--- |
| Lenguaje / framework | Python 3.12, FastAPI (asíncrono) |
| ORM | SQLAlchemy 2.0 (`AsyncSession`) + `asyncpg` |
| Base de datos | PostgreSQL 16 |
| Validación | Pydantic v2 |
| Migraciones | Alembic |

Arquitectura en capas: `api/v1/endpoints` (HTTP) → `services` (reglas de negocio) → `models` (SQLAlchemy). El esquema relacional tiene 17 tablas en 3FN; ver `arquitectura-base-datos-petroil.md`.

---

## 2. Convenciones de la API

### 2.1 Tipos de datos en JSON

| Tipo | Representación | Ejemplo |
| :--- | :--- | :--- |
| Identificadores | entero | `12` |
| **Decimales** (horas, porcentajes, dinero, `dias_impacto`) | **string** | `"80.00"` |
| Fechas (`date`) | `YYYY-MM-DD` | `"2026-10-06"` |
| Fecha-hora (`datetime`) | ISO 8601 en UTC | `"2026-10-06T18:12:19Z"` |
| Enums | string exacto, **con tildes y mayúsculas** | `"En Revisión"` |

> **Importante:** los decimales llegan como string. Al **enviarlos** se aceptan tanto número como string (`80` o `"80.00"`). En el frontend conviértalos con `Number()`/una librería decimal solo para mostrar o calcular.
>
> Los `datetime` que se **envían** deben incluir zona horaria (`Z` o `+00:00`); si no, el backend responde 422.

### 2.2 PATCH parcial

Los `PATCH` aceptan solo los campos a modificar. Enviar un campo no nulable con `null` produce un error 422 (ver §2.4).

### 2.3 Paginación

Solo el portafolio (`GET /proyectos`) devuelve un envoltorio con total. El resto de listados devuelven un **arreglo simple** y aceptan `limit` (1–200, default 50) y `offset` (≥ 0) cuando se indica.

```json
{ "items": [ ... ], "total": 134, "limit": 50, "offset": 0 }
```

### 2.4 Errores

| Código | Cuándo | Forma del `detail` |
| :--- | :--- | :--- |
| `404` | El recurso referenciado no existe (incluye FKs en el cuerpo) | `string` |
| `409` | Conflicto: duplicados (correo, empresa, código de área, asignación, orden de etapa, solicitud ya usada) o violación de integridad en BD | `string` |
| `422` (regla de negocio) | Cambio de ciclo inválido (etapa, estatus o avance), usuario inactivo, proyecto cerrado, bloqueo ya cerrado, fechas incoherentes, campo nulo no permitido | `string` |
| `422` (validación de esquema) | Tipo, rango o enum inválido en el cuerpo/query | `array` de objetos `{loc, msg, type}` (formato estándar de FastAPI) |

El frontend debe distinguir ambos 422 comprobando si `detail` es `string` o `array`.

```json
{ "detail": "El estatus 'Pausado' no está permitido en 'Análisis y Viabilidad'. Permitidos: Sin Iniciar, Activo, En Revisión, Cancelado" }
```

---

### 2.5 Autenticación y permisos

La API valida el ID token de Firebase (firma, emisor, audiencia `FIREBASE_PROJECT_ID`, vigencia) y busca al usuario **activo** cuyo `correo` coincide con el del token. Los correos de `BOOTSTRAP_ADMIN_EMAILS` entran como Director aunque aún no estén en el Equipo (sirve para dar de alta al primer Director).

| Rol | Puede |
| :--- | :--- |
| `Director` | Todo: cualquier departamento, otorgar roles, catálogos, ver costos y bitácora global. |
| `Gerente` | Gestionar personas y ausencias de **su** departamento (sin otorgar roles), catálogos, asignar recursos, ver costos y bitácora global. |
| `Colaborador` | Consultar; registrar **sus** ausencias; asignar recursos solo en proyectos que lidera. No ve `costo_hora` (viene `null`). |

Errores: `401` sin token, token inválido o expirado; `403` cuenta no registrada en el Equipo o acción fuera de su alcance.

---

## 3. Enumeraciones

Los valores se envían y reciben **tal cual** se muestran aquí.

| Enum | Valores |
| :--- | :--- |
| `Departamento` | `Dirección`, `Infraestructura`, `Procesos`, `Desarrollo de Software` |
| `TipoRecurso` | `Interno`, `Externo`, `Activo` |
| `RolSistema` | `Director`, `Gerente`, `Colaborador` |
| `NivelSkill` | `Básico`, `Intermedio`, `Experto` |
| `TipoAusencia` | `Vacaciones`, `Permiso`, `Incapacidad`, `Capacitación`, `Otro` |
| `EstadoProyecto` | `Sin Iniciar`, `Activo`, `En Revisión`, `Pausado`, `Bloqueado`, `Cancelado`, `Completado` |
| `Semaforo` | `Verde`, `Amarillo`, `Rojo` |
| `NivelImpacto` | `Alto`, `Medio`, `Bajo` |
| `NombreEtapa` | `Análisis y Viabilidad`, `Diseño y Planificación`, `Construcción y Ejecución`, `Pruebas y Validación`, `Despliegue y Cierre` |
| `EstadoEtapa` | mismos valores que `EstadoProyecto` |
| `EstadoTarea` | `Pendiente`, `En progreso`, `En revisión`, `Finalizado` |
| `CausaRaiz` (bloqueos) | `Cambio de Prioridad`, `Dependencia Externa`, `Falta de Información`, `Recurso Reasignado`, `Incidente Operativo`, `Cambio de Alcance`, `Retrabajo`, `Espera del Cliente`, `Decisión Pendiente` |
| `ResponsableOrigen` | `DTI`, `Cliente`, `Tercero` |

Enums del modelo de datos que **aún no tienen endpoints** (para futuras pantallas): `EstadoDemanda` (`Solicitado`, `Analizado`, `Priorizado`, `Esperando Capacidad`, `Planeado`, `En Ejecución`, `Rechazado`), `EstadoHito` (`Pendiente`, `Entregado`, `Aprobado`, `Atrasado`), `EstadoCompromiso` (`Pendiente`, `Cumplido`, `Vencido`, `Cancelado`), `TipoDependencia` (`Bloqueante`, `Secuencial`, `Informativa`).

---

## 4. Modelo de dominio (visión para el frontend)

```
Empresa 1─M Área 1─M Usuario
                       │ (líder)
Empresa/Área/Usuario ─ SolicitudDemanda 1─1 Proyecto ◄── lider_id (Usuario)
                                            │
        ┌───────────────┬───────────────────┼───────────────────┐
   Empresas impactadas  Etapas (1─M)   Bloqueos (1─M)   [aún sin API: business case, evaluación
   (M:N, con nivel)       │                 │            financiera, hitos, retrabajo, avances,
                    Asignaciones         (por etapa)     compromisos, valor, dependencias]
                    (Usuario ↔ Etapa)
```

Orden de creación obligatorio (por FKs): **Empresa → Área → Usuario → Proyecto (crea sus 5 etapas) → Asignación / Bloqueo**.

---

## 5. Reglas de negocio

1. **Ciclo de vida del proyecto.** Todos los proyectos (de las tres áreas) recorren cinco macro-etapas. El proyecto tiene una `etapa_actual`, un estatus (`estado_proyecto`) y un `porcentaje_avance` **calculado con las tareas**. Cada etapa vale 20 % del proyecto:

   | # | Etapa | Porción del avance | Estatus permitidos | Qué pasa |
   | :-: | :--- | :--- | :--- | :--- |
   | 1 | `Análisis y Viabilidad` | 0 – 20 % | `Sin Iniciar`, `Activo`, `En Revisión`, `Cancelado` | Se define el "Qué" (levantamientos, requerimientos, viabilidad) |
   | 2 | `Diseño y Planificación` | 20 – 40 % | `Activo`, `En Revisión`, `Pausado`, `Cancelado` | Se define el "Cómo" (arquitectura, cronogramas, flujos To-Be) |
   | 3 | `Construcción y Ejecución` | 40 – 60 % | `Activo`, `Bloqueado`, `Pausado`, `Cancelado` | Se construye (programar, instalar hardware, redactar manuales) |
   | 4 | `Pruebas y Validación` | 60 – 80 % | `Activo`, `En Revisión`, `Bloqueado`, `Cancelado` | Se valida (QA, UAT, pruebas de estrés, simulaciones) |
   | 5 | `Despliegue y Cierre` | 80 – 100 % | `Activo`, `Completado` | Se lanza y finaliza (Go-Live, encendido, capacitación, cierre) |

   - Un proyecto nace en `Análisis y Viabilidad` · `Sin Iniciar` · 0 %, con sus cinco etapas creadas.
   - Se avanza solo a la **siguiente** etapa; se puede **regresar** a cualquier anterior (retrabajo).
   - El estatus debe estar entre los permitidos por la etapa. Al cambiar de etapa sin indicar estatus se usa `Activo`.
   - **Avance**: cada etapa aporta 20 % × tareas `Finalizado` / tareas de la etapa. Una etapa sin tareas aporta su 20 % si ya se pasó y 0 % si es la actual o posterior. Un proyecto `Completado` está al 100 %. El avance no se envía nunca.
   - **Avance automático**: al finalizar la última tarea pendiente de la etapa actual, el proyecto pasa solo a la siguiente etapa como `Activo` (en la etapa 5 queda `Completado`). Un proyecto `Sin Iniciar` pasa a `Activo` en cuanto una de sus tareas sale de `Pendiente`. Los cambios manuales de ciclo no disparan este avance (así se puede regresar a una etapa ya terminada).
   - `Completado` fija `fecha_real_cierre` (la enviada o, por defecto, hoy). `Completado` y `Cancelado` son definitivos: tampoco admiten cambios en sus tareas.
   - Las etapas anteriores a la actual quedan `Completado`; la actual toma el estatus del proyecto; las posteriores, `Sin Iniciar`.

   Etapa y estatus **no** se editan con `PATCH /proyectos/{id}`; solo con `PATCH /proyectos/{id}/estado` (o solos, por las tareas).
2. **Líder activo.** `lider_id` debe ser un usuario existente y `activo = true`.
3. **Solicitud única.** Una solicitud de demanda solo puede originar un proyecto; al crearlo, la solicitud pasa a `En Ejecución`.
4. **Empresas impactadas.** No se pueden repetir empresas en un mismo proyecto; todas deben existir.
5. **Etapas.** Son siempre las cinco macro-etapas (orden 1–5); no se crean ni se borran. Solo se planifican horas y fechas.
6. **Asignaciones.** La etapa debe pertenecer al proyecto, el usuario debe estar activo, el proyecto no puede estar `Completado` ni `Cancelado`, y un usuario no puede asignarse dos veces a la misma etapa.
7. **Semáforo calculado.** `semaforo` no se envía (si llega, se ignora): el backend lo calcula y explica en `semaforo_motivo`.
   - *Avance esperado a hoy*: cada etapa con `fecha_inicio_est` y `fecha_fin_est` cubre su 20 % (regla 1) de forma lineal entre esas fechas.
   - `Rojo`: fecha comprometida vencida sin completar, o avance real ≥ 15 puntos por debajo del esperado.
   - `Amarillo`: entre 5 y 15 puntos por debajo, o faltan ≤ 14 días para la fecha comprometida y aún no está en `Despliegue y Cierre`.
   - `Verde`: en cualquier otro caso (incluye proyectos sin fechas para evaluar).
   - `Completado`: `Verde`, o `Rojo` si cerró después de la fecha comprometida. `Cancelado`: conserva su último semáforo.
   - Se recalcula al crear, editar, cambiar el ciclo o planificar etapas, y una vez al día al consultar el portafolio o un proyecto.
8. **Bloqueos.** La etapa debe pertenecer al proyecto. `dias_impacto = (fecha_fin − fecha_inicio)` en días, con 2 decimales, calculado por el backend (nunca se envía). Un bloqueo sin `fecha_fin_bloqueo` está **abierto** y su `dias_impacto` es `null`.
9. **Usuarios.** El correo es único. `DELETE` es una **baja lógica** (`activo = false`): el usuario sigue apareciendo en los listados salvo que se filtre por `activo=true`.
10. **Portafolio por empresa.** `id_empresa` coincide con proyectos donde la empresa es una de las **impactadas** o la **solicitante** de la demanda de origen.

---

## 6. Endpoints

Todas las rutas van bajo `/api/v1`.

### 6.1 Catálogos organizacionales

#### `POST /empresas` → `201`
```json
{ "nombre_empresa": "Petroil Combustibles", "division": "Combustibles", "grupo": "Petroil" }
```
Respuesta `EmpresaRead`:
```json
{ "id_empresa": 1, "nombre_empresa": "Petroil Combustibles", "division": "Combustibles",
  "grupo": "Petroil", "activo": true, "fecha_creacion": "2026-10-06T18:12:19Z" }
```
Errores: `409` nombre duplicado.

#### `GET /empresas` → `200`
Arreglo de `EmpresaRead`, ordenado por nombre. Sin paginación.

#### `DELETE /empresas/{id_empresa}` → `204`
Elimina la empresa y sus áreas. Solo Director (`403`). `404` si no existe; `409` si está en uso: impactada en algún proyecto, con solicitudes de demanda, o con áreas usadas por solicitudes o compromisos de cliente.

#### `POST /empresas/eliminar` → `200`
Eliminación en lote. Cuerpo `{ "ids": [int] }` (1–500). Elimina las que no están en uso (con sus áreas) y reporta las demás sin fallar:
```json
{ "eliminadas": [13, 14],
  "no_eliminadas": [{ "id_empresa": 1, "nombre_empresa": "Corporativo", "motivo": "En uso: 1 proyecto la tiene como impactada" }] }
```
Solo Director (`403`). Cada baja queda en la bitácora (`entidad = "empresa"`).

#### `POST /areas` → `201`
```json
{ "id_empresa": 1, "nombre_area": "DTI", "codigo_area": "DTI-01" }
```
Respuesta `AreaRead`: el mismo cuerpo más `id_area`.
Errores: `404` empresa inexistente; `409` `codigo_area` duplicado.

#### `GET /areas` → `200`
Query: `id_empresa` (opcional). Arreglo de `AreaRead`, ordenado por nombre.

#### `GET /puestos` → `200`
Catálogo administrable de puestos de la DTI. Arreglo de `PuestoRead` (`{ "id_puesto": 1, "nombre_puesto": "Director" }`), ordenado por nombre. La migración 0002 lo siembra con: Director, Gerente, Coordinador, Líder Técnico, Especialista, Analista, Desarrollador, Técnico.

#### `POST /puestos` → `201`
```json
{ "nombre_puesto": "Arquitecto de Soluciones" }
```
1–100 caracteres (se recortan espacios). Errores: `409` nombre duplicado (sin distinguir mayúsculas).

#### `DELETE /puestos/{id_puesto}` → `204`
Elimina el puesto. Errores: `404` inexistente; `409` si alguna persona (activa o no) lo tiene asignado.

---

### 6.2 Equipo: recursos

Un recurso es una persona **interna**, un **externo** (proveedor/consultor) o un **activo** no humano (servidor, licencia, ambiente).

**`UsuarioRead`**
```json
{ "id_usuario": 2, "tipo_recurso": "Interno", "nombre": "Beto Dev", "correo": "beto@petroil.com",
  "id_puesto": 7, "departamento": "Desarrollo de Software", "id_jefe": 4, "rol": "Colaborador",
  "skills": [{ "nombre": "Python", "nivel": "Experto" }, { "nombre": "React", "nivel": "Intermedio" }],
  "capacidad_horas_semanales": "40.00", "porcentaje_proyectos": "80.00", "costo_hora": "450.00",
  "proveedor": null, "fecha_fin_contrato": null, "activo": true }
```
`costo_hora` llega `null` a los Colaboradores. `id_puesto`/`departamento` pueden ser `null` en registros anteriores a la migración 0002.

#### `POST /usuarios` → `201`
| Campo | Tipo | Obligatorio | Reglas |
| :--- | :--- | :---: | :--- |
| `tipo_recurso` | `TipoRecurso` | no | default `Interno` |
| `nombre` | string | sí | 1–150 caracteres |
| `correo` | email | personas | único (sin distinguir mayúsculas); no aplica a activos |
| `id_puesto` | int | personas | debe existir en `/puestos` |
| `departamento` | `Departamento` | sí | Gerente: solo el suyo |
| `id_jefe` | int | no | persona existente, no activo; sin ciclos («reporta a») |
| `rol` | `RolSistema` | no | default `Colaborador`; solo el Director otorga otro |
| `skills` | `{nombre, nivel}[]` | no | máx. 30; nombres nuevos se agregan al catálogo; repetidos se ignoran |
| `capacidad_horas_semanales` | decimal | sí | 0–999 |
| `porcentaje_proyectos` | decimal | no | 0–100, default 100 (el resto es operación/soporte) |
| `costo_hora` | decimal | no | ≥ 0 |
| `proveedor`, `fecha_fin_contrato` | string, date | externos | `proveedor` obligatorio en externos; se limpian en otros tipos |
| `activo` | bool | no | default `true` |

Errores: `403` fuera de alcance; `404` puesto/jefe inexistente; `409` correo duplicado; `422` reglas por tipo o ciclo de jefatura.

#### `GET /usuarios` → `200`
Query: `id_puesto`, `departamento`, `tipo_recurso`, `id_jefe`, `skill` (sin distinguir mayúsculas) + `nivel_min`, `activo`, `q`, `limit`, `offset`.

#### `GET /usuarios/{id}` · `PATCH /usuarios/{id}` · `DELETE /usuarios/{id}`
PATCH acepta cualquier subconjunto; `null` solo en campos opcionales; `skills` reemplaza la lista. DELETE es baja lógica (no puedes darte de baja a ti mismo).

#### `GET /usuarios/{id}/asignaciones` → `200`
Asignaciones con proyecto y etapa resueltos, `vigente` (cuenta para la carga) y `costo_estimado` (`horas × costo_hora`, solo para quien ve costos).

#### `GET|POST /usuarios/{id}/ausencias` · `DELETE /ausencias/{id}`
`{tipo, fecha_inicio, fecha_fin, nota?}`. Las gestiona la propia persona o quien gestiona su departamento. `409` si se traslapa con otra.

#### `GET /usuarios/{id}/bitacora` → `200`
Historial de cambios que afectan a la persona (altas, ediciones con `cambios: {campo: [antes, después]}`, ausencias, asignaciones).

### 6.2.1 Catálogos, capacidad y sesión

| Endpoint | Descripción |
| :--- | :--- |
| `GET /sesion` | Usuario autenticado: `{id_usuario, nombre, correo, rol, departamento, auth_habilitada}`. |
| `GET /perfil` | `UsuarioRead` de quien inició sesión. `404` si la sesión no está ligada a una persona del Equipo. |
| `PATCH /perfil` | Cada persona edita lo suyo: `{ nombre?, skills? }` (skills reemplaza la lista). Puesto, rol, capacidad, etc. los cambia su gerente con `PATCH /usuarios/{id}`. Queda en la bitácora. |
| `GET /skills` | Catálogo `{id_skill, nombre, personas}`. |
| `PATCH /skills/{id}` | Renombrar (`{nombre}`); `409` si ya existe → fusionar. Director/Gerente. |
| `POST /skills/{id}/fusionar` | `{id_destino}`: mueve a las personas (conservando el nivel más alto) y elimina el origen. |
| `DELETE /skills/{id}` | Lo quita del catálogo y de todas las personas. |
| `GET /capacidad` | Ver abajo. |
| `GET /bitacora` | Últimos cambios (`entidad`, `limit`). Director/Gerente. |

**`GET /capacidad`** — Query: `desde` (se ajusta al lunes; default hoy), `semanas` (1–26, default 12), `id_usuario` o filtros `departamento`, `id_puesto`, `tipo_recurso`, `skill`, `nivel_min`. Devuelve por persona activa `{id_usuario, capacidad_planificable, semanas: [{inicio, horas_disponibles, horas_asignadas, utilizacion, dias_ausencia}]}`.

Modelo: planificable = capacidad × `porcentaje_proyectos`; disponibles de la semana = planificable × días hábiles sin ausencia / 5; cada asignación consume `porcentaje_utilizacion` % de la capacidad semanal en las semanas que traslapan su etapa (sin fechas = todo el horizonte). No cuentan etapas `Completado`/`Cancelado` ni proyectos `Completado`, `Cancelado` o `Pausado`. `utilizacion` es `null` si no hay horas disponibles.

---

### 6.3 Proyectos y portafolio

**`ProyectoRead`** (usado en el listado)
```json
{ "id_proyecto": 1, "nombre_proyecto": "Portal", "problema_oportunidad": "...", "objetivo": "...",
  "alcance": "...", "fuera_de_alcance": "...", "fecha_tentativa": null, "fecha_comprometida": "2026-12-15",
  "fecha_inicio": "2026-10-01", "fecha_real_cierre": null, "horas_presupuestadas": "400.00", "horas_presupuestadas_manual": false, "id_solicitud": null, "lider_id": 1,
  "etapa_actual": "Construcción y Ejecución", "estado_proyecto": "Activo", "porcentaje_avance": "42.00",
  "semaforo": "Amarillo", "semaforo_motivo": "Avance 42 % vs. 50 % esperado" }
```

**`ProyectoDetalle`** = `ProyectoRead` + `empresas_impactadas` + `horas_en_tareas` (suma de horas de sus tareas, para mostrar el presupuesto restante):
```json
"empresas_impactadas": [ { "id_empresa": 1, "id_area": 2, "nivel_impacto": "Alto", "notas_impacto": null } ]
```

#### `POST /proyectos` → `201` (devuelve `ProyectoDetalle`)
| Campo | Tipo | Obligatorio | Notas |
| :--- | :--- | :---: | :--- |
| `nombre_proyecto` | string | sí | 1–200 |
| `problema_oportunidad`, `objetivo`, `alcance`, `fuera_de_alcance` | string | sí | no vacíos |
| `lider_id` | int | sí | usuario activo |
| `id_solicitud` | int \| null | no | ver regla 3 |
| `fecha_inicio`, `fecha_tentativa`, `fecha_comprometida` | date \| null | no | el inicio no puede ser posterior al fin (comprometida o, si no hay, tentativa) |
| `horas_presupuestadas` | decimal \| null | no | ≥ 0; tope para la suma de horas de las tareas. **Omitido o `null`: se calcula** con el calendario laboral (§6.8) entre `fecha_inicio` y el fin; sin ambas fechas queda sin límite. Con valor: se fija a mano (`horas_presupuestadas_manual = true`) |
| `empresas_impactadas` | array | no | `[{ id_empresa, id_area, nivel_impacto, notas_impacto? }]`, sin empresas repetidas; `id_area` es obligatoria y debe pertenecer a esa empresa (`id_area` es `null` solo en proyectos anteriores) |

`etapa_actual`, `estado_proyecto` y `porcentaje_avance` no se envían: inicia en `Análisis y Viabilidad` · `Sin Iniciar` · 0 %, y se crean sus cinco etapas.
Errores: `404` (líder, solicitud, empresa o área inexistente); `409` solicitud ya usada; `422` líder inactivo, empresas repetidas, falta `id_area` o el área no es de esa empresa.

#### `GET /proyectos` → `200` — Portafolio
Query (todos opcionales y combinables): `semaforo`, `id_empresa`, `estado` (`EstadoProyecto`), `etapa` (`NombreEtapa`), `lider_id`, `limit` (default 50, máx. 200), `offset`.
Respuesta `{ items: ProyectoRead[], total, limit, offset }`, ordenado del más reciente al más antiguo. `total` es el conteo con los filtros aplicados (úselo para paginar).

#### `GET /proyectos/{id_proyecto}` → `200`
`ProyectoDetalle`. `404` si no existe.

#### `PATCH /proyectos/{id_proyecto}` → `200`
Campos editables: `nombre_proyecto`, `problema_oportunidad`, `objetivo`, `alcance`, `fuera_de_alcance`, `fecha_inicio`, `fecha_tentativa`, `fecha_comprometida`, `horas_presupuestadas`, `lider_id`, `empresas_impactadas`. `horas_presupuestadas` con valor lo fija a mano; `null` vuelve al cálculo automático, que se rehace al cambiar las fechas. Al cambiar fechas o presupuesto, las tareas existentes deben seguir cabiendo (`422` si no). Las fechas sí aceptan `null` para borrarlas; el resto no. `empresas_impactadas`, si se envía, **reemplaza la lista completa** con las mismas reglas que al crear (área obligatoria y de esa empresa, sin repetidas); `[]` las quita todas. Devuelve `ProyectoDetalle`.

#### `DELETE /proyectos/{id_proyecto}` → `204`
Borrado **definitivo** del proyecto con sus etapas, asignaciones, bloqueos, hitos, retrabajos, avances, compromisos, empresas impactadas y dependencias. Si venía de una solicitud de demanda en `En Ejecución`, esta vuelve a `Planeado`. Queda registrado en la bitácora. Permiso: solo Director (`403`). `404` si no existe. Para detener un proyecto conservando su historial, usar el estatus `Cancelado`.

#### `PATCH /proyectos/{id_proyecto}/estado` → `200`
```json
{ "etapa_actual": "Pruebas y Validación", "estado_proyecto": "En Revisión" }
```
Todos los campos son opcionales, pero hay que enviar al menos uno de `etapa_actual` o `estado_proyecto`. El avance se recalcula con las tareas. `fecha_real_cierre` solo se usa al pasar a `Completado`. Aplica la regla 1 y devuelve `ProyectoDetalle`. Error `422` con el motivo (salto de etapa, estatus no permitido con la lista de válidos o proyecto ya `Completado`/`Cancelado`).

---

### 6.4 Etapas del proyecto

**`EtapaRead`**
```json
{ "id_etapa": 1, "id_proyecto": 1, "nombre_etapa": "Construcción y Ejecución", "orden_secuencia": 3,
  "horas_estimadas": "120.00", "horas_efectivas_reales": "0.00",
  "fecha_inicio_est": null, "fecha_fin_est": null, "estado_etapa": "Activo" }
```

#### `PATCH /proyectos/{id_proyecto}/etapas/{id_etapa}` → `200`
Cuerpo (parcial): `horas_estimadas` (decimal ≥ 0, no nulo), `fecha_inicio_est`, `fecha_fin_est` (fin no puede ser anterior al inicio; `null` borra). El estatus no se edita aquí: lo sincroniza `PATCH /proyectos/{id}/estado`.
Errores: `404` proyecto o etapa (de otro proyecto); `422` fechas incoherentes.

#### `GET /proyectos/{id_proyecto}/etapas` → `200`
Arreglo de `EtapaRead` ordenado por `orden_secuencia`.

---

### 6.5 Asignación de recursos

**`AsignacionRead`**
```json
{ "id_asignacion": 1, "id_proyecto": 1, "id_usuario": 2, "id_etapa": 1,
  "perfil_requerido": "Backend", "horas_asignadas": "80.00", "porcentaje_utilizacion": "50.00" }
```

#### `POST /proyectos/{id_proyecto}/asignaciones` → `201`
| Campo | Tipo | Reglas |
| :--- | :--- | :--- |
| `id_usuario` | int | recurso activo |
| `id_etapa` | int | etapa del mismo proyecto |
| `perfil_requerido` | string | 1–100 caracteres, texto libre (rol desempeñado) |
| `horas_asignadas` | decimal | > 0 |
| `porcentaje_utilizacion` | decimal | 0–100 (lo informa el cliente; el backend no lo calcula) |

Permiso: líder del proyecto, Gerentes o Director (`403`). El frontend avisa si la asignación sobreasigna a la persona (no se bloquea). Errores: `404` proyecto o etapa (de otro proyecto); `409` usuario ya asignado a esa etapa; `422` usuario inactivo o proyecto `Completado`/`Cancelado`.

#### `GET /proyectos/{id_proyecto}/asignaciones` → `200`
Arreglo de `AsignacionRead`.

---

### 6.6 Bloqueos e interrupciones

**`BloqueoRead`**
```json
{ "id_bloqueo": 1, "id_proyecto": 1, "id_etapa": 1, "id_tarea": 4, "titulo_tarea": "Levantar requerimientos", "causa_raiz": "Espera del Cliente",
  "responsable_origen": "Cliente", "fecha_inicio_bloqueo": "2026-10-01T08:00:00Z",
  "fecha_fin_bloqueo": "2026-10-03T20:00:00Z", "dias_impacto": "2.50" }
```

#### `POST /bloqueos` → `201`
| Campo | Tipo | Obligatorio | Notas |
| :--- | :--- | :---: | :--- |
| `id_proyecto` | int | sí | |
| `id_etapa` | int | sí | debe pertenecer al proyecto |
| `id_tarea` | int \| null | no | actividad relacionada; debe ser una tarea **de esa etapa**. Sin ella, el bloqueo queda en la etapa. Si la tarea se borra, pasa a `null` |
| `causa_raiz` | `CausaRaiz` | sí | |
| `responsable_origen` | `ResponsableOrigen` | sí | |
| `fecha_inicio_bloqueo` | datetime con zona | no | default: ahora |
| `fecha_fin_bloqueo` | datetime con zona | no | si se envía, se calcula `dias_impacto` |

Errores: `404` proyecto o etapa; `422` fin anterior al inicio.

#### `GET /bloqueos` → `200`
Query: `id_proyecto`, `id_etapa`, `id_tarea`, `causa_raiz`, `responsable_origen`, `abierto` (`true` = sin fecha de fin, `false` = cerrados), `limit`, `offset`. Arreglo de `BloqueoRead`, del más reciente al más antiguo.

#### `GET /bloqueos/{id_bloqueo}` → `200`
`404` si no existe.

#### `PATCH /bloqueos/{id_bloqueo}` → `200`
Campos editables: `id_tarea` (`null` la desvincula; debe ser de la etapa del bloqueo), `causa_raiz`, `responsable_origen`, `fecha_inicio_bloqueo`, `fecha_fin_bloqueo`. `dias_impacto` se recalcula automáticamente si hay fecha de fin y se pone en `null` si no la hay. Errores: `404`; `422` fechas incoherentes o campos obligatorios en `null`.

#### `POST /bloqueos/{id_bloqueo}/cerrar` → `200`
Cuerpo opcional: `{ "fecha_fin_bloqueo": "2026-10-06T12:00:00Z" }` (por defecto: ahora). Libera el bloqueo y calcula `dias_impacto`. Error `422` si ya estaba cerrado o si la fecha es anterior al inicio.

#### `DELETE /bloqueos/{id_bloqueo}` → `204`
Eliminación física.

---

### 6.7 Tareas

**`TareaRead`**
```json
{ "id_tarea": 1, "id_proyecto": 1, "nombre_proyecto": "Portal", "estado_proyecto": "Activo",
  "id_etapa": 3, "nombre_etapa": "Construcción y Ejecución", "orden_etapa": 3,
  "id_usuario": 2, "nombre_usuario": "Ana López", "titulo": "Maquetar login", "descripcion": null,
  "horas_asignadas": "6.00", "fecha_inicio": "2026-10-20", "fecha_fin": "2026-10-22",
  "estado": "En progreso", "fecha_creacion": "2026-10-19T18:00:00Z", "fecha_finalizacion": null,
  "num_comentarios": 0, "bloqueada": false,
  "dependencias": [{ "id_tarea": 4, "titulo": "Definir diseño", "estado": "Finalizado" }],
  "dependientes": [{ "id_tarea": 9, "titulo": "Pruebas de login", "estado": "Pendiente" }] }
```

#### `POST /proyectos/{id_proyecto}/tareas` → `201`
| Campo | Tipo | Obligatorio | Notas |
| :--- | :--- | :---: | :--- |
| `titulo` | string | sí | 1–200 |
| `descripcion` | string \| null | no | |
| `id_etapa` | int | sí | etapa del mismo proyecto |
| `id_usuario` | int | sí | persona activa **del proyecto**: su líder o alguien con una asignación en él |
| `horas_asignadas` | decimal | sí | ≥ 0; la suma de las tareas del proyecto no puede exceder `horas_presupuestadas` |
| `fecha_inicio`, `fecha_fin` | date \| null | no | fin no anterior al inicio; ambas dentro de las fechas del proyecto (`fecha_inicio` … comprometida o tentativa) |
| `estado` | `EstadoTarea` | no | default `Pendiente` |
| `dependencias` | int[] | no | tareas **del mismo proyecto** que deben estar `Finalizado` antes de que esta salga de `Pendiente`; sin autodependencia ni ciclos (directos o indirectos) |

Permiso: líder del proyecto, Gerentes o Director (`403`). Errores: `404` proyecto, etapa o usuario; `422` persona inactiva o ajena al proyecto, fechas incoherentes o fuera del proyecto, presupuesto de horas excedido o proyecto `Completado`/`Cancelado`.

#### `GET /proyectos/{id_proyecto}/tareas` → `200`
Query opcional: `id_etapa`, `id_usuario`, `estado`. Ordenadas por fecha límite.

#### `GET /tareas` → `200`
Tareas de una persona en todos sus proyectos. Sin `id_usuario`, las de quien consulta (vacío si la sesión no está ligada a una persona del Equipo). Ver las de otra persona: solo Gerentes y Director (`403`). Query opcional: `estado`.

#### `PATCH /tareas/{id_tarea}` → `200`
Cuerpo parcial con los campos de alta. La **persona asignada** solo puede cambiar `estado` (mover la tarjeta en el kanban); el líder, Gerentes y Director pueden cambiar todo. `dependencias` reemplaza la lista completa (solo quien gestiona). **Regla de dependencias:** la tarea solo puede pasar a `En progreso`, `En revisión` o `Finalizado` si todas sus dependencias están `Finalizado` (`422` que lista las pendientes); `bloqueada: true` indica que aún no puede. Agregar una dependencia a una tarea ya iniciada no la regresa a `Pendiente`. Pasar a `Finalizado` registra `fecha_finalizacion` y recalcula el avance (regla 1), lo que puede hacer avanzar la etapa o completar el proyecto. Errores: `403`; `404`; `422` como en el alta.

#### `DELETE /tareas/{id_tarea}` → `204`
Solo líder, Gerentes o Director. Recalcula el avance y elimina sus dependencias (las tareas que la esperaban quedan libres).

#### Trazabilidad, comentarios y menciones

Cada alta, edición, movimiento y baja de una tarea queda en la bitácora (`entidad = "tarea"`) con quién, cuándo y un `resumen` legible (p. ej. `Movida de «En progreso» a «Finalizado»`, `Responsable: Ana → Luis`, `Ahora depende de «Diseño»`). Una edición sin cambios reales no se registra. `TareaRead` incluye `num_comentarios`.

- `GET /tareas/{id_tarea}/actividad` → `EventoTarea[]` del más antiguo al más reciente: `{ tipo: "cambio" | "comentario", fecha, id_actor, actor_nombre, accion?, resumen?, cambios?, id_comentario?, texto?, menciones: [{ id_usuario, nombre }] }`.
- `GET /proyectos/{id_proyecto}/involucrados` → personas activas que se pueden mencionar: líder y quienes tienen asignación (`{ id_usuario, nombre, es_lider }`).
- `POST /tareas/{id_tarea}/comentarios` → `201` `EventoTarea`. Cuerpo `{ texto (1–4000), menciones: [id_usuario] }`. Comentan las personas del proyecto, Gerentes y Director (`403`); solo se puede mencionar a involucrados (`422`). Mencionarse a sí mismo no notifica; los ids repetidos cuentan una vez.
- `DELETE /comentarios/{id_comentario}` → `204`. Autor, Gerentes o Director.

**Notificaciones** (cada mención es una):
- `GET /notificaciones?solo_no_leidas=&limit=` → `{ no_leidas, items: [{ id_mencion, leida, fecha, autor_nombre, texto, id_tarea, titulo_tarea, id_proyecto, nombre_proyecto }] }` de quien consulta (vacío si la sesión no está ligada a una persona).
- `POST /notificaciones/{id_mencion}/leer` → `204` (solo las propias; `404` si no). `POST /notificaciones/leer-todas` → `204`.

---

### 6.8 Configuración (calendario laboral)

Calcula las horas presupuestadas de los proyectos: Σ horas de cada día entre el inicio y el fin del proyecto (ambos incluidos): lunes a viernes `horas_entre_semana`, sábado `horas_sabado` (0 = no cuenta), domingo nunca, y los `dias_inactivos` no cuentan. Por defecto: 8 h y 5 h, sin días desactivados.

**`ConfiguracionLaboral`**
```json
{ "horas_entre_semana": "8", "horas_sabado": "5", "dias_inactivos": ["2026-12-25", "2026-12-26"] }
```

#### `GET /configuracion` → `200`
#### `PUT /configuracion` → `200`
Cuerpo: `ConfiguracionLaboral` completo (horas entre 0 y 24; `dias_inactivos` cualquier fecha, se ordenan y deduplican). Solo Director (`403`). Recalcula el presupuesto de los proyectos abiertos en cálculo automático y devuelve además `proyectos_recalculados` y `proyectos_excedidos` (los que quedaron con más horas en tareas que presupuesto; no se bloquea).

#### `GET /configuracion/horas-laborales?desde=&hasta=` → `200`
`{ "desde", "hasta", "horas", "dias_laborables" }` según el calendario vigente. Para mostrar el cálculo antes de guardar un proyecto.

---

## 7. Flujos típicos para el frontend

**Alta inicial de datos maestros:** `POST /empresas` → `POST /areas`; `GET /puestos` (o `POST /puestos`) → `POST /usuarios` (líder y recursos).

**Crear y planificar un proyecto:**
1. `GET /usuarios?activo=true` (cualquier persona activa puede liderar) y `GET /empresas` para poblar los selectores.
2. `POST /proyectos` con empresas impactadas.
3. `PATCH /proyectos/{id}/etapas/{id_etapa}` para planificar horas y fechas de cada etapa.
4. `POST /proyectos/{id}/asignaciones` por cada recurso.
5. `POST /proyectos/{id}/tareas` por cada tarea de cada etapa.
6. Cada persona mueve sus tareas con `PATCH /tareas/{id}` (`GET /tareas` para su tablero); al finalizar las de la etapa actual el proyecto avanza solo. `PATCH /proyectos/{id}/estado` queda para regresar de etapa, avanzar una etapa sin tareas o cambiar el estatus.

**Tablero de portafolio:** `GET /proyectos?semaforo=Rojo&id_empresa=1&limit=50&offset=0`; para el conteo por semáforo, una llamada por valor leyendo solo `total` (con `limit=1`).

**Gestión de bloqueos de un proyecto:** `GET /bloqueos?id_proyecto=1&abierto=true` para los activos; `POST /bloqueos` al reportar uno; `POST /bloqueos/{id}/cerrar` al resolverlo.

---

## 8. Funcionalidad pendiente (sin endpoints todavía)

Las tablas y modelos ya existen en la base de datos, pero la API aún no las expone: **solicitudes de demanda**, **business case**, **evaluación financiera**, **hitos/entregables**, **retrabajo**, **actualizaciones de avance**, **compromisos del cliente**, **realización de valor**, **dependencias entre proyectos** y las vistas analíticas de capacidad/productividad. Tampoco hay autenticación ni listados de asignaciones por usuario (carga de capacidad). Conviene que el frontend deje estas áreas desacopladas hasta que se definan.
