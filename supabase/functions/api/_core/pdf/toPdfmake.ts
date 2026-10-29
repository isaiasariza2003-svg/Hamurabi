// Generado por scripts/sync-api-core.mjs a partir de src/core. No editar.
import type { JSONContent } from '../_external.ts'
import type { Alignment, Content, ContentText, Decoration, TDocumentDefinitions } from '../_external.ts'
import type { Margins, PageSize, TagAttrs } from '../tablets/types.ts'
import type { TextMeasurer, TextStyle } from './metrics.ts'

// Sin dependencias de runtime: este módulo debe poder correr también en una Edge Function.

/** Fuentes estándar de PDF: no requieren incrustar archivos y cubren acentos y ñ. */
export type PdfFont = 'Times' | 'Helvetica' | 'Courier'

export interface PageLayout {
  pageSize: PageSize
  /** En centímetros, como se guardan en la tablilla. */
  margins: Margins
}

/** Medidas en puntos (1 in = 72 pt = 2.54 cm). Deben coincidir con `.sheet` en index.css. */
const PAGE_WIDTH = 612 // carta y oficio comparten el ancho de 8.5 in
export const cmToPt = (cm: number) => (cm * 72) / 2.54
export const BASE_FONT_SIZE = 12
const PARAGRAPH_GAP = 6
const HEADING_SIZES: Record<number, number> = { 1: 24, 2: 18, 3: 14 }
// pdfmake multiplica la altura natural de la fuente (~0.9 em en Times), no el tamaño como CSS:
// 1.5 × 0.9 ≈ 1.35 em, cercano al line-height: 1.4 de `.sheet`.
const LINE_HEIGHT = 1.5
/** Sangría por nivel y separación entre tabulaciones: 1,25 cm, como en `.sheet` (index.css). */
export const INDENT_STEP = cmToPt(1.25)
export const TAB_STOP = cmToPt(1.25)

interface Ctx {
  /** Ancho útil entre márgenes, en puntos. */
  width: number
  measure?: TextMeasurer
  /** Separación bajo cada párrafo; 0 dentro de celdas de tabla. */
  gap?: number
  /** Negrita heredada (celdas de encabezado), para medir bien las tabulaciones. */
  bold?: boolean
}

/** Relleno de celda y grosor de borde: deben coincidir con `.sheet td` en index.css (3pt 4.5pt, 1px). */
const CELL_PAD_X = 4.5
const CELL_PAD_Y = 3
const CELL_BORDER = 0.75
const HEADER_FILL = '#f2f2f2'

export function mapFont(family?: string | null): PdfFont | undefined {
  if (!family) return undefined
  const f = family.split(',')[0].replace(/["']/g, '').trim().toLowerCase()
  if (/courier|mono/.test(f)) return 'Courier'
  if (/times|georgia|garamond|serif/.test(f) && !/sans/.test(f)) return 'Times'
  return 'Helvetica'
}

/** "14pt" -> 14, "16px" -> 12. */
export function parseFontSize(size?: string | null): number | undefined {
  if (!size) return undefined
  const m = /^([\d.]+)\s*(pt|px)?$/.exec(size.trim())
  if (!m) return undefined
  const n = Number(m[1])
  return m[2] === 'px' ? n * 0.75 : n
}

function textRun(node: JSONContent): ContentText {
  const run: ContentText = { text: node.text ?? '' }
  const decorations: Decoration[] = []
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case 'bold':
        run.bold = true
        break
      case 'italic':
        run.italics = true
        break
      case 'underline':
        decorations.push('underline')
        break
      case 'strike':
        decorations.push('lineThrough')
        break
      case 'code':
        run.font = 'Courier'
        break
      case 'link':
        if (mark.attrs?.href) run.link = String(mark.attrs.href)
        break
      case 'textStyle': {
        const { color, fontFamily, fontSize } = mark.attrs ?? {}
        if (color) run.color = String(color)
        const font = mapFont(fontFamily)
        if (font) run.font = font
        const size = parseFontSize(fontSize)
        if (size) run.fontSize = size
        break
      }
    }
  }
  if (decorations.length) run.decoration = decorations.length === 1 ? decorations[0] : decorations
  return run
}

function inline(nodes: JSONContent[] = []): (ContentText | string)[] {
  const runs: (ContentText | string)[] = []
  for (const n of nodes) {
    if (n.type === 'text') runs.push(textRun(n))
    else if (n.type === 'hardBreak') runs.push('\n')
    else if (n.type === 'tag') {
      // Etiqueta sin resolver: se imprime su clave, igual que en la vista previa.
      const attrs = n.attrs as TagAttrs | undefined
      runs.push({ text: `[${attrs?.key ?? ''}]` })
    }
  }
  return runs
}

function alignment(node: JSONContent): Alignment | undefined {
  const a = node.attrs?.textAlign
  return a === 'left' || a === 'center' || a === 'right' || a === 'justify' ? a : undefined
}

/**
 * Sustituye cada tabulación por un hueco que llega a la siguiente parada (cada TAB_STOP desde el
 * inicio del párrafo), igual que `tab-size` en el editor. pdfmake no entiende tabulaciones, así que
 * el hueco son dos espacios duros con el espaciado justo. No contempla saltos de línea automáticos.
 */
