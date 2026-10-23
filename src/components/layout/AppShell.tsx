import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AlertOctagon, Boxes, Building2, FolderKanban, KanbanSquare, LayoutDashboard, LogOut, Menu, Moon, Settings, Sun, UserRound, Users, X } from 'lucide-react'
import { useAuth, usePermisos } from '@/auth/AuthProvider'
import { cn } from '@/lib/cn'
import { IconButton } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Layout'
import { NotificacionesBell } from './NotificacionesBell'
import { Asistente } from '@/features/asistente/Asistente'
import { EquipoTrabajoProvider, SelectorEquipoTrabajo } from '@/features/equipos-trabajo/EquipoTrabajoActivo'

const nav = [
  { to: '/', label: 'Panel', icon: LayoutDashboard, end: true },
  { to: '/tareas', label: 'Mis tareas', icon: KanbanSquare },
  { to: '/perfil', label: 'Mi perfil', icon: UserRound },
  { to: '/proyectos', label: 'Proyectos', icon: FolderKanban },
  { to: '/bloqueos', label: 'Bloqueos', icon: AlertOctagon },
  { to: '/equipos-trabajo', label: 'Equipos de trabajo', icon: Boxes },
  { to: '/equipo', label: 'Equipo', icon: Users },
  { to: '/organizacion', label: 'Organización', icon: Building2 },
  { to: '/configuracion', label: 'Configuración', icon: Settings, soloGestion: true },
]

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggle = () => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.setItem('theme', next ? 'dark' : 'light') } catch { /* modo privado */ }
    setDark(next)
  }
  return { dark, toggle }
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-brand-fg">P</span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-fg">Petroil</p>
        <p className="text-[11px] text-muted">Gestión de proyectos</p>
      </div>
    </div>
  )
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { gestionaEquipo } = usePermisos()
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {nav.filter((n) => !n.soloGestion || gestionaEquipo).map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to} to={to} end={end} onClick={onNavigate}
          className={({ isActive }) => cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2 hover:text-fg',
          )}
        >
          <Icon className="size-[18px]" aria-hidden /> {label}
        </NavLink>
      ))}
    </nav>
  )
}

function UserCard() {
  const { sesion, salir } = useAuth()
  if (!sesion) return null
  const contenido = (
    <>
      <Avatar name={sesion.nombre} />
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-fg">{sesion.nombre}</p>
        <p className="truncate text-xs text-muted">{sesion.rol}{sesion.departamento ? ` · ${sesion.departamento}` : ''}</p>
      </div>
    </>
  )
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
      <NavLink to="/perfil" title="Mi perfil" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md hover:opacity-80">{contenido}</NavLink>
      {sesion.auth_habilitada && <IconButton label="Cerrar sesión" onClick={() => void salir()}><LogOut className="size-4" /></IconButton>}
    </div>
  )
}

export function AppShell() {
  const [open, setOpen] = useState(false)
  const { dark, toggle } = useTheme()
  const { pathname } = useLocation()

  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [pathname])

  const themeBtn = (
    <IconButton label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} onClick={toggle}>
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </IconButton>
  )

  return (
    <EquipoTrabajoProvider>
    <div className="min-h-dvh lg:pl-64">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:rounded-lg focus:bg-brand focus:px-3 focus:py-2 focus:text-brand-fg">
        Saltar al contenido
      </a>

      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-surface p-4 lg:flex">
        <div className="px-2 py-2"><Brand /></div>
        <div className="mt-4"><SelectorEquipoTrabajo /></div>
        <div className="mt-4 flex-1 overflow-y-auto"><NavList /></div>
        <div className="border-t border-border pt-2"><UserCard /></div>
        <div className="flex items-center justify-between border-t border-border px-2 pt-3">
          <NotificacionesBell />
          <div className="flex items-center gap-1"><span className="text-xs text-muted">Tema</span>{themeBtn}</div>
        </div>
      </aside>

      {/* Barra superior móvil */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur lg:hidden">
        <Brand />
        <div className="flex items-center">
          <NotificacionesBell alinear="derecha" />
          {themeBtn}
          <IconButton label="Abrir menú" onClick={() => setOpen(true)} aria-expanded={open}><Menu className="size-5" /></IconButton>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden />
          <div className="animate-slide-in absolute inset-y-0 right-0 flex w-72 flex-col border-l border-border bg-surface p-4">
            <div className="mb-4 flex items-center justify-between">
              <Brand />
              <IconButton label="Cerrar menú" onClick={() => setOpen(false)}><X className="size-5" /></IconButton>
            </div>
            <div className="mb-4"><SelectorEquipoTrabajo onNavigate={() => setOpen(false)} /></div>
            <div className="flex-1 overflow-y-auto"><NavList onNavigate={() => setOpen(false)} /></div>
            <div className="border-t border-border pt-2"><UserCard /></div>
          </div>
        </div>
      )}

      <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
      <Asistente />
    </div>
    </EquipoTrabajoProvider>
  )
}
