import { useId, useState } from 'react'
import { useActualizarPerfil, useSkills } from '@/api/hooks'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { FormError } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { SkillsInput } from '@/components/ui/SkillsInput'
import { useToast } from '@/components/ui/Toast'
import type { SkillAsignada, Usuario } from '@/types/api'

/** Lo que cada persona puede cambiar de sí misma: nombre y skills. */
export function PerfilFormModal({ usuario, onClose }: { usuario: Usuario; onClose: () => void }) {
  const formId = useId()
  const toast = useToast()
  const mutation = useActualizarPerfil()
  const catalogo = useSkills()
  const [nombre, setNombre] = useState(usuario.nombre)
  const [skills, setSkills] = useState<SkillAsignada[]>(usuario.skills)
  const error = nombre.trim() === '' ? 'Obligatorio' : skills.length > 30 ? 'Máximo 30 skills' : null

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (error) return
    mutation.mutate({ nombre: nombre.trim(), skills }, {
      onSuccess: () => { toast.success('Perfil actualizado'); onClose() },
    })
  }

  return (
    <Modal open onClose={onClose} title="Editar mi perfil"
      description="Puesto, departamento, rol y capacidad los actualiza tu gerente desde Equipo."
      footer={<>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button variant="primary" type="submit" form={formId} loading={mutation.isPending} disabled={!!error}>Guardar</Button>
      </>}>
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        <TextField label="Nombre" required maxLength={150} value={nombre} onChange={(e) => setNombre(e.target.value)}
          error={nombre.trim() === '' ? 'Obligatorio' : undefined} />
        <SkillsInput label="Habilidades" value={skills} onChange={setSkills}
          suggestions={catalogo.data?.map((s) => s.nombre)} error={skills.length > 30 ? 'Máximo 30 skills' : undefined}
          hint="Enter o coma para agregar · clic en los puntos para cambiar el nivel (básico → intermedio → experto)." />
        <FormError error={mutation.error} />
      </form>
    </Modal>
  )
}
