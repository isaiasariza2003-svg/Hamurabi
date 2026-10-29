import type { JSONContent } from '@tiptap/core'
import type { ContentText } from 'pdfmake/interfaces'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { pdfFileName } from './download'
import { DEFAULT_MARGINS } from '../tablets/types'
import { createMeasurer, type StandardFontContainer } from './metrics'
import { INDENT_STEP, mapFont, parseFontSize, TAB_STOP, toPdfDefinition, type PageLayout } from './toPdfmake'

const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })
const letter: PageLayout = { pageSize: 'letter', margins: DEFAULT_MARGINS }

describe('mapFont', () => {
  it.each([
    ['Times New Roman', 'Times'],
    ['"Georgia", serif', 'Times'],
    ['Arial', 'Helvetica'],
    ['Calibri', 'Helvetica'],
    ['Verdana', 'Helvetica'],
    ['Courier New', 'Courier'],
    ['Open Sans', 'Helvetica'],
  ])('%s -> %s', (family, expected) => {
    expect(mapFont(family)).toBe(expected)
  })

  it('sin fuente devuelve undefined', () => {
    expect(mapFont(null)).toBeUndefined()
  })
})

describe('parseFontSize', () => {
  it('convierte pt y px a puntos', () => {
    expect(parseFontSize('14pt')).toBe(14)
    expect(parseFontSize('16px')).toBe(12)
    expect(parseFontSize('abc')).toBeUndefined()
  })
})

describe('toPdfDefinition', () => {
  it('usa el tamaño de hoja y márgenes de 1 in por defecto', () => {
    expect(toPdfDefinition(doc(), letter).pageSize).toBe('LETTER')
    const legal = toPdfDefinition(doc(), { pageSize: 'legal', margins: DEFAULT_MARGINS })
    expect(legal.pageSize).toBe('LEGAL')
    expect(legal.pageMargins).toEqual([72, 72, 72, 72])
  })

  it('convierte márgenes en cm a puntos en el orden de pdfmake', () => {
    const def = toPdfDefinition(doc({ type: 'horizontalRule' }), {
      pageSize: 'letter',
      margins: { top: 1.27, right: 2.54, bottom: 5.08, left: 0 },
    })
    // [izquierda, arriba, derecha, abajo]
    expect(def.pageMargins).toEqual([0, 36, 72, 144])
    // La línea horizontal ocupa el ancho útil: 612 - 0 - 72.
    const [hr] = def.content as unknown as [{ canvas: { x2: number }[] }]
    expect(hr.canvas[0].x2).toBe(540)
  })

  it('convierte marks de texto y alineación', () => {
    const def = toPdfDefinition(
      doc({
        type: 'paragraph',
        attrs: { textAlign: 'justify' },
        content: [
          {
            type: 'text',
            text: 'Hola',
            marks: [
              { type: 'bold' },
              { type: 'underline' },
              { type: 'strike' },
              { type: 'textStyle', attrs: { color: '#ff0000', fontFamily: 'Arial', fontSize: '16pt' } },
            ],
          },
          { type: 'hardBreak' },
          { type: 'text', text: 'mundo', marks: [{ type: 'italic' }] },
        ],
      }),
      letter,
    )
    const [p] = def.content as ContentText[]
    expect(p.alignment).toBe('justify')
    const [hola, br, mundo] = p.text as ContentText[]
    expect(hola).toEqual({
      text: 'Hola',
      bold: true,
      decoration: ['underline', 'lineThrough'],
      color: '#ff0000',
      font: 'Helvetica',
      fontSize: 16,
    })
    expect(br).toBe('\n')
    expect(mundo).toEqual({ text: 'mundo', italics: true })
  })

  it('párrafo vacío conserva una línea y título usa su tamaño', () => {
    const def = toPdfDefinition(
      doc({ type: 'paragraph' }, { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'T' }] }),
      letter,
    )
    const [empty, heading] = def.content as ContentText[]
    expect(empty.text).toBe(' ')
    expect(heading).toMatchObject({ fontSize: 18, bold: true })
  })

  it('listas y etiquetas sin resolver', () => {
    const def = toPdfDefinition(
      doc(
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'uno' }] }] }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'tag', attrs: { key: 'monto', format: 'moneda' } }],
        },
      ),
      letter,
    )
    const [list, p] = def.content as [{ ul: ContentText[] }, ContentText]
    expect(list.ul).toHaveLength(1)
    expect((p.text as ContentText[])[0]).toEqual({ text: '[monto]' })
  })
})

