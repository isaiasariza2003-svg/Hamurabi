import { useState, type FormEvent } from 'react'

export interface NewTable {
  rows: number
  cols: number
  withHeaderRow: boolean
  bordered: boolean
}

interface Props {
  onInsert: (table: NewTable) => void
  onCancel: () => void
}

const clamp = (n: number, max: number) => Math.min(max, Math.max(1, Math.round(n) || 1))

export function TableDialog({ onInsert, onCancel }: Props) {
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(2)
  const [withHeaderRow, setWithHeaderRow] = useState(false)
  const [bordered, setBordered] = useState(true)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onInsert({ rows: clamp(rows, 50), cols: clamp(cols, 10), withHeaderRow, bordered })
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Insertar tabla</h3>
        <div className="row">
          <label>
            Filas
            <input type="number" min={1} max={50} value={rows} onChange={(e) => setRows(e.target.valueAsNumber)} autoFocus />
          </label>
          <label>
            Columnas
            <input type="number" min={1} max={10} value={cols} onChange={(e) => setCols(e.target.valueAsNumber)} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={withHeaderRow} onChange={(e) => setWithHeaderRow(e.target.checked)} />
          Primera fila como encabezado (negrita y fondo gris)
        </label>
        <label className="check">
          <input type="checkbox" checked={bordered} onChange={(e) => setBordered(e.target.checked)} />
          Con bordes
        </label>
        <p className="muted small">
          Sin bordes, la tabla sirve para alinear contenido en columnas (p. ej. etiqueta y valor). Puedes cambiarlo
          después. Arrastra el borde de una columna para ajustar su ancho.
        </p>
        <div className="actions end">
          <button type="button" className="ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit">Insertar</button>
        </div>
      </form>
    </div>
  )
}
