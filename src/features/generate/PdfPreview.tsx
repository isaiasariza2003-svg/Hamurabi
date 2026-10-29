import type { JSONContent } from '@tiptap/core'
import { useEffect, useState } from 'react'
import { buildPdfBlob } from '../../core/pdf/download'
import type { PageLayout } from '../../core/pdf/toPdfmake'

// Espera a que el usuario deje de escribir antes de regenerar el PDF.
const DEBOUNCE_MS = 300

/**
 * Vista previa que es el propio PDF: lo que se ve aquí es exactamente lo que se descarga,
 * con la misma paginación, fuentes e interlineado. `doc`, `layout` y `name` deben ser estables
 * (memorizados) o se regenerará en cada render.
 */
export function PdfPreview({ doc, layout, name }: { doc: JSONContent; layout: PageLayout; name: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setBusy(true)
    const timer = window.setTimeout(() => {
      buildPdfBlob(doc, layout, name)
        .then((blob) => {
          if (cancelled) return
          setUrl(URL.createObjectURL(blob))
          setError(null)
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo generar la vista previa')
        })
        .finally(() => {
          if (!cancelled) setBusy(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [doc, layout, name])

  // Libera cada PDF anterior al reemplazarlo y al salir de la página.
  useEffect(() => {
    if (!url) return
    return () => URL.revokeObjectURL(url)
  }, [url])

  return (
    <div className="pdf-preview-wrap">
      {busy && <span className="badge pdf-preview-status">Actualizando…</span>}
      {error && <p className="error">{error}</p>}
      {url && (
        <>
          <iframe className="pdf-preview" src={url} title="Vista previa del PDF" />
          {/* Algunos móviles no muestran PDF incrustados; el enlace siempre funciona. */}
          <p className="small muted">
            Si no ves la vista previa, <a href={url} target="_blank" rel="noreferrer">ábrela en otra pestaña</a>.
          </p>
        </>
      )}
    </div>
  )
}