describe('pdfFileName', () => {
  it('genera nombres de archivo seguros', () => {
    expect(pdfFileName('Contrato de arrendamiento')).toBe('Contrato_de_arrendamiento.pdf')
    expect(pdfFileName('Pagaré #1 / 2026')).toBe('Pagare_1_2026.pdf')
    expect(pdfFileName('***')).toBe('documento.pdf')
  })
})

describe('sangría, tabulaciones e imágenes', () => {
  const req = createRequire(import.meta.url)
  const measure = createMeasurer(
    ['Times', 'Helvetica', 'Courier'].map((f) => req(`pdfmake/build/standard-fonts/${f}.js`) as StandardFontContainer),
  )
  const t = (text: string, bold = false): JSONContent => ({ type: 'text', text, marks: bold ? [{ type: 'bold' }] : [] })
  const runsOf = (def: ReturnType<typeof toPdfDefinition>, i: number) =>
    ((def.content as ContentText[])[i].text as (ContentText | string)[]).map((r) =>
      typeof r === 'string' ? { text: r } : r,
    )

  /** Posición x (pt) donde empieza el run `index` según el medidor. */
  const xAt = (runs: ContentText[], index: number) =>
    runs.slice(0, index).reduce((x, r) => {
      const style = { font: 'Times' as const, bold: Boolean(r.bold), italics: false, fontSize: 12 }
      const text = String(r.text)
      return x + measure(text, style) + (r.characterSpacing ?? 0) * (text.length - 1)
    }, 0)

  it('alinea en la misma parada valores tras etiquetas de distinto largo', () => {
    // "ARRENDADOR:" (~85 pt) llega con una tabulación a la parada 3; "VIGENCIA:" (~58 pt) necesita dos.
    const def = toPdfDefinition(
      doc(
        { type: 'paragraph', content: [t('ARRENDADOR:', true), t('\tISAIAS DAVID', true)] },
        { type: 'paragraph', content: [t('VIGENCIA:', true), t('\t\tseis (6) meses')] },
      ),
      letter,
      undefined,
      measure,
    )
    const a = runsOf(def, 0)
    const b = runsOf(def, 1)
    const valueA = a.findIndex((r) => r.text === 'ISAIAS DAVID')
    const valueB = b.findIndex((r) => r.text === 'seis (6) meses')
    expect(xAt(a, valueA)).toBeCloseTo(xAt(b, valueB), 6)
    expect(xAt(a, valueA) / TAB_STOP).toBeCloseTo(Math.round(xAt(a, valueA) / TAB_STOP), 6)
    expect(a.some((r) => String(r.text).includes('\t'))).toBe(false)
  })

  it('la tabulación tras un salto de línea cuenta desde el margen', () => {
    const def = toPdfDefinition(
      doc({ type: 'paragraph', content: [t('VALOR:'), { type: 'hardBreak' }, t('\t$300.000')] }),
      letter,
      undefined,
      measure,
    )
    const runs = runsOf(def, 0)
    const value = runs.findIndex((r) => r.text === '$300.000')
    const lineStart = runs.findIndex((r) => r.text === '\n') + 1
    expect(xAt(runs.slice(lineStart), value - lineStart)).toBeCloseTo(TAB_STOP, 6)
  })

  it('sangría como margen izquierdo y espacios iniciales preservados', () => {
    const def = toPdfDefinition(doc({ type: 'paragraph', attrs: { indent: 2 }, content: [t('   hola')] }), letter)
    const p = (def.content as ContentText[])[0]
    expect(p.margin).toEqual([2 * INDENT_STEP, 0, 0, 6])
    expect(p.preserveLeadingSpaces).toBe(true)
  })

  it('imágenes con ancho relativo y alineación; descarta las externas', () => {
    const src = 'data:image/png;base64,iVBORw0KGgo='
    const def = toPdfDefinition(
      doc(
        { type: 'image', attrs: { src, width: 50, align: 'right' } },
        { type: 'image', attrs: { src: 'https://ejemplo.com/a.png', width: 50, align: 'left' } },
      ),
      letter,
    )
    expect(def.content).toEqual([{ image: src, width: 234, alignment: 'right', margin: [0, 0, 0, 6] }])
  })
})

