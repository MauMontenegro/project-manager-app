import { useId, useState } from 'react'
import { useCambiarEstado, useEtapas } from '@/api/hooks'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { FormError } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { num, todayISO } from '@/lib/format'
import { ESTADOS_FINALES, type EstadoProyecto, type ProyectoDetalle } from '@/types/api'

export function CambiarEstadoModal({ proyecto, onClose }: { proyecto: ProyectoDetalle; onClose: () => void }) {
  const formId = useId()
  const toast = useToast()
  const mutation = useCambiarEstado(proyecto.id_proyecto)
  // Las etapas (y los estatus que admite cada una) son las del proyecto, copiadas de su departamento.
  const etapas = useEtapas(proyecto.id_proyecto).data ?? []
  const actual = etapas.findIndex((e) => e.nombre_etapa === proyecto.etapa_actual)

  const [etapa, setEtapa] = useState(proyecto.etapa_actual ?? '')
  const [estado, setEstado] = useState<EstadoProyecto>(proyecto.estado_proyecto)
  const [fecha, setFecha] = useState(todayISO())

  const destino = etapas.find((e) => e.nombre_etapa === etapa)
  // Se avanza a la siguiente etapa o se regresa a cualquier anterior (retrabajo).
  const opciones = etapas.slice(0, actual + 2)
  const completado = estado === 'Completado'

  const cambiarEtapa = (nombre: string) => {
    const permitidos = etapas.find((e) => e.nombre_etapa === nombre)?.estados_permitidos ?? []
    setEtapa(nombre)
    setEstado(nombre === proyecto.etapa_actual ? proyecto.estado_proyecto : permitidos.includes('Activo') ? 'Activo' : permitidos[0])
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(
      {
        etapa_actual: etapa, estado_proyecto: estado,
        ...(completado && fecha ? { fecha_real_cierre: fecha } : {}),
      },
      { onSuccess: () => { toast.success(`Proyecto en “${etapa}” · ${estado}`); onClose() } },
    )
  }

  return (
    <Modal open onClose={onClose} title="Actualizar ciclo del proyecto"
      description="El proyecto avanza solo al finalizar las tareas de su etapa. Úsalo para regresar a una etapa, avanzar sin tareas o cambiar el estatus."
      footer={<>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button variant={estado === 'Cancelado' ? 'danger' : 'primary'} type="submit" form={formId} loading={mutation.isPending}>Guardar</Button>
      </>}>
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        <SelectField key={etapas.length} label="Etapa" required value={etapa} onChange={(e) => cambiarEtapa(e.target.value)}
          hint={destino?.descripcion ?? undefined}>
          {opciones.map((m, i) => (
            <option key={m.id_etapa} value={m.nombre_etapa}>
              {i + 1}. {m.nombre_etapa}{i === actual ? ' (actual)' : i < actual ? ' (regresar)' : ''}
            </option>
          ))}
        </SelectField>
        <SelectField label="Estatus" required value={estado} onChange={(e) => setEstado(e.target.value as EstadoProyecto)}
          hint={`Avance actual: ${Math.round(num(proyecto.porcentaje_avance))} %. Se recalcula con las tareas.`}>
          {destino?.estados_permitidos.map((s) => <option key={s}>{s}</option>)}
        </SelectField>
        {completado && (
          <TextField type="date" label="Fecha real de cierre" value={fecha} onChange={(e) => setFecha(e.target.value)}
            hint="Si la dejas vacía se usará la fecha de hoy." />
        )}
        {ESTADOS_FINALES.includes(estado) && (
          <p className="text-sm text-muted"><strong className="text-fg">Esta acción es definitiva:</strong> un proyecto “{estado}” ya no admite cambios de ciclo ni nuevas asignaciones.</p>
        )}
        <FormError error={mutation.error} />
      </form>
    </Modal>
  )
}
