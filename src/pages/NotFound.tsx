import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <EmptyState
      title="Página no encontrada"
      description="La dirección que buscas no existe o fue movida."
      action={<Link to="/"><Button variant="primary">Volver al panel</Button></Link>}
    />
  )
}
