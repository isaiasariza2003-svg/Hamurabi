// Generado por scripts/sync-api-core.mjs a partir de src/core. No editar.
const UNITS = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
  'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
]
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const HUNDREDS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos',
]

function below1000(n: number): string {
  if (n === 100) return 'cien'
  const h = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (h) parts.push(HUNDREDS[h])
  if (rest) {
    if (rest < 30) parts.push(UNITS[rest])
    else {
      const t = Math.floor(rest / 10)
      const u = rest % 10
      parts.push(u ? `${TENS[t]} y ${UNITS[u]}` : TENS[t])
    }
  }
  return parts.join(' ')
}

/** Convierte un entero no negativo (< 10^15) a palabras en español. */
export function integerToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n >= 1e15) throw new RangeError(`Fuera de rango: ${n}`)
  if (n === 0) return UNITS[0]

  const groups: { value: number; scale: number }[] = []
  let rest = n
  let scale = 0
  while (rest > 0) {
    groups.unshift({ value: rest % 1000, scale })
    rest = Math.floor(rest / 1000)
    scale++
  }

  const out: string[] = []
  for (const { value, scale } of groups) {
    if (value === 0) continue
    if (scale === 0) out.push(below1000(value))
    else if (scale === 1) out.push(value === 1 ? 'mil' : `${below1000(value)} mil`)
    else {
      // millón (10^6), billón (10^12)
      const name = scale === 2 ? 'millón' : 'billón'
      const plural = scale === 2 ? 'millones' : 'billones'
      out.push(value === 1 ? `un ${name}` : `${below1000(value)} ${plural}`)
    }
  }
  return out
    .join(' ')
    // "uno" apocopado ante sustantivo: "veintiuno mil" -> "veintiún mil", "uno mil" -> "un mil"
    .replace(/\b(veinti)uno (mil|millones|billones)\b/g, '$1ún $2')
    .replace(/\buno (mil|millones|billones)\b/g, 'un $1')
}
