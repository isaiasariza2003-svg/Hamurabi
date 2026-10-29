import type { Editor } from '@tiptap/core'
import type { TagAttrs } from '../../core/tablets/types'

/**
 * Recorre todas las etiquetas del documento en una sola transacción (deshacer en un paso).
 * `fn` devuelve los atributos nuevos, los mismos para no tocarla, o null para eliminarla.
 */
export function updateTags(editor: Editor, fn: (attrs: TagAttrs) => TagAttrs | null): void {
  const found: { pos: number; size: number; attrs: TagAttrs }[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'tag') found.push({ pos, size: node.nodeSize, attrs: node.attrs as TagAttrs })
  })
  const tr = editor.state.tr
  // De atrás hacia adelante para que borrar no desplace las posiciones pendientes.
  for (const { pos, size, attrs } of found.reverse()) {
    const next = fn(attrs)
    if (next === null) tr.delete(pos, pos + size)
    else if (next.key !== attrs.key || next.format !== attrs.format) tr.setNodeMarkup(pos, undefined, next)
  }
  if (tr.docChanged) editor.view.dispatch(tr)
}
