import { Server } from 'lucide-react'
import { Avatar } from '@/components/ui/Layout'
import { cn } from '@/lib/cn'
import type { Usuario } from '@/types/api'

/** Avatar con iniciales; los activos llevan un ícono para distinguirlos de las personas. */
export function RecursoAvatar({ usuario, className }: { usuario: Pick<Usuario, 'nombre' | 'tipo_recurso'>; className?: string }) {
  if (usuario.tipo_recurso === 'Activo') {
    return (
      <span aria-hidden className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-soft text-muted', className)}>
        <Server className="size-4" />
      </span>
    )
  }
  return <Avatar name={usuario.nombre} className={cn(usuario.tipo_recurso === 'Externo' && 'bg-warn-soft text-warn', className)} />
}