function expandTabs(runs: (ContentText | string)[], base: TextStyle, measure: TextMeasurer): (ContentText | string)[] {
  const out: (ContentText | string)[] = []
  let x = 0
  for (const run of runs) {
    const r: ContentText = typeof run === 'string' ? { text: run } : run
    const style: TextStyle = {
      font: (r.font as PdfFont | undefined) ?? base.font,
      bold: r.bold ?? base.bold,
      italics: r.italics ?? base.italics,
      fontSize: r.fontSize ?? base.fontSize,
    }
    for (const part of String(r.text).split(/(\t|\n)/)) {
      if (part === '') continue
      if (part === '\t') {
        let next = (Math.floor(x / TAB_STOP + 1e-6) + 1) * TAB_STOP
        // Regla de CSS: si la parada queda a menos de medio "0", se salta a la siguiente.
        if (next - x < measure('0', style) / 2) next += TAB_STOP
        out.push({ ...r, text: '\u00a0\u00a0', characterSpacing: next - x - 2 * measure(' ', style) })
        x = next
      } else {
        out.push(typeof run === 'string' ? part : { ...r, text: part })
        x = part === '\n' ? 0 : x + measure(part, style)
      }
    }
  }
  return out
}

function hasTab(runs: (ContentText | string)[]): boolean {
  return runs.some((r) => String(typeof r === 'string' ? r : r.text).includes('\t'))
}

function paragraph(node: JSONContent, ctx: Ctx, extra: Partial<ContentText> = {}): ContentText {
  let runs = inline(node.content)
  if (hasTab(runs)) {
    if (ctx.measure) {
      const base = { font: 'Times' as const, bold: Boolean(extra.bold ?? ctx.bold), italics: false, fontSize: extra.fontSize ?? BASE_FONT_SIZE }
      runs = expandTabs(runs, base, ctx.measure)
    } else {
      runs = runs.map((r) =>
        typeof r === 'string' ? r : { ...r, text: String(r.text).replace(/\t/g, '\u00a0'.repeat(4)) },
      )
    }
  }
  const indent = Number(node.attrs?.indent ?? 0) * INDENT_STEP
  const p: ContentText = {
    // Un párrafo vacío conserva su altura de línea, como en el editor.
    text: runs.length ? runs : ' ',
    margin: [indent, 0, 0, ctx.gap ?? PARAGRAPH_GAP],
    // Los espacios al inicio de línea se respetan, como en el editor.
    preserveLeadingSpaces: true,
    ...extra,
  }
  const align = alignment(node)
  if (align) p.alignment = align
  return p
}

function plainText(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  return (node.content ?? []).map(plainText).join('')
}

function listItem(node: JSONContent, ctx: Ctx): Content {
  const children = blocks(node.content, ctx)
  return children.length === 1 ? children[0] : { stack: children }
}

/** Anchos de columna (px CSS en `colwidth`) de la primera fila, columna por columna. */
function columnWidthsPx(table: JSONContent, cols: number): (number | null)[] {
  const widths: (number | null)[] = Array(cols).fill(null)
  let col = 0
  for (const cell of table.content?.[0]?.content ?? []) {
    const span = Number(cell.attrs?.colspan ?? 1)
    const colwidth = cell.attrs?.colwidth as number[] | null | undefined
    for (let j = 0; j < span && col < cols; j++, col++) widths[col] = colwidth?.[j] || null
  }
  return widths
}

/**
 * Tabla de TipTap -> tabla de pdfmake. pdfmake necesita la cuadrícula completa: las posiciones
 * cubiertas por colspan/rowspan se rellenan con {}. Columnas con ancho fijo en pt (1 px = 0,75 pt);
 * el resto reparte el espacio libre. Si las fijas no caben, se escalan para no salirse de la hoja.
 */
