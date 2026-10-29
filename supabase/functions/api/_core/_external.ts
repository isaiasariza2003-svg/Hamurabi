// Generado por scripts/sync-api-core.mjs a partir de src/core. No editar.
// Tipos mínimos de TipTap y pdfmake: en el servidor solo se necesitan para que el código compile.
export interface JSONContent {
  type?: string
  attrs?: Record<string, any>
  content?: JSONContent[]
  marks?: { type: string; attrs?: Record<string, any> }[]
  text?: string
}
export type Alignment = 'left' | 'right' | 'center' | 'justify'
export type Decoration = 'underline' | 'lineThrough' | 'overline'
export type Content = any
export type ContentText = any
export type TDocumentDefinitions = any
