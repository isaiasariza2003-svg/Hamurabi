// Copia el núcleo compartido (formatos, render, PDF) a la Edge Function `api`.
// Deno exige extensiones en los imports y no resuelve paquetes de npm sin prefijo,
// así que se reescriben los imports relativos y los de tipos externos.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'src/core')
const out = join(root, 'supabase/functions/api/_core')

const FILES = [
  'formatters/index.ts',
  'formatters/numberToWords.ts',
  'tablets/types.ts',
  'tablets/render.ts',
  'tablets/legacy.ts',
  'pdf/toPdfmake.ts',
  'pdf/metrics.ts',
]
// Paquetes de los que solo se importan tipos: se sustituyen por equivalentes locales.
const EXTERNAL_TYPES = ['@tiptap/core', 'pdfmake/interfaces']
const HEADER = '// Generado por scripts/sync-api-core.mjs a partir de src/core. No editar.\n'

rmSync(out, { recursive: true, force: true })

for (const file of FILES) {
  const code = readFileSync(join(src, file), 'utf8').replace(/from '([^']+)'/g, (match, spec) => {
    if (EXTERNAL_TYPES.includes(spec)) {
      const rel = posix.relative(posix.dirname(file), '_external.ts')
      return `from '${rel.startsWith('.') ? rel : `./${rel}`}'`
    }
    if (!spec.startsWith('.')) throw new Error(`${file}: import no soportado en Deno: ${spec}`)
    const target = posix.join(posix.dirname(file), spec)
    const resolved = FILES.includes(`${target}.ts`) ? `${spec}.ts` : FILES.includes(`${target}/index.ts`) ? `${spec}/index.ts` : null
    if (!resolved) throw new Error(`${file}: ${spec} no está en la lista de archivos compartidos`)
    return `from '${resolved}'`
  })
  const dest = join(out, file)
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, HEADER + code)
}

writeFileSync(
  join(out, '_external.ts'),
  `${HEADER}// Tipos mínimos de TipTap y pdfmake: en el servidor solo se necesitan para que el código compile.
export interface JSONContent {
  type?: string
  attrs?: Record<string, any>
  content?: JSONContent[]
  marks?: { type: string; attrs?: Record<string, any> }[]
  text?: string
}
export type Alignment = 'left' | 'right' | 'center' | 'justify'
export type Decoration = 'underline' | 'lineThrough' | 'overline'
export type Content = any
export type ContentText = any
export type TDocumentDefinitions = any
`,
)

console.log(`Núcleo copiado a ${relative(root, out)}`)