describe('tablas', () => {
  const cell = (text: string, attrs: Record<string, unknown> = {}, type = 'tableCell'): JSONContent => ({
    type,
    attrs: { colspan: 1, rowspan: 1, colwidth: null, ...attrs },
    content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
  })
  const row = (...cells: JSONContent[]): JSONContent => ({ type: 'tableRow', content: cells })
  type PdfTable = {
    table: { widths: (number | string)[]; body: Record<string, unknown>[][] }
    layout: { hLineWidth: () => number }
  }

  it('cuadrícula completa con encabezado, colspan y rowspan', () => {
    const def = toPdfDefinition(
      doc({
        type: 'table',
        attrs: { bordered: true },
        content: [
          row(cell('Concepto', {}, 'tableHeader'), cell('Valor', {}, 'tableHeader'), cell('Nota', {}, 'tableHeader')),
          row(cell('Canon', { rowspan: 2 }), cell('$750.000', { colspan: 2 })),
          row(cell('$300.000'), cell('depósito')),
        ],
      }),
      letter,
    )
    const t = (def.content as unknown as PdfTable[])[0]
    expect(t.table.widths).toEqual(['*', '*', '*'])
    expect(t.table.body.map((r) => r.length)).toEqual([3, 3, 3])
    expect(t.table.body[0][0]).toMatchObject({ bold: true, fillColor: '#f2f2f2' })
    expect(t.table.body[1][0]).toMatchObject({ rowSpan: 2 })
    expect(t.table.body[1][1]).toMatchObject({ colSpan: 2 })
    expect(t.table.body[1][2]).toEqual({})
    // La fila 3 empieza en la columna 2: la 1 está ocupada por el rowspan.
    expect(t.table.body[2][0]).toEqual({})
    expect(JSON.stringify(t.table.body[2][1])).toContain('$300.000')
    expect(t.layout.hLineWidth()).toBe(0.75)
  })

  it('anchos fijos en pt (1 px = 0,75 pt) y sin bordes', () => {
    const def = toPdfDefinition(
      doc({
        type: 'table',
        attrs: { bordered: false },
        content: [row(cell('ARRENDADOR:', { colwidth: [200] }), cell('ISAIAS'))],
      }),
      letter,
    )
    const t = (def.content as unknown as PdfTable[])[0]
    expect(t.table.widths).toEqual([150, '*'])
    expect(t.layout.hLineWidth()).toBe(0)
  })

  it('escala columnas fijas que no caben en la hoja', () => {
    const def = toPdfDefinition(
      doc({ type: 'table', content: [row(cell('a', { colwidth: [600] }), cell('b', { colwidth: [600] }))] }),
      letter,
    )
    const [a, b] = (def.content as unknown as PdfTable[])[0].table.widths as number[]
    expect(a).toBeCloseTo(b)
    expect(a + b + 2 * 2 * 4.5 + 3 * 0.75).toBeCloseTo(468)
  })
})
