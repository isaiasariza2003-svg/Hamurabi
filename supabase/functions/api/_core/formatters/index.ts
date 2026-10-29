// Generado por scripts/sync-api-core.mjs a partir de src/core. No editar.
import { integerToWords } from './numberToWords.ts'

export type TagType = 'text' | 'number' | 'date' | 'select' | 'boolean'

export interface FormatOptions {
  /** Nombre de la moneda en singular/plural para "en letras", p. ej. peso/pesos */
  currencySingular?: string
  currencyPlural?: string
  currencySymbol?: string
  /** Separadores: por defecto es-formato "1.500,25" */
  thousandsSep?: string
  decimalSep?: string
  decimals?: number
  /** Para boolean: texto cuando es verdadero/falso */
  trueText?: string
  falseText?: string
}

export interface FormatDefinition {
  /** Sufijo que se escribe tras el punto: `clave.mayusculas`. '' es el formato por defecto (sin sufijo). */
  id: string
  label: string
}

const TEXT_FORMATS: FormatDefinition[] = [
  { id: '', label: 'Tal cual' },
  { id: 'mayusculas', label: 'MAYÚSCULAS' },
  { id: 'minusculas', label: 'minúsculas' },
  { id: 'titulo', label: 'Tipo Título' },
  { id: 'iniciales', label: 'Iniciales (J.P.)' },
]

export const FORMATS: Record<TagType, FormatDefinition[]> = {
  text: TEXT_FORMATS,
  number: [
    { id: '', label: 'Tal cual (1500)' },
    { id: 'miles', label: 'Con miles (1.500)' },
    { id: 'moneda', label: 'Moneda ($1.500,00)' },
    { id: 'letras', label: 'En letras (mil quinientos)' },
    { id: 'monedaLetras', label: 'Moneda en letras (mil quinientos pesos 00/100)' },
  ],
  date: [
    { id: '', label: 'dd/mm/aaaa' },
    { id: 'larga', label: 'Larga (28 de octubre de 2026)' },
    { id: 'diaSemana', label: 'Día de la semana' },
    { id: 'dia', label: 'Día en número (28)' },
    { id: 'diaLetras', label: 'Día en letras (veintiocho)' },
    { id: 'mesNumero', label: 'Mes en número (10)' },
    { id: 'mes', label: 'Mes en letras (octubre)' },
    { id: 'anio', label: 'Año en número (2026)' },
    { id: 'anioLetras', label: 'Año en letras (dos mil veintiséis)' },
  ],
  // Selección y sí/no producen texto, así que admiten los mismos formatos.
  select: TEXT_FORMATS,
  boolean: TEXT_FORMATS,
}

export function isValidFormat(type: TagType, formatId: string): boolean {
  return FORMATS[type].some((f) => f.id === formatId)
}

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const pad = (n: number) => String(n).padStart(2, '0')

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  if (!Number.isFinite(n)) throw new RangeError(`Número inválido: ${value}`)
  return n
}

function groupThousands(intPart: string, sep: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep)
}

function formatNumber(n: number, decimals: number, opts: FormatOptions): string {
  const fixed = Math.abs(n).toFixed(decimals)
  const [int, dec] = fixed.split('.')
  const sep = opts.thousandsSep ?? '.'
  const dsep = opts.decimalSep ?? ','
  const body = groupThousands(int, sep) + (dec ? dsep + dec : '')
  return n < 0 ? `-${body}` : body
}

function parseDate(value: unknown): Date {
  const s = String(value)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  // Se construye en hora local para evitar el desfase de zona horaria de new Date('YYYY-MM-DD')
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s)
  if (Number.isNaN(d.getTime())) throw new RangeError(`Fecha inválida: ${value}`)
  return d
}

function formatText(s: string, formatId: string): string {
  switch (formatId) {
    case 'mayusculas': return s.toLocaleUpperCase('es')
    case 'minusculas': return s.toLocaleLowerCase('es')
    case 'titulo':
      return s.toLocaleLowerCase('es').replace(/(^|\s)(\p{L})/gu, (_, sp, c) => sp + c.toLocaleUpperCase('es'))
    case 'iniciales':
      return s.split(/\s+/).filter(Boolean).map((w) => w[0].toLocaleUpperCase('es') + '.').join('')
    default: return s
  }
}

export function format(
  value: unknown,
  type: TagType,
  formatId = '',
  opts: FormatOptions = {},
): string {
  if (value === undefined || value === null || value === '') return ''

  switch (type) {
    case 'number': {
      const n = toNumber(value)
      const decimals = opts.decimals ?? 2
      switch (formatId) {
        case 'miles':
          return formatNumber(n, Number.isInteger(n) ? 0 : decimals, opts)
        case 'moneda':
          return `${n < 0 ? '-' : ''}${opts.currencySymbol ?? '$'}${formatNumber(Math.abs(n), decimals, opts)}`
        case 'letras': {
          const neg = n < 0
          const [i, d] = Math.abs(n).toFixed(decimals).split('.')
          let w = integerToWords(Number(i))
          if (d && Number(d) > 0) w += ` con ${integerToWords(Number(d))}`
          return neg ? `menos ${w}` : w
        }
        case 'monedaLetras': {
          const [i, d] = Math.abs(n).toFixed(2).split('.')
          const int = Number(i)
          const unit = int === 1 ? (opts.currencySingular ?? 'peso') : (opts.currencyPlural ?? 'pesos')
          // "un millón de pesos": con millones exactos se agrega "de"
          const de = int >= 1e6 && int % 1e6 === 0 ? ' de' : ''
          // "uno" se apocopa ante el sustantivo: "un peso", "veintiún pesos", "treinta y un pesos"
          const w = integerToWords(int).replace(/veintiuno$/, 'veintiún').replace(/\buno$/, 'un')
          return `${n < 0 ? 'menos ' : ''}${w}${de} ${unit} ${d}/100`
        }
        default: return String(value)
      }
    }
    case 'date': {
      const d = parseDate(value)
      switch (formatId) {
        case 'larga': return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`
        case 'diaSemana': return WEEKDAYS[d.getDay()]
        case 'dia': return String(d.getDate())
        case 'diaLetras': return integerToWords(d.getDate())
        case 'mesNumero': return String(d.getMonth() + 1)
        case 'mes': return MONTHS[d.getMonth()]
        case 'anio': return String(d.getFullYear())
        case 'anioLetras': return integerToWords(d.getFullYear())
        default: return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
      }
    }
    case 'boolean': {
      const text = value === true || value === 'true' ? (opts.trueText ?? 'Sí') : (opts.falseText ?? 'No')
      return formatText(text, formatId)
    }
    case 'text':
    case 'select':
    default:
      return formatText(String(value), formatId)
  }
}

export { integerToWords }
