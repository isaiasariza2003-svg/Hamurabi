import { useState, type FormEvent } from 'react'
import { FORMATS, isValidFormat } from '../../core/formatters'
import { tagNotation } from '../../core/tablets/slug'
import type { FieldDef, TagAttrs } from '../../core/tablets/types'
import { sampleOutput } from './fieldSamples'

interface Props {
  fields: FieldDef[]
  initial: TagAttrs
  onSave: (attrs: TagAttrs) => void
  onRemove: () => void
  onCancel: () => void
}

/** Cambia qué etiqueta y qué formato muestra una aparición concreta en el texto. */
export function PlaceTagDialog({ fields, initial, onSave, onRemove, onCancel }: Props) {
  const [key, setKey] = useState(initial.key)
  const [format, setFormat] = useState(initial.format)
  const field = fields.find((f) => f.key === key)

  const changeKey = (next: string) => {
    setKey(next)
    const nextField = fields.find((f) => f.key === next)
    if (nextField && !isValidFormat(nextField.type, format)) setFormat('')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (field) onSave({ key, format })
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>
          Etiqueta <code>{tagNotation(key, format)}</code>
        </h3>

        <label>
          Etiqueta
          <select value={key} onChange={(e) => changeKey(e.target.value)}>
            {!field && <option value={key}>{key} (no existe)</option>}
            {fields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label} ({f.key})
              </option>
            ))}
          </select>
        </label>

        {field && (
          <label>
            Formato
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              {FORMATS[field.type].map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <span className="muted small">
              Ejemplo: <strong>{sampleOutput(field, format) || '—'}</strong>
            </span>
          </label>
        )}

        <div className="actions end">
          <button type="button" className="danger" onClick={onRemove}>
            Quitar del texto
          </button>
          <span className="spacer" />
          <button type="button" className="ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" disabled={!field}>
            Aplicar
          </button>
        </div>
      </form>
    </div>
  )
}
