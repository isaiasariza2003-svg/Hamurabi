import type { JSONContent } from '@tiptap/core'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { downloadPdf } from '../../core/pdf/download'
import type { PageLayout } from '../../core/pdf/toPdfmake'
import { applyValues } from '../../core/tablets/render'
import { getTablet } from '../../core/tablets/repository'
import type { FieldDef, Tablet } from '../../core/tablets/types'
import { PdfPreview } from './PdfPreview'

type Values = Record<string, unknown>

export function GeneratePage() {
  const { id = '' } = useParams()
  const [tablet, setTablet] = useState<Tablet | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTablet(id)
      .then(setTablet)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'No se pudo cargar la tablilla'))
  }, [id])

  if (error) return <main className="page"><p className="error">{error}</p></main>
  if (!tablet) return <main className="page"><p className="muted">Cargando…</p></main>
  return <Generator key={tablet.id} tablet={tablet} />
}

function Generator({ tablet }: { tablet: Tablet }) {
  const [values, setValues] = useState<Values>({})

  const resolved: JSONContent = useMemo(
    () => applyValues(tablet.content, tablet.fields, values),
    [tablet.content, tablet.fields, values],
  )

  // Estable entre renders: la vista previa se regenera solo cuando cambian los datos o la tablilla.
  const layout: PageLayout = useMemo(
    () => ({ pageSize: tablet.page_size, margins: tablet.margins }),
    [tablet.page_size, tablet.margins],
  )

  const set = (key: string, value: unknown) => setValues((prev) => ({ ...prev, [key]: value }))

  const [downloading, setDownloading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  const download = async () => {
    // Los booleanos sin marcar son un valor válido ("No"), no un campo vacío.
    const empty = tablet.fields.filter(
      (f) => f.type !== 'boolean' && (values[f.key] === undefined || values[f.key] === ''),
    )
    if (empty.length && !window.confirm(`Hay ${empty.length} campo(s) sin llenar. ¿Descargar de todos modos?`)) return
    setDownloading(true)
    setPdfError(null)
    try {
      await downloadPdf(resolved, layout, tablet.name)
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'No se pudo generar el PDF')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <main className="generate-page">
      <div className="editor-head">
        <Link to="/tablets" className="muted">
          ← Tablillas
        </Link>
        <h2>{tablet.name}</h2>
        <Link to={`/tablets/${tablet.id}`} className="button-link ghost">
          Editar plantilla
        </Link>
        <button onClick={() => void download()} disabled={downloading}>
          {downloading ? 'Generando…' : 'Descargar PDF'}
        </button>
      </div>
      {pdfError && <p className="error">{pdfError}</p>}

      <div className="generate-layout">
        <section className="card form-panel">
          <h3>Datos</h3>
          {tablet.fields.length === 0 && (
            <p className="muted">Esta tablilla no tiene etiquetas. Agrégalas en el editor.</p>
          )}
          {tablet.fields.map((f) => (
            <FieldInput key={f.key} field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} />
          ))}
        </section>

        <PdfPreview doc={resolved} layout={layout} name={tablet.name} />
      </div>
    </main>
  )
}

function FieldInput({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const id = `field-${field.key}`
  switch (field.type) {
    case 'number':
      return (
        <label htmlFor={id}>
          {field.label}
          <input
            id={id}
            type="number"
            step="any"
            value={(value as string | number | undefined) ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)}
          />
        </label>
      )
    case 'date':
      return (
        <label htmlFor={id}>
          {field.label}
          <input id={id} type="date" value={(value as string | undefined) ?? ''} onChange={(e) => onChange(e.target.value)} />
        </label>
      )
    case 'boolean':
      return (
        <label htmlFor={id} className="check">
          <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          {field.label}
        </label>
      )
    case 'select':
      return (
        <label htmlFor={id}>
          {field.label}
          <select id={id} value={(value as string | undefined) ?? ''} onChange={(e) => onChange(e.target.value)}>
            <option value="">—</option>
            {(field.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      )
    case 'text':
    default:
      if (field.options?.length) return <TextChoice id={id} field={field} value={value} onChange={onChange} />
      return (
        <label htmlFor={id}>
          {field.label}
          <input id={id} value={(value as string | undefined) ?? ''} onChange={(e) => onChange(e.target.value)} />
        </label>
      )
  }
}

const OTHER = '__otro__'

/** Texto con opciones predefinidas: se elige de la lista o, con «Otro…», se escribe libremente. */
function TextChoice({
  id,
  field,
  value,
  onChange,
}: {
  id: string
  field: FieldDef
  value: unknown
  onChange: (v: unknown) => void
}) {
  const text = (value as string | undefined) ?? ''
  const options = field.options ?? []
  const [custom, setCustom] = useState(() => text !== '' && !options.includes(text))
  return (
    <label htmlFor={id}>
      {field.label}
      <select
        id={id}
        value={custom ? OTHER : text}
        onChange={(e) => {
          const isOther = e.target.value === OTHER
          setCustom(isOther)
          onChange(isOther ? '' : e.target.value)
        }}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value={OTHER}>Otro…</option>
      </select>
      {custom && (
        <input value={text} onChange={(e) => onChange(e.target.value)} placeholder="Escribe el valor" autoFocus />
      )}
    </label>
  )
}
