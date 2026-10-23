import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useCrearEtiqueta } from '@/api/hooks'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { FormError } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import type { DepartamentoProyecto } from '@/types/api'
import { COLORES_ETIQUETA } from './Etiquetas'

/** Crea una etiqueta en el catálogo del departamento sin salir del formulario y la deja seleccionada.
 * No usa <form>: vive dentro del formulario del proyecto, así que Enter se intercepta aquí. */
export function NuevaEtiqueta({ departamentos, sugerido, onCreada }: {
  departamentos: DepartamentoProyecto[]; sugerido: number; onCreada: (id: number) => void
}) {
  const toast = useToast()
  const crear = useCrearEtiqueta()
  const [abierta, setAbierta] = useState(false)
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState(COLORES_ETIQUETA[sugerido % COLORES_ETIQUETA.length])
  const [elegido, setElegido] = useState<DepartamentoProyecto>(departamentos[0])
  const departamento = departamentos.includes(elegido) ? elegido : departamentos[0]

  const cerrar = () => { setAbierta(false); setNombre(''); crear.reset() }
  const guardar = () => {
    if (!nombre.trim()) return
    crear.mutate({ departamento, nombre: nombre.trim(), color }, {
      onSuccess: (e) => {
        toast.success(`Etiqueta “${e.nombre}” creada en ${e.departamento}`)
        onCreada(e.id_etiqueta)
        setColor(COLORES_ETIQUETA[(sugerido + 1) % COLORES_ETIQUETA.length])
        cerrar()
      },
    })
  }

  if (!abierta) {
    return (
      <button type="button" onClick={() => setAbierta(true)}
        className="mt-2 inline-flex items-center gap-1 rounded-full border border-dashed border-border-strong px-2.5 py-1 text-xs font-medium text-muted hover:text-fg">
        <Plus className="size-3" aria-hidden />Nueva etiqueta
      </button>
    )
  }
  return (
    <div className="mt-2 rounded-lg border border-border bg-surface-2/40 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <TextField fieldClassName="min-w-40 flex-1" label="Nueva etiqueta" maxLength={60} value={nombre} autoFocus
          placeholder="p. ej. Redes" onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); guardar() }
            if (e.key === 'Escape') { e.stopPropagation(); cerrar() }
          }} />
        {departamentos.length > 1 && (
          <SelectField fieldClassName="w-48" label="Departamento" value={departamento}
            onChange={(e) => setElegido(e.target.value as DepartamentoProyecto)}>
            {departamentos.map((d) => <option key={d}>{d}</option>)}
          </SelectField>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-fg">Color</span>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
            className="h-10 w-12 cursor-pointer rounded-lg border border-border-strong bg-surface p-1" />
        </label>
        <Button variant="primary" loading={crear.isPending} disabled={!nombre.trim()} onClick={guardar}>Crear</Button>
        <Button variant="ghost" onClick={cerrar}>Cancelar</Button>
      </div>
      <p className="mt-1.5 text-xs text-muted">
        Se agrega al catálogo de {departamento} y queda disponible para sus demás proyectos.
      </p>
      <FormError error={crear.error} />
    </div>
  )
}
