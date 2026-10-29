import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { useRef } from 'react'
import { MAX_INDENT } from './extensions/Indent'
import { ACCEPTED_IMAGE_TYPES } from './imageFile'

const FONT_FAMILIES = [
  'Arial',
  'Calibri',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
]
const FONT_SIZES = ['10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '24pt', '32pt']

interface Props {
  editor: Editor
  onInsertTag: () => void
  onImageFile: (file: File) => void
  onInsertTable: () => void
}

export function Toolbar({ editor, onInsertTag, onImageFile, onInsertTable }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  // Re-renderiza cuando cambia la selección o el formato bajo el cursor.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      alignLeft: e.isActive({ textAlign: 'left' }),
      alignCenter: e.isActive({ textAlign: 'center' }),
      alignRight: e.isActive({ textAlign: 'right' }),
      alignJustify: e.isActive({ textAlign: 'justify' }),
      fontFamily: e.getAttributes('textStyle').fontFamily as string | undefined,
      fontSize: e.getAttributes('textStyle').fontSize as string | undefined,
      color: e.getAttributes('textStyle').color as string | undefined,
      indent: Number(e.getAttributes('paragraph').indent ?? e.getAttributes('heading').indent ?? 0),
      inTable: e.isActive('table'),
      tableBordered: e.getAttributes('table').bordered !== false,
      canMergeOrSplit: e.can().mergeOrSplit(),
    }),
  })

  const chain = () => editor.chain().focus()

  return (
    <div className="toolbar">
      <div className="group">
        <button className={state.bold ? 'on' : ''} onClick={() => chain().toggleBold().run()} title="Negrita">
          <b>N</b>
        </button>
        <button className={state.italic ? 'on' : ''} onClick={() => chain().toggleItalic().run()} title="Cursiva">
          <i>K</i>
        </button>
        <button className={state.underline ? 'on' : ''} onClick={() => chain().toggleUnderline().run()} title="Subrayado">
          <u>S</u>
        </button>
      </div>

      <div className="group">
        <button className={state.h1 ? 'on' : ''} onClick={() => chain().toggleHeading({ level: 1 }).run()}>
          Título
        </button>
        <button className={state.h2 ? 'on' : ''} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
          Subtítulo
        </button>
      </div>

      <div className="group">
        <select
          aria-label="Fuente"
          value={state.fontFamily ?? ''}
          onChange={(e) => (e.target.value ? chain().setFontFamily(e.target.value).run() : chain().unsetFontFamily().run())}
        >
          <option value="">Fuente</option>
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>
              {f}
            </option>
          ))}
        </select>
        <select
          aria-label="Tamaño"
          value={state.fontSize ?? ''}
          onChange={(e) => (e.target.value ? chain().setFontSize(e.target.value).run() : chain().unsetFontSize().run())}
        >
          <option value="">Tamaño</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="color" title="Color de texto">
          <span>A</span>
          <input
            type="color"
            value={state.color ?? '#000000'}
            onChange={(e) => chain().setColor(e.target.value).run()}
          />
        </label>
      </div>

      <div className="group">
        <button className={state.alignLeft ? 'on' : ''} onClick={() => chain().setTextAlign('left').run()}>
          Izq.
        </button>
        <button className={state.alignCenter ? 'on' : ''} onClick={() => chain().setTextAlign('center').run()}>
          Centro
        </button>
        <button className={state.alignRight ? 'on' : ''} onClick={() => chain().setTextAlign('right').run()}>
          Der.
        </button>
        <button className={state.alignJustify ? 'on' : ''} onClick={() => chain().setTextAlign('justify').run()}>
          Justif.
        </button>
      </div>

      <div className="group">
        <button
          onClick={() => chain().outdent().run()}
          disabled={state.indent <= 0}
          title="Disminuir sangría (Ctrl+[ o Mayús+Tab)"
        >
          ⇤
        </button>
        <button
          onClick={() => chain().indent().run()}
          disabled={state.indent >= MAX_INDENT}
          title="Aumentar sangría (Ctrl+]). Tab inserta una tabulación."
        >
          ⇥
        </button>
      </div>

      <div className="group">
        <button onClick={() => fileInput.current?.click()} title="Insertar imagen (JPG, PNG o WebP)">
          Imagen
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) onImageFile(file)
          }}
        />
        <button onClick={onInsertTable} disabled={state.inTable} title="Insertar tabla">
          Tabla
        </button>
        <button className="accent" onClick={onInsertTag}>
          + Etiqueta
        </button>
      </div>

      {state.inTable && (
        <div className="group table-tools" aria-label="Tabla">
          <span className="muted small">Tabla:</span>
          <button onClick={() => chain().addRowBefore().run()} title="Insertar fila arriba">
            + Fila ↑
          </button>
          <button onClick={() => chain().addRowAfter().run()} title="Insertar fila abajo">
            + Fila ↓
          </button>
          <button onClick={() => chain().addColumnBefore().run()} title="Insertar columna a la izquierda">
            + Col. ←
          </button>
          <button onClick={() => chain().addColumnAfter().run()} title="Insertar columna a la derecha">
            + Col. →
          </button>
          <button onClick={() => chain().deleteRow().run()} title="Eliminar la fila actual">
            − Fila
          </button>
          <button onClick={() => chain().deleteColumn().run()} title="Eliminar la columna actual">
            − Col.
          </button>
          <button
            onClick={() => chain().mergeOrSplit().run()}
            disabled={!state.canMergeOrSplit}
            title="Selecciona varias celdas (arrastrando) para combinarlas, o una combinada para separarla"
          >
            Combinar / separar
          </button>
          <button onClick={() => chain().toggleHeaderRow().run()} title="Primera fila como encabezado">
            Encabezado
          </button>
          <button
            className={state.tableBordered ? 'on' : ''}
            onClick={() => chain().toggleTableBorders().run()}
            title="Mostrar u ocultar los bordes en el PDF"
          >
            Bordes
          </button>
          <button className="danger" onClick={() => chain().deleteTable().run()} title="Eliminar la tabla">
            Eliminar tabla
          </button>
        </div>
      )}
    </div>
  )
}
