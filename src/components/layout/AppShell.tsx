import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AlertOctagon, Building2, FolderKanban, LayoutDashboard, Menu, Moon, Sun, Users, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from '@/components/ui/Button'

const nav = [
  { to: '/', label: 'Panel', icon: LayoutDashboard, end: true },
  { to: '/proyectos', label: 'Proyectos', icon: FolderKanban },
  { to: '/bloqueos', label: 'Bloqueos', icon: AlertOctagon },
  { to: '/equipo', label: 'Equipo', icon: Users },
  { to: '/organizacion', label: 'Organización', icon: Building2 },
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
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {nav.map(({ to, label, icon: Icon, end }) => (
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
    <div className="min-h-dvh lg:pl-64">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:rounded-lg focus:bg-brand focus:px-3 focus:py-2 focus:text-brand-fg">
        Saltar al contenido
      </a>

      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-surface p-4 lg:flex">
        <div className="px-2 py-2"><Brand /></div>
        <div className="mt-6 flex-1"><NavList /></div>
        <div className="flex items-center justify-between border-t border-border px-2 pt-3">
          <span className="text-xs text-muted">Tema</span>{themeBtn}
        </div>
      </aside>

      {/* Barra superior móvil */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur lg:hidden">
        <Brand />
        <div className="flex items-center">
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
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  )
}
