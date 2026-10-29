import { format, type TagType } from '../../core/formatters'
import type { FieldDef } from '../../core/tablets/types'

export const TYPE_LABELS: Record<TagType, string> = {
  text: 'Texto',
  number: 'Número',
  date: 'Fecha',
  select: 'Selección',
  boolean: 'Sí / No',
}

const SAMPLES: Record<TagType, unknown> = {
  text: 'Juan Pérez',
  number: 1500.5,
  date: '2026-10-28',
  select: 'Opción',
  boolean: true,
}

/** Ejemplo de cómo se verá la etiqueta con un formato, para guiar al elegirlo. */
export function sampleOutput(field: FieldDef, formatId: string): string {
  const fromOptions = (field.type === 'select' || field.type === 'text') && field.options?.length
  const value = fromOptions ? field.options![0] : SAMPLES[field.type]
  try {
    return format(value, field.type, formatId, field.config)
  } catch {
    return ''
  }
}
