import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { useCreateArea, useCreateEmpresa } from '@/api/hooks'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { FormError } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { emptyToNull } from '@/lib/format'
import type { Empresa } from '@/types/api'

const notBlank = (v: string) => v.trim() !== '' || 'Obligatorio'

export function EmpresaFormModal({ onClose }: { onClose: () => void }) {
  const formId = useId()
  const toast = useToast()
  const mutation = useCreateEmpresa()
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { nombre_empresa: '', division: '', grupo: '' },
  })
  return (
    <Modal open onClose={onClose} size="sm" title="Nueva empresa"
      footer={<>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button variant="primary" type="submit" form={formId} loading={mutation.isPending}>Crear empresa</Button>
      </>}>
      <form id={formId} noValidate className="space-y-4"
        onSubmit={handleSubmit((v) =>
          mutation.mutate(
            { nombre_empresa: v.nombre_empresa.trim(), division: emptyToNull(v.division), grupo: emptyToNull(v.grupo) },
            { onSuccess: () => { toast.success('Empresa creada'); onClose() } },
          ))}>
        <TextField label="Nombre" required error={errors.nombre_empresa?.message} {...register('nombre_empresa', { validate: notBlank })} />
        <TextField label="División" {...register('division')} />
        <TextField label="Grupo" {...register('grupo')} />
        <FormError error={mutation.error} />
      </form>
    </Modal>
  )
}

export function AreaFormModal({ empresas, defaultEmpresa, onClose }: {
  empresas: Empresa[]; defaultEmpresa?: number; onClose: () => void
}) {
  const formId = useId()
  const toast = useToast()
  const mutation = useCreateArea()
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { id_empresa: defaultEmpresa ? String(defaultEmpresa) : '', nombre_area: '', codigo_area: '' },
  })
  return (
    <Modal open onClose={onClose} size="sm" title="Nueva área"
      footer={<>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button variant="primary" type="submit" form={formId} loading={mutation.isPending}>Crear área</Button>
      </>}>
      <form id={formId} noValidate className="space-y-4"
        onSubmit={handleSubmit((v) =>
          mutation.mutate(
            { id_empresa: Number(v.id_empresa), nombre_area: v.nombre_area.trim(), codigo_area: v.codigo_area.trim() },
            { onSuccess: () => { toast.success('Área creada'); onClose() } },
          ))}>
        <SelectField label="Empresa" required error={errors.id_empresa?.message} {...register('id_empresa', { required: 'Obligatorio' })}>
          <option value="">Selecciona una empresa…</option>
          {empresas.map((e) => <option key={e.id_empresa} value={e.id_empresa}>{e.nombre_empresa}</option>)}
        </SelectField>
        <TextField label="Nombre del área" required error={errors.nombre_area?.message} {...register('nombre_area', { validate: notBlank })} />
        <TextField label="Código" required hint="Debe ser único. Ej.: DTI-01" error={errors.codigo_area?.message}
          {...register('codigo_area', { validate: notBlank })} />
        <FormError error={mutation.error} />
      </form>
    </Modal>
  )
}
