// Generado por scripts/sync-api-core.mjs a partir de src/core. No editar.
import type { JSONContent } from '../_external.ts'
import type { FormatOptions, TagType } from '../formatters/index.ts'
import { DEFAULT_MARGINS, type FieldDef, type Tablet } from './types.ts'

/**
 * Primeras tablillas: cada nodo de etiqueta guardaba su definición completa en `attrs.tag`
 * y los formatos tenían ids en inglés. Se convierten al cargar; se persisten al guardar.
 */
interface LegacyTag {
  key: string
  label: string
  type: TagType
  format: string
  options?: string[]
  config?: FormatOptions
}

const LEGACY_FORMATS: Record<string, string> = {
  raw: '',
  upper: 'mayusculas',
  lower: 'minusculas',
  title: 'titulo',
  initials: 'iniciales',
  thousands: 'miles',
  currency: 'moneda',
  words: 'letras',
  currencyWords: 'monedaLetras',
  short: '',
  long: 'larga',
  weekday: 'diaSemana',
  month: 'mes',
}

export function normalizeTablet(tablet: Tablet): Tablet {
  const fields = new Map<string, FieldDef>(tablet.fields.map((f) => [f.key, f]))

  const convert = (node: JSONContent): JSONContent => {
    const legacy = node.type === 'tag' ? (node.attrs?.tag as LegacyTag | undefined) : undefined
    if (legacy?.key) {
      const existing = fields.get(legacy.key)
      fields.set(legacy.key, {
        key: legacy.key,
        label: existing?.label ?? legacy.label,
        type: existing?.type ?? legacy.type,
        options: existing?.options ?? legacy.options,
        config: existing?.config ?? legacy.config,
      })
      return { ...node, attrs: { key: legacy.key, format: LEGACY_FORMATS[legacy.format] ?? legacy.format } }
    }
    return node.content ? { ...node, content: node.content.map(convert) } : node
  }

  return {
    ...tablet,
    margins: tablet.margins ?? DEFAULT_MARGINS,
    content: convert(tablet.content),
    fields: [...fields.values()],
  }
}
