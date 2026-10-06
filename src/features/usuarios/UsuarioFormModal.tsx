import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { useAreas, useCreateUsuario, useEmpresas, useUpdateUsuario } from '@/api/hooks'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { FormError } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { PERFILES_TECNICOS, type PerfilTecnico, type Usuario } from '@/types/api'

interface FormValues {
  nombre: string
  correo: string
  perfil_tecnico: PerfilTecnico
  capacidad_horas_semanales: string
  id_area: string
  activo: boolean
}

export function UsuarioFormModal({ usuario, onClose }: { usuario?: Usuario; onClose: () => void }) {
  const editing = !!usuario
  const formId = useId()
  const toast = useToast()
  const create = useCreateUsuario()
  const update = useUpdateUsuario()
  const mutation = editing ? update : create
  const areas = useAreas()
  const empresas = useEmpresas()
  const empresaNombre = new Map(empresas.data?.map((e) => [e.id_empresa, e.nombre_empresa]))

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      nombre: usuario?.nombre ?? '', correo: usuario?.correo ?? '', perfil_tecnico: usuario?.perfil_tecnico ?? 'Backend',
      capacidad_horas_semanales: usuario ? String(Number(usuario.capacidad_horas_semanales)) : '40',
      id_area: usuario ? String(usuario.id_area) : '', activo: usuario?.activo ?? true,
    },
  })

  const onSubmit = (v: FormValues) => {
    const body = {
      nombre: v.nombre.trim(), correo: v.correo.trim(), perfil_tecnico: v.perfil_tecnico,
      capacidad_horas_semanales: v.capacidad_horas_semanales, id_area: Number(v.id_area), activo: v.activo,
    }
    const done = () => { toast.success(editing ? 'Usuario actualizado' : 'Usuario creado'); onClose() }
    if (editing) update.mutate({ id: usuario.id_usuario, body }, { onSuccess: done })
    else create.mutate(body, { onSuccess: done })
  }

  return (
    <Modal open onClose={onClose} title={editing ? 'Editar persona' : 'Nueva persona'}
      footer={<>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button variant="primary" type="submit" form={formId} loading={mutation.isPending}>{editing ? 'Guardar cambios' : 'Crear'}</Button>
      </>}>
      <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <TextField label="Nombre completo" required maxLength={150} error={errors.nombre?.message}
          {...register('nombre', { validate: (v) => v.trim() !== '' || 'Obligatorio' })} />
        <TextField type="email" label="Correo" required maxLength={150} error={errors.correo?.message}
          {...register('correo', { required: 'Obligatorio', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Correo no válido' } })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Perfil técnico" required {...register('perfil_tecnico')}>
            {PERFILES_TECNICOS.map((p) => <option key={p}>{p}</option>)}
          </SelectField>
          <TextField type="number" step="0.5" label="Capacidad (h/semana)" required error={errors.capacidad_horas_semanales?.message}
            {...register('capacidad_horas_semanales', {
              required: 'Obligatorio',
              validate: (v) => (Number(v) >= 0 && Number(v) <= 999) || 'Debe estar entre 0 y 999',
            })} />
        </div>
        <SelectField label="Área" required error={errors.id_area?.message}
          hint={areas.data?.length === 0 ? 'Primero crea un área en Organización.' : undefined}
          {...register('id_area', { required: 'Obligatorio' })}>
          <option value="">Selecciona un área…</option>
          {areas.data?.map((a) => (
            <option key={a.id_area} value={a.id_area}>{empresaNombre.get(a.id_empresa) ?? ''} · {a.nombre_area}</option>
          ))}
        </SelectField>
        {editing && (
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" className="size-4 accent-[var(--brand)]" {...register('activo')} /> Usuario activo
          </label>
        )}
        <FormError error={mutation.error} />
      </form>
    </Modal>
  )
}
