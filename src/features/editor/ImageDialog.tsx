import { useState, type FormEvent } from 'react'
import type { ImageAlign, ImageAttrs } from './extensions/ImageBlock'

interface Props {
  initial: ImageAttrs
  onSave: (attrs: ImageAttrs) => void
  onRemove: () => void
  onCancel: () => void
}

const ALIGNS: { id: ImageAlign; label: string }[] = [
  { id: 'left', label: 'Izquierda' },
  { id: 'center', label: 'Centro' },
  { id: 'right', label: 'Derecha' },
]

export function ImageDialog({ initial, onSave, onRemove, onCancel }: Props) {
  const [width, setWidth] = useState(initial.width)
  const [align, setAlign] = useState<ImageAlign>(initial.align)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSave({ ...initial, width, align })
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Imagen</h3>

        <div className={`image-preview ${align}`}>
          <img src={initial.src} alt="" style={{ width: `${width}%` }} />
        </div>

        <label>
          Ancho: {width}% del ancho útil de la hoja
          <input type="range" min={5} max={100} step={5} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
        </label>

        <div>
          <span className="small muted">Alineación</span>
          <div className="presets">
            {ALIGNS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={align === a.id ? '' : 'ghost'}
                onClick={() => setAlign(a.id)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="actions end">
          <button type="button" className="danger" onClick={onRemove}>
            Quitar imagen
          </button>
          <span className="spacer" />
          <button type="button" className="ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit">Aplicar</button>
        </div>
      </form>
    </div>
  )
}
