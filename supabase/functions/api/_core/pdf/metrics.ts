// Generado por scripts/sync-api-core.mjs a partir de src/core. No editar.
import type { PdfFont } from './toPdfmake.ts'

// Sin dependencias de runtime: recibe los datos de fuentes ya cargados, en el navegador o en Deno.

/** Estructura de pdfmake/build/standard-fonts/*.js. */
export interface StandardFontContainer {
  standardFonts: { name: string; glyphNames: string; glyphWidths: number[]; kernPairs?: (number | number[])[] }[]
  fonts: Record<string, { normal: string; bold: string; italics: string; bolditalics: string }>
}

export interface TextStyle {
  font: PdfFont
  bold: boolean
  italics: boolean
  fontSize: number
}

/** Ancho en puntos de un texto, tal como lo medirá pdfmake. */
export type TextMeasurer = (text: string, style: TextStyle) => number

// Caracteres en el orden de `glyphNames` (codificación WinAnsi): ASCII imprimible, los extras de
// Windows-1252 y Latin-1 sin el guion blando. La ÿ va con los extras; la Ÿ no existe en estas fuentes.
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String.fromCharCode(from + i))
const GLYPH_CHARS = [
  ...range(0x20, 0x7e),
  ...'€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžÿ',
  ...range(0xa1, 0xac),
  ...range(0xae, 0xbf),
  ...range(0xc0, 0xfe),
]
const GLYPH_INDEX = new Map(GLYPH_CHARS.map((c, i) => [c, i]))
GLYPH_INDEX.set(' ', 0) // el espacio duro se dibuja con el glifo "space"

interface FontMetrics {
  widths: number[]
  /** Clave: izquierda * nº de glifos + derecha. */
  kerning: Map<number, number>
  glyphCount: number
}

/** `kernPairs` alterna un valor y la lista (con deltas acumulados) de pares que lo usan. */
function decodeKerning(pairs: (number | number[])[] = []): Map<number, number> {
  const kerning = new Map<number, number>()
  for (let i = 0; i < pairs.length; i += 2) {
    const value = pairs[i] as number
    let index = 0
    for (const delta of pairs[i + 1] as number[]) {
      index += delta
      kerning.set(index, value)
    }
  }
  return kerning
}

export function createMeasurer(containers: StandardFontContainer[]): TextMeasurer {
  const byName = new Map<string, FontMetrics>()
  const families = new Map<string, StandardFontContainer['fonts'][string]>()
  for (const container of containers) {
    for (const f of container.standardFonts) {
      byName.set(f.name, {
        widths: f.glyphWidths,
        kerning: decodeKerning(f.kernPairs),
        glyphCount: f.glyphNames.split(' ').length,
      })
    }
    for (const [family, variants] of Object.entries(container.fonts)) families.set(family, variants)
  }

  return (text, { font, bold, italics, fontSize }) => {
    const variants = families.get(font)
    const metrics = variants && byName.get(variants[bold ? (italics ? 'bolditalics' : 'bold') : italics ? 'italics' : 'normal'])
    if (!metrics) return text.length * fontSize * 0.5
    let units = 0
    // pdfmake mide palabra por palabra (cortando tras los espacios): no hay kerning entre palabras.
    for (const word of text.match(/\S*\s*/g) ?? []) {
      let prev = -1
      for (const ch of word) {
        const g = GLYPH_INDEX.get(ch)
        if (g === undefined) {
          prev = -1
          continue
        }
        units += metrics.widths[g] ?? 0
        if (prev >= 0) units += metrics.kerning.get(prev * metrics.glyphCount + g) ?? 0
        prev = g
      }
    }
    return (units / 1000) * fontSize
  }
}
