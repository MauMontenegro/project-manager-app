import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Spinner } from '@/components/ui/Feedback'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Proyectos = lazy(() => import('@/pages/Proyectos'))
const ProyectoDetalle = lazy(() => import('@/pages/ProyectoDetalle'))
const Bloqueos = lazy(() => import('@/pages/Bloqueos'))
const Equipo = lazy(() => import('@/pages/Equipo'))
const Organizacion = lazy(() => import('@/pages/Organizacion'))
const NotFound = lazy(() => import('@/pages/NotFound'))

export default function App() {
  return (
    <Suspense fallback={<Spinner className="min-h-dvh" />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="proyectos" element={<Proyectos />} />
          <Route path="proyectos/:id" element={<ProyectoDetalle />} />
          <Route path="bloqueos" element={<Bloqueos />} />
          <Route path="equipo" element={<Equipo />} />
          <Route path="organizacion" element={<Organizacion />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
