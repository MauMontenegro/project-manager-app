import { UserRound } from 'lucide-react'
import { usePerfil } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/Feedback'
import { Card, PageHeader } from '@/components/ui/Layout'
import { Ficha } from './PersonaDetalle'

export default function MiPerfil() {
  const { sesion } = useAuth()
  const ligada = !!sesion?.id_usuario
  const perfil = usePerfil(ligada)

  if (!ligada) {
    return (
      <>
        <PageHeader title="Mi perfil" />
        <Card>
          <EmptyState icon={<UserRound className="size-6" />} title="Tu sesión no está ligada a una persona del Equipo"
            description={sesion?.auth_habilitada
              ? 'Pide a tu gerente que te registre en Equipo con tu correo.'
              : 'Estás como “Administrador local”. Para usar un perfil en local, define LOCAL_ID_USUARIO en el .env de la API con el id de la persona.'} />
        </Card>
      </>
    )
  }
  if (perfil.isPending) return <Spinner className="py-24" />
  if (perfil.isError) return <ErrorState error={perfil.error} onRetry={() => perfil.refetch()} />
  return <Ficha u={perfil.data} perfil />
}
