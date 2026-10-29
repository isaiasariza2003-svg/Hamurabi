// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import { afterEach, describe, expect, it } from 'vitest'
import { isValidFormat } from '../../core/formatters'
import type { FieldDef, TagAttrs } from '../../core/tablets/types'
import { createEditorExtensions } from './extensions'
import { updateTags } from './tagOps'

const fields: FieldDef[] = [
  { key: 'nombre', label: 'Nombre', type: 'text' },
  { key: 'monto', label: 'Monto', type: 'number' },
]

let editor: Editor | null = null
afterEach(() => editor?.destroy())

function makeEditor(content: object | string) {
  editor = new Editor({
    extensions: createEditorExtensions((key, format) => {
      const f = fields.find((x) => x.key === key)
      return Boolean(f) && isValidFormat(f!.type, format)
    }),
    content,
  })
  return editor
}

const tags = (e: Editor) => {
  const out: TagAttrs[] = []
  e.state.doc.descendants((n) => {
    if (n.type.name === 'tag') out.push({ key: n.attrs.key, format: n.attrs.format })
  })
  return out
}

/** Escribe texto carácter a carácter pasando por las reglas de entrada, como el teclado. */
function type(e: Editor, text: string) {
  for (const ch of text) {
    const { from, to } = e.state.selection
    const handled = e.view.someProp('handleTextInput', (f) => f(e.view, from, to, ch, () => e.state.tr.insertText(ch, from, to)))
    if (!handled) e.view.dispatch(e.state.tr.insertText(ch, from, to))
  }
}

describe('regla {{clave.formato}}', () => {
  it('convierte una clave con formato válido en etiqueta', () => {
    const e = makeEditor('<p></p>')
    type(e, 'Hola {{nombre.mayusculas}}')
    expect(tags(e)).toEqual([{ key: 'nombre', format: 'mayusculas' }])
    expect(e.getText()).toContain('Hola ')
    expect(e.getText()).not.toContain('{{')
  })

  it('convierte una clave sin formato', () => {
    const e = makeEditor('<p></p>')
    type(e, '{{monto}}')
    expect(tags(e)).toEqual([{ key: 'monto', format: '' }])
  })

  it('deja el texto si la clave no existe o el formato no aplica al tipo', () => {
    const e = makeEditor('<p></p>')
    type(e, '{{desconocida}} {{monto.mayusculas}}')
    expect(tags(e)).toEqual([])
    expect(e.getText()).toBe('{{desconocida}} {{monto.mayusculas}}')
  })
})

describe('updateTags', () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'tag', attrs: { key: 'nombre', format: '' } },
          { type: 'text', text: ' y ' },
          { type: 'tag', attrs: { key: 'nombre', format: 'mayusculas' } },
          { type: 'text', text: ' por ' },
          { type: 'tag', attrs: { key: 'monto', format: 'moneda' } },
        ],
      },
    ],
  }

  it('renombra la clave en todas las apariciones conservando el formato', () => {
    const e = makeEditor(doc)
    updateTags(e, (a) => (a.key === 'nombre' ? { ...a, key: 'cliente' } : a))
    expect(tags(e)).toEqual([
      { key: 'cliente', format: '' },
      { key: 'cliente', format: 'mayusculas' },
      { key: 'monto', format: 'moneda' },
    ])
  })

  it('elimina todas las apariciones de una clave', () => {
    const e = makeEditor(doc)
    updateTags(e, (a) => (a.key === 'nombre' ? null : a))
    expect(tags(e)).toEqual([{ key: 'monto', format: 'moneda' }])
    expect(e.getText()).toBe(' y  por ')
  })

  it('el cambio se deshace en un solo paso', () => {
    const e = makeEditor(doc)
    updateTags(e, (a) => (a.key === 'nombre' ? null : a))
    e.commands.undo()
    expect(tags(e)).toHaveLength(3)
  })
})

