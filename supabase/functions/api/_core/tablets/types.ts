// Generado por scripts/sync-api-core.mjs a partir de src/core. No editar.
import type { JSONContent } from '../_external.ts'
import type { FormatOptions, TagType } from '../formatters/index.ts'

export type PageSize = 'letter' | 'legal'

/** Márgenes de la hoja en centímetros. */
export interface Margins {
  top: number
  right: number
  bottom: number
  left: number
}

/** 1 pulgada, el margen "Normal" de los procesadores de texto. */
export const DEFAULT_MARGINS: Margins = { top: 2.54, right: 2.54, bottom: 2.54, left: 2.54 }

/**
 * Etiqueta definida en la tablilla. Es la fuente de verdad del tipo y la configuración;
 * el usuario la llena una sola vez al generar, aunque aparezca varias veces en el texto.
 */
export interface FieldDef {
  key: string
  label: string
  type: TagType
  /** Opciones para type 'select'. */
  options?: string[]
  config?: FormatOptions
}

/** Atributos del nodo de etiqueta en el texto: qué etiqueta y con qué formato se muestra. */
export interface TagAttrs {
  key: string
  /** Sufijo de formato ('' = por defecto). Se muestra como `clave.formato`. */
  format: string
}

export interface Profile {
  id: string
  role: 'admin' | 'client'
  status: 'active' | 'suspended'
  display_name: string | null
}

export interface Tablet {
  id: string
  owner_id: string
  name: string
  page_size: PageSize
  margins: Margins
  content: JSONContent
  fields: FieldDef[]
  created_at: string
  updated_at: string
}
