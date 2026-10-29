import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { normalizeTablet } from './legacy'
import { applyValues, toPlainText } from './render'
import { isValidKey, slugifyKey, tagNotation } from './slug'
import { DEFAULT_MARGINS, type FieldDef, type Tablet } from './types'

const tag = (key: string, format = ''): JSONContent => ({ type: 'tag', attrs: { key, format } })
const para = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content })
const text = (t: string): JSONContent => ({ type: 'text', text: t })

const fields: FieldDef[] = [
  { key: 'nombre', label: 'Nombre', type: 'text' },
  { key: 'monto', label: 'Monto', type: 'number', config: { currencySingular: 'peso', currencyPlural: 'pesos' } },
]

// Una misma etiqueta con varios formatos: "monto" en cifra y en letras, "nombre" tal cual y en mayúsculas.
const doc: JSONContent = {
  type: 'doc',
  content: [
    para(text('Yo, '), tag('nombre'), text(' ('), tag('nombre', 'mayusculas'), text('), pagaré ')),
    para(tag('monto', 'moneda'), text(' / '), tag('monto', 'monedaLetras')),
  ],
}

const allText = (d: JSONContent) => JSON.stringify(d)

describe('applyValues', () => {
  it('una etiqueta adopta distintos formatos según cada aparición', () => {
    const out = allText(applyValues(doc, fields, { nombre: 'Juan', monto: 1500 }))
    expect(out).toContain('"text":"Juan"')
    expect(out).toContain('"text":"JUAN"')
    expect(out).toContain('$1.500,00')
    expect(out).toContain('mil quinientos pesos 00/100')
    expect(out).not.toContain('"type":"tag"')
  })

  it('muestra el nombre entre corchetes cuando no hay valor', () => {
    expect(allText(applyValues(doc, fields, {}))).toContain('[Nombre]')
  })

  it('valor inválido no rompe la vista previa', () => {
    expect(allText(applyValues(doc, fields, { monto: 'abc' }))).toContain('[Monto: valor inválido]')
  })

  it('etiqueta sin definición muestra su clave', () => {
    expect(allText(applyValues({ type: 'doc', content: [para(tag('borrada'))] }, fields, {}))).toContain('[borrada]')
  })

  it('conserva los marks aplicados sobre la etiqueta', () => {
    const bold: JSONContent = { type: 'doc', content: [para({ ...tag('nombre'), marks: [{ type: 'bold' }] })] }
    const out = applyValues(bold, fields, { nombre: 'Ana' })
    expect(out.content?.[0].content?.[0]).toEqual({ type: 'text', text: 'Ana', marks: [{ type: 'bold' }] })
  })

  it('no modifica el documento original', () => {
    const copy = JSON.stringify(doc)
    applyValues(doc, fields, { nombre: 'x', monto: 1 })
    expect(JSON.stringify(doc)).toBe(copy)
  })
})

describe('normalizeTablet', () => {
  const base: Tablet = {
    id: '1',
    owner_id: 'u',
    name: 'vieja',
    page_size: 'letter',
    margins: undefined as unknown as Tablet['margins'],
    content: {
      type: 'doc',
      content: [
        para({
          type: 'tag',
          attrs: {
            tag: { key: 'monto', label: 'Monto', type: 'number', format: 'currencyWords', config: { decimals: 2 } },
          },
        }),
      ],
    },
    fields: [{ key: 'monto', label: 'Monto', type: 'number' }],
    created_at: '',
    updated_at: '',
  }

  it('convierte etiquetas antiguas al nuevo modelo', () => {
    const t = normalizeTablet(base)
    expect(t.content.content?.[0].content?.[0].attrs).toEqual({ key: 'monto', format: 'monedaLetras' })
    expect(t.fields).toEqual([
      { key: 'monto', label: 'Monto', type: 'number', options: undefined, config: { decimals: 2 } },
    ])
    expect(t.margins).toEqual(DEFAULT_MARGINS)
  })

  it('deja intactas las tablillas nuevas', () => {
    const fresh: Tablet = { ...base, margins: DEFAULT_MARGINS, content: doc, fields }
    expect(normalizeTablet(fresh)).toEqual(fresh)
  })
})

describe('claves', () => {
  it('slugifyKey genera camelCase', () => {
    expect(slugifyKey('Fecha de inicio')).toBe('fechaDeInicio')
    expect(slugifyKey('  Monto (MXN) ')).toBe('montoMXN')
    expect(slugifyKey('Año')).toBe('ano')
    expect(slugifyKey('1er pago')).toBe('_1erPago')
  })

  it('isValidKey', () => {
    expect(isValidKey('etiquetaPrueba')).toBe(true)
    expect(isValidKey('mi_clave2')).toBe(true)
    expect(isValidKey('2clave')).toBe(false)
    expect(isValidKey('con espacio')).toBe(false)
    expect(isValidKey('año')).toBe(false)
  })

  it('tagNotation', () => {
    expect(tagNotation('etiquetaPrueba', 'mayusculas')).toBe('etiquetaPrueba.mayusculas')
    expect(tagNotation('etiquetaPrueba', '')).toBe('etiquetaPrueba')
  })
})

describe('toPlainText', () => {
  it('une bloques por línea y resuelve listas, citas y saltos', () => {
    const out = toPlainText({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [text('Título')] },
        para(text('Uno'), { type: 'hardBreak' }, text('dos')),
        {
          type: 'orderedList',
          attrs: { start: 3 },
          content: [
            { type: 'listItem', content: [para(text('a'))] },
            { type: 'listItem', content: [para(text('b')), para(text('c'))] },
          ],
        },
        { type: 'bulletList', content: [{ type: 'listItem', content: [para(text('x'))] }] },
        { type: 'blockquote', content: [para(text('cita'))] },
        para(),
        para(tag('sinValor')),
      ],
    })
    expect(out).toBe('Título\nUno\ndos\n3. a\n4. b\n   c\n- x\n> cita\n\n[sinValor]')
  })

  it('combina con applyValues', () => {
    const resolved = applyValues({ type: 'doc', content: [para(text('Hola '), tag('nombre', 'mayusculas'))] }, fields, {
      nombre: 'Juan',
    })
    expect(toPlainText(resolved)).toBe('Hola JUAN')
  })
})

describe('toPlainText con tablas', () => {
  it('una línea por fila y celdas separadas por tabulación', () => {
    const cell = (t: string): JSONContent => ({ type: 'tableCell', content: [para(text(t))] })
    const table: JSONContent = {
      type: 'table',
      content: [
        { type: 'tableRow', content: [cell('a'), cell('b')] },
        { type: 'tableRow', content: [cell('c'), cell('d')] },
      ],
    }
    expect(toPlainText({ type: 'doc', content: [table] })).toBe('a\tb\nc\td')
  })
})
