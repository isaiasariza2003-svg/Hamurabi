import { useState } from 'react'
import { FORMATS } from '../../core/formatters'
import { tagNotation } from '../../core/tablets/slug'
import type { FieldDef, TagAttrs } from '../../core/tablets/types'
import { sampleOutput, TYPE_LABELS } from './fieldSamples'

interface Props {
  fields: FieldDef[]
  /** Apariciones de cada clave en el texto. */
  uses: Record<string, number>
  onInsert: (attrs: TagAttrs) => void
  onNew: () => void
  onEdit: (field: FieldDef) => void
  onDelete: (field: FieldDef) => void
}

/** Administración de las etiquetas de la tablilla, sin buscarlas en el texto. */
export function FieldsPanel({ fields, uses, onInsert, onNew, onEdit, onDelete }: Props) {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <aside className="card fields-panel">
      <div className="fields-head">
        <h3>Etiquetas</h3>
        <button className="accent" onClick={onNew}>
          + Nueva
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="muted small">
          Crea una etiqueta y luego insértala en el texto con el formato que necesites.
        </p>
      ) : (
        <ul className="fields-list">
          {fields.map((f) => {
            const count = uses[f.key] ?? 0
            const expanded = open === f.key
            return (
              <li key={f.key} className={expanded ? 'open' : ''}>
                <button className="field-row" onClick={() => setOpen(expanded ? null : f.key)} aria-expanded={expanded}>
                  <span className="field-name">
                    <strong>{f.label}</strong>
                    <code>{f.key}</code>
                  </span>
                  <span className="field-meta">
                    <span className="badge">{TYPE_LABELS[f.type]}</span>
                    <span className={count ? 'muted small' : 'warn small'} title="Veces que aparece en el texto">
                      {count ? `${count}×` : 'sin usar'}
                    </span>
                  </span>
                </button>

                {expanded && (
                  <div className="field-body">
                    <span className="muted small">Insertar en el cursor con formato:</span>
                    <div className="format-chips">
                      {FORMATS[f.type].map((fmt) => (
                        <button
                          key={fmt.id}
                          className="format-chip"
                          title={`${fmt.label} → ${sampleOutput(f, fmt.id)}`}
                          onClick={() => onInsert({ key: f.key, format: fmt.id })}
                        >
                          <code>{tagNotation(f.key, fmt.id)}</code>
                          <span className="muted small">{sampleOutput(f, fmt.id)}</span>
                        </button>
                      ))}
                    </div>
                    <div className="actions">
                      <button className="ghost" onClick={() => onEdit(f)}>
                        Editar
                      </button>
                      <button className="danger" onClick={() => onDelete(f)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <p className="muted small hint">
        También puedes escribir <code>{'{{clave}}'}</code> o <code>{'{{clave.formato}}'}</code> en el texto.
      </p>
    </aside>
  )
}
