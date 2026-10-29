import { useState, type FormEvent } from 'react'
import type { Margins } from '../../core/tablets/types'

const PRESETS: { label: string; margins: Margins }[] = [
  { label: 'Normal', margins: { top: 2.54, right: 2.54, bottom: 2.54, left: 2.54 } },
  { label: 'Estrecho', margins: { top: 1.27, right: 1.27, bottom: 1.27, left: 1.27 } },
  { label: 'Moderado', margins: { top: 2.54, right: 1.91, bottom: 2.54, left: 1.91 } },
  { label: 'Ancho', margins: { top: 2.54, right: 5.08, bottom: 2.54, left: 5.08 } },
]

const MAX_CM = 6
const SIDES: { key: keyof Margins; label: string }[] = [
  { key: 'top', label: 'Superior' },
  { key: 'bottom', label: 'Inferior' },
  { key: 'left', label: 'Izquierdo' },
  { key: 'right', label: 'Derecho' },
]

interface Props {
  initial: Margins
  onSave: (margins: Margins) => void
  onCancel: () => void
}

export function MarginsDialog({ initial, onSave, onCancel }: Props) {
  const [values, setValues] = useState<Record<keyof Margins, string>>({
    top: String(initial.top),
    right: String(initial.right),
    bottom: String(initial.bottom),
    left: String(initial.left),
  })

  const parsed = Object.fromEntries(
    SIDES.map(({ key }) => [key, Number(values[key].replace(',', '.'))]),
  ) as unknown as Margins
  const invalid = SIDES.some(({ key }) => !Number.isFinite(parsed[key]) || parsed[key] < 0 || parsed[key] > MAX_CM)

  const applyPreset = (m: Margins) =>
    setValues({ top: String(m.top), right: String(m.right), bottom: String(m.bottom), left: String(m.left) })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!invalid) onSave(parsed)
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Márgenes</h3>

        <div className="presets">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="ghost" onClick={() => applyPreset(p.margins)}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="margins-grid">
          {SIDES.map(({ key, label }) => (
            <label key={key}>
              {label} (cm)
              <input
                type="number"
                min={0}
                max={MAX_CM}
                step={0.01}
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        {invalid && <p className="error small">Cada margen debe estar entre 0 y {MAX_CM} cm.</p>}

        <div className="actions end">
          <button type="button" className="ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" disabled={invalid}>
            Aplicar
          </button>
        </div>
      </form>
    </div>
  )
}
