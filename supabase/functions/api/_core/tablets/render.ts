// Generado por scripts/sync-api-core.mjs a partir de src/core. No editar.
import type { JSONContent } from '../_external.ts'
import { format } from '../formatters/index.ts'
import type { FieldDef, TagAttrs } from './types.ts'

type Values = Record<string, unknown>

/** Texto de una etiqueta con su valor. Vacía o inválida muestra el nombre entre corchetes. */
export function resolveTag(attrs: TagAttrs, field: FieldDef | undefined, values: Values): string {
  if (!field) return `[${attrs.key}]`
  try {
    return format(values[field.key], field.type, attrs.format, field.config) || `[${field.label || field.key}]`
  } catch {
    return `[${field.label || field.key}: valor inválido]`
  }
}

/** Sustituye cada etiqueta del documento por su texto formateado. No modifica el original. */
export function applyValues(doc: JSONContent, fields: FieldDef[], values: Values): JSONContent {
  const byKey = new Map(fields.map((f) => [f.key, f]))
  const transform = (node: JSONContent): JSONContent | JSONContent[] => {
    if (node.type === 'tag') {
      const attrs = node.attrs as TagAttrs | undefined
      if (!attrs?.key) return []
      // Conserva los marks (negrita, color…) aplicados sobre la etiqueta.
      return { type: 'text', text: resolveTag(attrs, byKey.get(attrs.key), values), marks: node.marks }
    }
    if (!node.content) return node
    return { ...node, content: node.content.flatMap(transform) }
  }
  return transform(doc) as JSONContent
}

/** Texto plano de un documento ya resuelto: un bloque por línea, listas con viñeta o número. */
export function toPlainText(doc: JSONContent): string {
  const inline = (node: JSONContent): string => {
    if (node.type === 'text') return node.text ?? ''
    if (node.type === 'hardBreak') return '\n'
    if (node.type === 'tag') return `[${(node.attrs as TagAttrs | undefined)?.key ?? ''}]`
    return (node.content ?? []).map(inline).join('')
  }
  const blocks = (node: JSONContent): string[] => {
    const children = node.content ?? []
    switch (node.type) {
      case 'paragraph':
      case 'heading':
      case 'codeBlock':
        return [inline(node)]
      case 'horizontalRule':
        return ['---']
      case 'bulletList':
      case 'orderedList': {
        const start = (node.attrs?.start as number | undefined) ?? 1
        return children.flatMap((item, i) => {
          const marker = node.type === 'bulletList' ? '- ' : `${start + i}. `
          const pad = ' '.repeat(marker.length)
          return blocks(item).map((line, j) => (j === 0 ? marker : pad) + line)
        })
      }
      case 'blockquote':
        return children.flatMap(blocks).map((line) => `> ${line}`)
      case 'table':
        // Una línea por fila, celdas separadas por tabulación.
        return children.map((row) => (row.content ?? []).map((cell) => blocks(cell).join(' ')).join('\t'))
      default:
        return children.flatMap(blocks)
    }
  }
  return blocks(doc).join('\n')
}
