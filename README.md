# Petroil · Gestión de Proyectos (frontend)

SPA en **React 19 + TypeScript + Tailwind CSS v4** (Vite) para el backend descrito en [API.md](API.md).

## Inicio rápido

```bash
pnpm install
cp .env.example .env     # VITE_API_URL=http://localhost:8000
pnpm dev              # http://localhost:5173
pnpm build            # typecheck + build de producción
```

El backend debe estar corriendo en `VITE_API_URL` (CORS permitido para `:5173`).

## Pantallas

| Ruta | Contenido |
| :--- | :--- |
| `/` | Panel: KPIs, salud por semáforo, proyectos por estado, críticos y bloqueos abiertos |
| `/proyectos` | Portafolio con filtros (semáforo, estado, empresa, líder) en la URL y paginación |
| `/proyectos/:id` | Detalle: resumen, etapas, asignaciones, bloqueos, edición y cambio de estado (solo transiciones válidas) |
| `/bloqueos` | Bloqueos globales: filtros, reportar, resolver y eliminar |
| `/equipo` | Personas: búsqueda, filtros, alta, edición y baja lógica |
| `/organizacion` | Empresas y áreas |

## Estructura

```
src/
  api/        hooks de React Query (uno por recurso) y mapas de lookup
  lib/        cliente HTTP (ApiError), formatos, utilidades
  types/      tipos y enums del backend + tabla de transiciones
  components/ ui/ (sistema de componentes) y layout/
  features/   formularios/modales por dominio
  pages/      una página por ruta (carga diferida)
```

## Decisiones

- **Decimales como string**: se convierten con `num()` solo para mostrar/calcular.
- **Errores 422**: `ApiError` unifica `detail` string (negocio) y array (esquema) en un mensaje legible.
- **Tema claro/oscuro** con tokens CSS; respeta `prefers-color-scheme`.
- **Accesibilidad**: foco visible, modales con trampa de foco y Esc, tabs con flechas, el semáforo siempre incluye texto además de color.
- Áreas sin API (demandas, hitos, valor, etc.) quedan fuera, según API.md §8.
