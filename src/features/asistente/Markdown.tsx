import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * Markdown mínimo y seguro para las respuestas del asistente: párrafos, listas (con viñetas o numeradas), **negritas**,
 * *cursivas*, `código` y [enlaces](/ruta). Se arma con elementos de React (nunca HTML crudo); los enlaces internos
 * navegan dentro de la app y solo se aceptan externos https.
 */
export function Markdown({ texto, onEnlace }: { texto: string; onEnlace?: () => void }) {
  const bloques: ReactNode[] = []
  let lista: { ordenada: boolean; items: string[] } | null = null
  let parrafo: string[] = []

  const cerrarParrafo = () => {
    if (parrafo.length) bloques.push(<p key={bloques.length}>{enLinea(parrafo.join(' '), onEnlace)}</p>)
    parrafo = []
  }
  const cerrarLista = () => {
    if (!lista) return
    const Tag = lista.ordenada ? 'ol' : 'ul'
    bloques.push(
      <Tag key={bloques.length} className={lista.ordenada ? 'list-decimal space-y-1 pl-5' : 'list-disc space-y-1 pl-5'}>
        {lista.items.map((it, i) => <li key={i}>{enLinea(it, onEnlace)}</li>)}
      </Tag>,
    )
    lista = null
  }

  for (const cruda of texto.split('\n')) {
    const linea = cruda.trimEnd()
    const vineta = /^\s*[-*•]\s+(.*)$/.exec(linea)
    const numero = /^\s*\d+[.)]\s+(.*)$/.exec(linea)
    const titulo = /^#{1,4}\s+(.*)$/.exec(linea)
    if (vineta || numero) {
      cerrarParrafo()
      const ordenada = !!numero
      if (lista && lista.ordenada !== ordenada) cerrarLista()
      lista ??= { ordenada, items: [] }
      lista.items.push((vineta ?? numero)![1])
    } else if (titulo) {
      cerrarParrafo(); cerrarLista()
      bloques.push(<p key={bloques.length} className="font-semibold">{enLinea(titulo[1], onEnlace)}</p>)
    } else if (!linea.trim()) {
      cerrarParrafo(); cerrarLista()
    } else if (lista && /^\s{2,}/.test(cruda)) {
      // Continuación de un elemento de la lista.
      lista.items[lista.items.length - 1] += ` ${linea.trim()}`
    } else {
      cerrarLista()
      parrafo.push(linea.trim())
    }
  }
  cerrarParrafo(); cerrarLista()
  return <div className="space-y-2.5 text-sm leading-relaxed">{bloques}</div>
}

const PATRON = /(\[([^\]]+)\]\(([^)\s]+)\))|(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*\s][^*]*)\*)/g

function enLinea(texto: string, onEnlace?: () => void): ReactNode[] {
  const partes: ReactNode[] = []
  let ultimo = 0
  for (const m of texto.matchAll(PATRON)) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index))
    const k = partes.length
    if (m[1]) {
      const [etiqueta, url] = [m[2], m[3]]
      if (url.startsWith('/') && !url.startsWith('//')) {
        partes.push(<Link key={k} to={url} onClick={onEnlace} className="font-medium text-brand underline-offset-2 hover:underline">{etiqueta}</Link>)
      } else if (url.startsWith('https://')) {
        partes.push(<a key={k} href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline-offset-2 hover:underline">{etiqueta}</a>)
      } else {
        partes.push(<Fragment key={k}>{etiqueta}</Fragment>)
      }
    } else if (m[4]) partes.push(<strong key={k} className="font-semibold">{m[5]}</strong>)
    else if (m[6]) partes.push(<code key={k} className="rounded bg-surface-2 px-1 py-px text-[13px]">{m[7]}</code>)
    else if (m[8]) partes.push(<em key={k}>{m[9]}</em>)
    ultimo = m.index + m[0].length
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo))
  return partes
}