function table(node: JSONContent, ctx: Ctx): Content {
  const rows = node.content ?? []
  const grid: (Content | null | undefined)[][] = rows.map(() => [])
  const placed: { row: number; col: number; cell: JSONContent; colspan: number; rowspan: number }[] = []
  rows.forEach((row, r) => {
    let c = 0
    for (const cell of row.content ?? []) {
      while (grid[r][c] !== undefined) c++
      const colspan = Math.max(1, Number(cell.attrs?.colspan ?? 1))
      const rowspan = Math.max(1, Math.min(rows.length - r, Number(cell.attrs?.rowspan ?? 1)))
      for (let i = 0; i < rowspan; i++) for (let j = 0; j < colspan; j++) grid[r + i][c + j] = null
      placed.push({ row: r, col: c, cell, colspan, rowspan })
      c += colspan
    }
  })
  const cols = Math.max(1, ...grid.map((row) => row.length))

  const fixed = columnWidthsPx(node, cols).map((w) => (w ? w * 0.75 : null))
  const available = ctx.width - cols * 2 * CELL_PAD_X - (cols + 1) * CELL_BORDER
  const fixedSum = fixed.reduce<number>((a, w) => a + (w ?? 0), 0)
  const autoCols = fixed.filter((w) => w === null).length
  const scale = fixedSum > available ? available / fixedSum : 1
  const autoWidth = autoCols ? Math.max(0, available - fixedSum * scale) / autoCols : 0
  const colWidths = fixed.map((w) => (w === null ? autoWidth : w * scale))

  for (const { row, col, cell, colspan, rowspan } of placed) {
    const header = cell.type === 'tableHeader'
    const cellWidth =
      colWidths.slice(col, col + colspan).reduce((a, w) => a + w, 0) + (colspan - 1) * (2 * CELL_PAD_X + CELL_BORDER)
    const content = blocks(cell.content, { ...ctx, width: cellWidth, gap: 0, bold: header || ctx.bold })
    const def: Record<string, unknown> = { stack: content.length ? content : [' '] }
    if (colspan > 1) def.colSpan = colspan
    if (rowspan > 1) def.rowSpan = rowspan
    if (header) Object.assign(def, { bold: true, fillColor: HEADER_FILL })
    grid[row][col] = def as unknown as Content
  }

  const line = () => (node.attrs?.bordered === false ? 0 : CELL_BORDER)
  return {
    table: {
      widths: fixed.map((w, i) => (w === null ? '*' : colWidths[i])),
      body: grid.map((row) => Array.from({ length: cols }, (_, c) => row[c] ?? {})),
      dontBreakRows: true,
    },
    layout: {
      hLineWidth: line,
      vLineWidth: line,
      hLineColor: () => '#000000',
      vLineColor: () => '#000000',
      paddingLeft: () => CELL_PAD_X,
      paddingRight: () => CELL_PAD_X,
      paddingTop: () => CELL_PAD_Y,
      paddingBottom: () => CELL_PAD_Y,
    },
    margin: [0, 0, 0, ctx.gap ?? PARAGRAPH_GAP],
  } as Content
}

function block(node: JSONContent, ctx: Ctx): Content | null {
  const { width } = ctx
  switch (node.type) {
    case 'paragraph':
      return paragraph(node, ctx)
    case 'heading': {
      const level = Number(node.attrs?.level ?? 1)
      return paragraph(node, ctx, { fontSize: HEADING_SIZES[level] ?? BASE_FONT_SIZE, bold: true })
    }
    case 'bulletList':
      return { ul: (node.content ?? []).map((li) => listItem(li, ctx)), margin: [0, 0, 0, PARAGRAPH_GAP] }
    case 'orderedList':
      return {
        ol: (node.content ?? []).map((li) => listItem(li, ctx)),
        start: Number(node.attrs?.start ?? 1),
        margin: [0, 0, 0, PARAGRAPH_GAP],
      }
    case 'blockquote':
      return { stack: blocks(node.content, { ...ctx, width: width - 24 }), margin: [24, 0, 0, PARAGRAPH_GAP] }
    case 'table':
      return table(node, ctx)
    case 'image': {
      const src = node.attrs?.src
      if (typeof src !== 'string' || !src.startsWith('data:image/')) return null
      const pct = Math.min(100, Math.max(5, Number(node.attrs?.width ?? 100)))
      const align = node.attrs?.align
      return {
        image: src,
        width: (width * pct) / 100,
        alignment: align === 'left' || align === 'right' ? align : 'center',
        margin: [0, 0, 0, PARAGRAPH_GAP],
      }
    }
    case 'codeBlock':
      return {
        text: plainText(node),
        font: 'Courier',
        fontSize: 10,
        preserveLeadingSpaces: true,
        margin: [0, 0, 0, PARAGRAPH_GAP],
      }
    case 'horizontalRule':
      return {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 0.5 }],
        margin: [0, PARAGRAPH_GAP, 0, PARAGRAPH_GAP],
      }
    default:
      return null
  }
}

function blocks(nodes: JSONContent[] = [], ctx: Ctx): Content[] {
  return nodes.map((n) => block(n, ctx)).filter((c): c is Content => c !== null)
}

/**
 * Convierte un documento TipTap (ya con valores aplicados) en una definición de pdfmake.
 * `measure` (ver metrics.ts) es necesario para alinear las tabulaciones; sin él, cada una son 4 espacios.
 */
export function toPdfDefinition(
  doc: JSONContent,
  layout: PageLayout,
  title?: string,
  measure?: TextMeasurer,
): TDocumentDefinitions {
  const { top, right, bottom, left } = layout.margins
  // pdfmake ordena los márgenes como [izquierda, arriba, derecha, abajo].
  const pageMargins: [number, number, number, number] = [cmToPt(left), cmToPt(top), cmToPt(right), cmToPt(bottom)]
  return {
    pageSize: layout.pageSize === 'legal' ? 'LEGAL' : 'LETTER',
    pageMargins,
    info: title ? { title } : undefined,
    defaultStyle: { font: 'Times', fontSize: BASE_FONT_SIZE, lineHeight: LINE_HEIGHT },
    content: blocks(doc.content, { width: PAGE_WIDTH - pageMargins[0] - pageMargins[2], measure }),
  }
}