describe('tabulación, sangría e imágenes', () => {
  const pressKey = (e: Editor, key: string, shiftKey = false) => {
    const event = new KeyboardEvent('keydown', { key, shiftKey })
    return e.view.someProp('handleKeyDown', (f) => f(e.view, event))
  }

  it('Tab inserta una tabulación real fuera de las listas', () => {
    const e = makeEditor('<p>Nombre:</p>')
    e.commands.setTextSelection(8)
    expect(pressKey(e, 'Tab')).toBe(true)
    expect(e.state.doc.firstChild?.textContent).toBe('Nombre:\t')
  })

  it('sangría por niveles, entre 0 y el máximo', () => {
    const e = makeEditor('<p>uno</p><p>dos</p>')
    e.commands.setTextSelection(2)
    e.commands.indent()
    e.commands.indent()
    expect(e.getJSON().content?.[0].attrs?.indent).toBe(2)
    expect(e.getJSON().content?.[1].attrs?.indent).toBe(0)
    expect(e.getHTML()).toContain('margin-left: 2.5cm')
    pressKey(e, 'Tab', true)
    expect(e.getJSON().content?.[0].attrs?.indent).toBe(1)
    e.commands.outdent()
    expect(e.commands.outdent()).toBe(false)
  })

  it('imagen: se inserta, se guarda y se vuelve a leer desde HTML', () => {
    const src = 'data:image/png;base64,iVBORw0KGgo='
    const e = makeEditor('<p>a</p>')
    e.commands.insertImage({ src, width: 30, align: 'right' })
    const node = e.getJSON().content?.find((n) => n.type === 'image')
    expect(node?.attrs).toEqual({ src, width: 30, align: 'right' })
    const copy = makeEditor(e.getHTML())
    expect(copy.getJSON().content?.find((n) => n.type === 'image')?.attrs).toEqual({ src, width: 30, align: 'right' })
  })

  it('ignora imágenes externas al pegar HTML', () => {
    const e = makeEditor('<div data-image data-width="50"><img src="https://ejemplo.com/a.png"></div>')
    expect(e.getJSON().content?.some((n) => n.type === 'image')).toBe(false)
  })
})

describe('tablas en el editor', () => {
  const pressTab = (e: Editor) =>
    e.view.someProp('handleKeyDown', (f) => f(e.view, new KeyboardEvent('keydown', { key: 'Tab' })))

  it('inserta una tabla, alterna bordes y Tab pasa de celda en vez de tabular', () => {
    const e = makeEditor('<p></p>')
    e.chain().insertTable({ rows: 2, cols: 2 }).updateAttributes('table', { bordered: false }).run()
    expect(e.getAttributes('table').bordered).toBe(false)
    e.commands.toggleTableBorders()
    expect(e.getAttributes('table').bordered).toBe(true)

    const before = e.state.selection.from
    expect(pressTab(e)).toBe(true)
    expect(e.state.selection.from).toBeGreaterThan(before)
    expect(e.state.doc.textContent).not.toContain('\t')
  })

  it('conserva los bordes al guardar y recargar desde HTML', () => {
    const e = makeEditor('<p></p>')
    e.chain().insertTable({ rows: 1, cols: 2 }).updateAttributes('table', { bordered: false }).run()
    const copy = makeEditor(e.getHTML())
    expect(copy.getJSON().content?.find((n) => n.type === 'table')?.attrs?.bordered).toBe(false)
  })
})

describe('Tab en listas', () => {
  it('anida el elemento en vez de insertar una tabulación', () => {
    const e = makeEditor('<ul><li><p>uno</p></li><li><p>dos</p></li></ul>')
    e.commands.setTextSelection(e.state.doc.content.size - 3)
    e.view.someProp('handleKeyDown', (f) => f(e.view, new KeyboardEvent('keydown', { key: 'Tab' })))
    expect(e.state.doc.textContent).not.toContain('\t')
    expect(e.getHTML()).toMatch(/<li><p>uno<\/p><ul>/)
  })
})
