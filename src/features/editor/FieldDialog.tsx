import { useState, type FormEvent } from 'react'
import type { TagType } from '../../core/formatters'
import { isValidKey, slugifyKey } from '../../core/tablets/slug'
import type { FieldDef } from '../../core/tablets/types'
import { TYPE_LABELS } from './fieldSamples'

interface Props {
  initial: FieldDef | null
  /** Claves ya usadas por otras etiquetas de la tablilla. */
  takenKeys: string[]
  onSave: (field: FieldDef) => void
  onCancel: () => void
}

export function FieldDialog({ initial, takenKeys, onSave, onCancel }: Props) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [key, setKey] = useState(initial?.key ?? '')
  const [keyTouched, setKeyTouched] = useState(Boolean(initial))
  const [type, setType] = useState<TagType>(initial?.type ?? 'text')
  const [options, setOptions] = useState((initial?.options ?? []).join('\n'))
  // Texto con lista de opciones: al generar se elige de la lista (o se escribe otro valor).
  const [textHasOptions, setTextHasOptions] = useState(initial?.type === 'text' && Boolean(initial.options?.length))
  const [currencySymbol, setCurrencySymbol] = useState(initial?.config?.currencySymbol ?? '$')
  const [currencySingular, setCurrencySingular] = useState(initial?.config?.currencySingular ?? 'peso')
  const [currencyPlural, setCurrencyPlural] = useState(initial?.config?.currencyPlural ?? 'pesos')
  const [decimals, setDecimals] = useState(String(initial?.config?.decimals ?? 2))
  const [trueText, setTrueText] = useState(initial?.config?.trueText ?? 'Sí')
  const [falseText, setFalseText] = useState(initial?.config?.falseText ?? 'No')

  const onLabel = (value: string) => {
    setLabel(value)
    if (!keyTouched) setKey(slugifyKey(value))
  }

  const keyError = !key
    ? 'La clave es obligatoria.'
    : !isValidKey(key)
      ? 'Solo letras sin acentos, números y _, sin empezar por número.'
      : takenKeys.includes(key)
        ? 'Ya existe otra etiqueta con esta clave.'
        : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (keyError) return
    const field: FieldDef = { key, label: label.trim() || key, type }
    const optionList = options.split('\n').map((o) => o.trim()).filter(Boolean)
    if (type === 'select' || (type === 'text' && textHasOptions && optionList.length)) field.options = optionList
    if (type === 'number') {
      field.config = { decimals: Number(decimals) || 0, currencySymbol, currencySingular, currencyPlural }
    }
    if (type === 'boolean') field.config = { trueText, falseText }
    onSave(field)
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>{initial ? 'Editar etiqueta' : 'Nueva etiqueta'}</h3>

        <label>
          Nombre visible
          <input value={label} onChange={(e) => onLabel(e.target.value)} placeholder="Ej. Nombre del cliente" autoFocus />
        </label>

        <label>
          Clave
          <input
            value={key}
            onChange={(e) => {
              setKeyTouched(true)
              setKey(e.target.value.trim())
            }}
            placeholder="nombreCliente"
          />
          {keyError ? (
            <span className="error small">{keyError}</span>
          ) : (
            <span className="muted small">
              En el texto: <code>{`{{${key}}}`}</code> o con formato <code>{`{{${key}.mayusculas}}`}</code>
            </span>
          )}
        </label>

        <label>
          Tipo
          <select value={type} onChange={(e) => setType(e.target.value as TagType)}>
            {(Object.keys(TYPE_LABELS) as TagType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          {initial && initial.type !== type && (
            <span className="muted small">
              Las apariciones con un formato que no aplica al nuevo tipo pasarán al formato por defecto.
            </span>
          )}
        </label>

        {type === 'text' && (
          <label className="check">
            <input type="checkbox" checked={textHasOptions} onChange={(e) => setTextHasOptions(e.target.checked)} />
            Lista de opciones predefinidas
          </label>
        )}

        {(type === 'select' || (type === 'text' && textHasOptions)) && (
          <label>
            Opciones (una por línea)
            <textarea rows={4} value={options} onChange={(e) => setOptions(e.target.value)} />
            {type === 'text' && (
              <span className="muted small">
                Al generar el documento se elige una de la lista, sin escribirla. También se puede escribir otro
                valor con «Otro…».
              </span>
            )}
          </label>
        )}

        {type === 'number' && (
          <>
            <label>
              Decimales
              <input type="number" min={0} max={6} value={decimals} onChange={(e) => setDecimals(e.target.value)} />
            </label>
            <span className="muted small">Moneda (para los formatos .moneda y .monedaLetras)</span>
            <div className="row">
              <label>
                Símbolo
                <input value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} />
              </label>
              <label>
                Singular
                <input value={currencySingular} onChange={(e) => setCurrencySingular(e.target.value)} />
              </label>
              <label>
                Plural
                <input value={currencyPlural} onChange={(e) => setCurrencyPlural(e.target.value)} />
              </label>
            </div>
          </>
        )}

        {type === 'boolean' && (
          <div className="row">
            <label>
              Si es verdadero
              <input value={trueText} onChange={(e) => setTrueText(e.target.value)} />
            </label>
            <label>
              Si es falso
              <input value={falseText} onChange={(e) => setFalseText(e.target.value)} />
            </label>
          </div>
        )}

        <div className="actions end">
          <button type="button" className="ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" disabled={Boolean(keyError)}>
            Guardar
          </button>
        </div>
      </form>
    </div>
  )
}
