import { InputRule, Node, mergeAttributes } from '@tiptap/core'
import { tagNotation } from '../../../core/tablets/slug'
import type { TagAttrs } from '../../../core/tablets/types'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tag: {
      insertTag: (attrs: TagAttrs) => ReturnType
    }
  }
}

export interface TagNodeOptions {
  /** Valida lo escrito como {{clave.formato}}. Sin validador (vista previa) no se convierte nada. */
  isValidTag: ((key: string, format: string) => boolean) | null
}

/**
 * Aparición de una etiqueta en el texto. Solo guarda qué etiqueta y con qué formato;
 * el tipo y la configuración viven en los campos de la tablilla.
 */
export const TagNode = Node.create<TagNodeOptions>({
  name: 'tag',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { isValidTag: null }
  },

  addAttributes() {
    return {
      key: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-key') ?? '',
        renderHTML: (attrs) => ({ 'data-key': attrs.key }),
      },
      format: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-format') ?? '',
        renderHTML: (attrs) => (attrs.format ? { 'data-format': attrs.format } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-key]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'tag-chip', 'data-tag': '' }),
      tagNotation(node.attrs.key, node.attrs.format),
    ]
  },

  addCommands() {
    return {
      insertTag:
        (attrs) =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs }).run(),
    }
  },

  addInputRules() {
    const isValid = this.options.isValidTag
    if (!isValid) return []
    return [
      new InputRule({
        find: /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)(?:\.([A-Za-z]+))?\s*\}\}$/,
        handler: ({ state, range, match }) => {
          const key = match[1]
          const format = match[2] ?? ''
          // Clave o formato desconocidos: se deja el texto tal cual.
          if (!isValid(key, format)) return null
          state.tr.replaceWith(range.from, range.to, this.type.create({ key, format }))
        },
      }),
    ]
  },
})
