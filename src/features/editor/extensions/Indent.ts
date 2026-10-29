import { Extension, type CommandProps } from '@tiptap/core'

/** Niveles de sangría; cada uno mide 1,25 cm (INDENT_STEP en toPdfmake.ts). */
export const MAX_INDENT = 8
const STEP_CM = 1.25

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType
      outdent: () => ReturnType
      insertTab: () => ReturnType
    }
  }
}

const TYPES = ['paragraph', 'heading']

/** Sangría por párrafo y tecla Tab que inserta una tabulación (en listas, Tab sigue anidando). */
export const Indent = Extension.create({
  name: 'indent',
  // Menor que la prioridad por defecto (100): los atajos de tablas y listas (Tab, Mayús+Tab) van primero.
  priority: 50,

  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => Number(el.getAttribute('data-indent')) || 0,
            renderHTML: (attrs) =>
              attrs.indent
                ? { 'data-indent': attrs.indent, style: `margin-left: ${attrs.indent * STEP_CM}cm` }
                : {},
          },
        },
      },
    ]
  },

  addCommands() {
    const shift =
      (delta: number) =>
      () =>
      ({ tr, state }: CommandProps) => {
        let changed = false
        state.doc.nodesBetween(state.selection.from, state.selection.to, (node, pos) => {
          if (!TYPES.includes(node.type.name)) return true
          const indent = Math.min(MAX_INDENT, Math.max(0, (node.attrs.indent ?? 0) + delta))
          if (indent !== node.attrs.indent) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent })
            changed = true
          }
          return false
        })
        return changed
      }
    return {
      indent: shift(1),
      outdent: shift(-1),
      insertTab:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.insertText('\t')
          return true
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      // Fuera de tablas y listas (que tienen prioridad), inserta la tabulación.
      Tab: () => this.editor.commands.insertTab(),
      // Siempre devuelve true para que el foco no salga del editor.
      'Shift-Tab': () => {
        this.editor.commands.outdent()
        return true
      },
      'Mod-]': () => this.editor.commands.indent(),
      'Mod-[': () => this.editor.commands.outdent(),
    }
  },
})
