import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { AppShell } from '@/components/layout/AppShell'
import { Spinner } from '@/components/ui/Feedback'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Proyectos = lazy(() => import('@/pages/Proyectos'))
const ProyectoDetalle = lazy(() => import('@/pages/ProyectoDetalle'))
const Bloqueos = lazy(() => import('@/pages/Bloqueos'))
const EquiposTrabajo = lazy(() => import('@/pages/EquiposTrabajo'))
const EquipoTrabajoDetalle = lazy(() => import('@/pages/EquipoTrabajoDetalle'))
const MisTareas = lazy(() => import('@/pages/MisTareas'))
const MiPerfil = lazy(() => import('@/pages/MiPerfil'))
const Equipo = lazy(() => import('@/pages/Equipo'))
const PersonaDetalle = lazy(() => import('@/pages/PersonaDetalle'))
const Login = lazy(() => import('@/pages/Login'))
const CambiarPasswordTemporal = lazy(() => import('@/pages/Login').then((m) => ({ default: m.CambiarPasswordTemporal })))
const Organizacion = lazy(() => import('@/pages/Organizacion'))
const Configuracion = lazy(() => import('@/pages/Configuracion'))
const NotFound = lazy(() => import('@/pages/NotFound'))

export default function App() {
  const { estado, sesion } = useAuth()
  if (estado === 'cargando') return <Spinner className="min-h-dvh" label="Verificando sesión…" />
  return (
    <Suspense fallback={<Spinner className="min-h-dvh" />}>
      {estado === 'anonimo' ? <Login /> : sesion?.password_temporal ? <CambiarPasswordTemporal /> : (
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="proyectos" element={<Proyectos />} />
          <Route path="proyectos/:id" element={<ProyectoDetalle />} />
          <Route path="tareas" element={<MisTareas />} />
          {/* Operación se integró a Mis tareas: los enlaces antiguos se redirigen conservando la consulta. */}
          <Route path="operacion" element={<RedirigirOperacion />} />
          <Route path="perfil" element={<MiPerfil />} />
          <Route path="bloqueos" element={<Bloqueos />} />
          <Route path="equipos-trabajo" element={<EquiposTrabajo />} />
          <Route path="equipos-trabajo/:id" element={<EquipoTrabajoDetalle />} />
          <Route path="equipo" element={<Equipo />} />
          <Route path="equipo/:id" element={<PersonaDetalle />} />
          <Route path="organizacion" element={<Organizacion />} />
          <Route path="configuracion" element={<Configuracion />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      )}
    </Suspense>
  )
}

function RedirigirOperacion() {
  const { search } = useLocation()
  return <Navigate to={`/tareas${search}`} replace />
}
