import { Table as BaseTable, TableCell, TableHeader, TableRow, TableView } from '@tiptap/extension-table'
import type { Node as PmNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableBorders: {
      toggleTableBorders: () => ReturnType
    }
  }
}

/** Vista editable (con columnas redimensionables) que refleja si la tabla lleva bordes. */
class BorderedTableView extends TableView {
  constructor(node: PmNode, cellMinWidth: number, view: EditorView, HTMLAttributes?: Record<string, unknown>) {
    super(node, cellMinWidth, view, HTMLAttributes)
    // Cambiar atributos recrea la vista (TableView.update devuelve false), así que basta con fijarlo aquí.
    this.table.dataset.bordered = String(node.attrs.bordered !== false)
  }
}

/**
 * Tabla con bordes opcionales: sin bordes sirve para maquetar (p. ej. etiqueta y valor en columnas).
 * Los anchos de columna se guardan en píxeles CSS; como la hoja está a escala real, 1 px = 0,75 pt en el PDF.
 */
export const Table = BaseTable.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      bordered: {
        default: true,
        parseHTML: (el) => el.getAttribute('data-bordered') !== 'false',
        renderHTML: (attrs) => ({ 'data-bordered': String(attrs.bordered !== false) }),
      },
    }
  },

  addCommands() {
    return {
      ...this.parent?.(),
      toggleTableBorders:
        () =>
        ({ editor, commands }) =>
          commands.updateAttributes('table', { bordered: editor.getAttributes('table').bordered === false }),
    }
  },
}).configure({ resizable: true, View: BorderedTableView })

export const tableExtensions = [Table, TableRow, TableHeader, TableCell]
