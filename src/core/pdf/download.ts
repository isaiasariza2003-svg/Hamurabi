import type { JSONContent } from '@tiptap/core'
import { createMeasurer, type StandardFontContainer, type TextMeasurer } from './metrics'
import { toPdfDefinition, type PageLayout } from './toPdfmake'

type PdfMake = typeof import('pdfmake/build/pdfmake')

let loading: Promise<{ pdfMake: PdfMake; measure: TextMeasurer }> | null = null

/** Carga pdfmake y las fuentes estándar solo cuando se descarga el primer PDF. */
function loadPdfMake(): Promise<{ pdfMake: PdfMake; measure: TextMeasurer }> {
  loading ??= (async () => {
    const [mod, times, helvetica, courier] = await Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/standard-fonts/Times'),
      import('pdfmake/build/standard-fonts/Helvetica'),
      import('pdfmake/build/standard-fonts/Courier'),
    ])
    // El build es UMD: según el bundler llega como default o como namespace.
    const pdfMake = ((mod as { default?: PdfMake }).default ?? mod) as PdfMake
    const containers = [times, helvetica, courier].map((f) => (f.default ?? f) as StandardFontContainer)
    for (const c of containers) pdfMake.addFontContainer(c as unknown as Parameters<PdfMake['addFontContainer']>[0])
    return { pdfMake, measure: createMeasurer(containers) }
  })()
  // Si falla la carga, permite reintentar en el siguiente click.
  loading.catch(() => {
    loading = null
  })
  return loading
}

export function pdfFileName(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
  return `${base || 'documento'}.pdf`
}

/** El mismo PDF que se descarga, como Blob. La vista previa de la página de generar lo muestra tal cual. */
export async function buildPdfBlob(doc: JSONContent, layout: PageLayout, name: string): Promise<Blob> {
  const { pdfMake, measure } = await loadPdfMake()
  return pdfMake.createPdf(toPdfDefinition(doc, layout, name, measure)).getBlob()
}

export async function downloadPdf(doc: JSONContent, layout: PageLayout, name: string): Promise<void> {
  const { pdfMake, measure } = await loadPdfMake()
  await pdfMake.createPdf(toPdfDefinition(doc, layout, name, measure)).download(pdfFileName(name))
}
