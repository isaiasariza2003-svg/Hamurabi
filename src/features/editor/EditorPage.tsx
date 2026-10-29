import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { isValidFormat } from '../../core/formatters'
import { getTablet, updateTablet } from '../../core/tablets/repository'
import type { FieldDef, Margins, PageSize, TagAttrs, Tablet } from '../../core/tablets/types'
import { createEditorExtensions } from './extensions'
import type { ImageAttrs } from './extensions/ImageBlock'
import { FieldDialog } from './FieldDialog'
import { FieldsPanel } from './FieldsPanel'
import { ImageDialog } from './ImageDialog'
import { imageFileToDataUrl } from './imageFile'
import { MarginsDialog } from './MarginsDialog'
import { PlaceTagDialog } from './PlaceTagDialog'
import { Sheet } from './Sheet'
import { TableDialog, type NewTable } from './TableDialog'
import { updateTags } from './tagOps'
import { Toolbar } from './Toolbar'

export function EditorPage() {
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
  return <TabletEditor key={tablet.id} tablet={tablet} />
}

type Dialog =
  | { kind: 'field'; field: FieldDef | null; insertAfter: boolean }
  | { kind: 'place'; pos: number; attrs: TagAttrs }
  | { kind: 'margins' }
  | { kind: 'image'; pos: number; attrs: ImageAttrs }
  | { kind: 'table' }

function TabletEditor({ tablet }: { tablet: Tablet }) {
  const [name, setName] = useState(tablet.name)
  const [pageSize, setPageSize] = useState<PageSize>(tablet.page_size)
  const [margins, setMargins] = useState<Margins>(tablet.margins)
  const [fields, setFields] = useState<FieldDef[]>(tablet.fields)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)

  // La regla de entrada {{clave.formato}} consulta las etiquetas vigentes sin recrear el editor.
  const fieldsRef = useRef(fields)
  useEffect(() => {
    fieldsRef.current = fields
  }, [fields])
  const [extensions] = useState(() =>
    createEditorExtensions((key, format) => {
      const field = fieldsRef.current.find((f) => f.key === key)
      return Boolean(field) && isValidFormat(field!.type, format)
    }),
  )

  const editor = useEditor({
    extensions,
    content: tablet.content,
    immediatelyRender: false,
    onUpdate: () => setDirty(true),
  })

  // Apariciones de cada clave en el texto, recalculadas en cada cambio del documento.
  const uses = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const counts: Record<string, number> = {}
      e?.state.doc.descendants((node) => {
        if (node.type.name === 'tag') counts[node.attrs.key] = (counts[node.attrs.key] ?? 0) + 1
      })
      return counts
    },
  }) ?? {}

  const save = async () => {
    if (!editor) return
    setSaving(true)
    setStatus(null)
    try {
      const saved = await updateTablet(tablet.id, {
        name: name.trim() || tablet.name,
        page_size: pageSize,
        margins,
        content: editor.getJSON(),
        fields,
      })
      setDirty(false)
      setStatus(`Guardado ${new Date(saved.updated_at).toLocaleTimeString('es')}`)
    } catch (e) {
      setStatus(e instanceof Error ? `Error: ${e.message}` : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  // Ctrl+S para guardar. Se registra en cada render para que save vea el estado actual.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Aviso del navegador al cerrar o recargar con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const insertTag = (attrs: TagAttrs) => {
    editor?.chain().focus().insertTag(attrs).run()
  }

  const onSaveField = (field: FieldDef) => {
    if (!editor || dialog?.kind !== 'field') return
    const previous = dialog.field
    if (previous) {
      setFields((prev) => prev.map((f) => (f.key === previous.key ? field : f)))
      // Renombrar la clave o cambiar el tipo actualiza todas sus apariciones en el texto.
      updateTags(editor, (a) =>
        a.key !== previous.key ? a : { key: field.key, format: isValidFormat(field.type, a.format) ? a.format : '' },
      )
    } else {
      setFields((prev) => [...prev, field])
      if (dialog.insertAfter) insertTag({ key: field.key, format: '' })
    }
    setDialog(null)
    setDirty(true)
  }

  const onDeleteField = (field: FieldDef) => {
    if (!editor) return
    const count = uses[field.key] ?? 0
    const detail = count ? ` Se quitará de ${count} lugar(es) del texto.` : ''
    if (!window.confirm(`¿Eliminar la etiqueta "${field.label}"?${detail}`)) return
    updateTags(editor, (a) => (a.key === field.key ? null : a))
    setFields((prev) => prev.filter((f) => f.key !== field.key))
    setDirty(true)
  }

  const onImageFile = async (file: File) => {
    if (!editor) return
    try {
      const src = await imageFileToDataUrl(file)
      editor.chain().focus().insertImage({ src }).run()
    } catch (e) {
      setStatus(e instanceof Error ? `Error: ${e.message}` : 'No se pudo insertar la imagen')
    }
  }

  // Click sobre una etiqueta (cambiar su formato o quitarla) o una imagen (tamaño y alineación).
  const onClickCanvas = (e: MouseEvent) => {
    if (!editor) return
    const target = e.target as HTMLElement
    const tagEl = target.closest<HTMLElement>('[data-tag]')
    if (tagEl) {
      const pos = editor.view.posAtDOM(tagEl, 0)
      const node = editor.state.doc.nodeAt(pos)
      if (node?.type.name === 'tag') setDialog({ kind: 'place', pos, attrs: node.attrs as TagAttrs })
      return
    }
    const imageEl = target.closest<HTMLElement>('[data-image]')
    if (imageEl) {
      const pos = editor.view.posAtDOM(imageEl, 0)
      const node = editor.state.doc.nodeAt(pos)
      if (node?.type.name === 'image') setDialog({ kind: 'image', pos, attrs: node.attrs as ImageAttrs })
    }
  }

  const onSaveImage = (attrs: ImageAttrs) => {
    if (!editor || dialog?.kind !== 'image') return
    editor.view.dispatch(editor.state.tr.setNodeMarkup(dialog.pos, undefined, attrs))
    setDialog(null)
  }

  const onPlaceTag = (attrs: TagAttrs) => {
    if (!editor || dialog?.kind !== 'place') return
    editor.view.dispatch(editor.state.tr.setNodeMarkup(dialog.pos, undefined, attrs))
    setDialog(null)
  }

  const onRemoveNode = () => {
    if (!editor || (dialog?.kind !== 'place' && dialog?.kind !== 'image')) return
    const node = editor.state.doc.nodeAt(dialog.pos)
    if (node) editor.view.dispatch(editor.state.tr.delete(dialog.pos, dialog.pos + node.nodeSize))
    setDialog(null)
  }

  return (
    <main className="editor-page">
      <div className="editor-head">
        <Link to="/tablets" className="muted">
          ← Tablillas
        </Link>
        <input
          className="name-input"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setDirty(true)
          }}
        />
        <select
          aria-label="Tamaño de hoja"
          value={pageSize}
          onChange={(e) => {
            setPageSize(e.target.value as PageSize)
            setDirty(true)
          }}
        >
          <option value="letter">Carta (8.5 × 11 in)</option>
          <option value="legal">Oficio (8.5 × 14 in)</option>
        </select>
        <button className="ghost" onClick={() => setDialog({ kind: 'margins' })}>
          Márgenes
        </button>
        <Link to={`/tablets/${tablet.id}/generate`} className="button-link ghost">
          Generar
        </Link>
        <button onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? 'Guardando…' : dirty ? 'Guardar' : 'Guardado'}
        </button>
      </div>
      {status && <p className="muted small">{status}</p>}

      {editor && (
        <>
          <Toolbar
            editor={editor}
            onInsertTag={() => setDialog({ kind: 'field', field: null, insertAfter: true })}
            onImageFile={(file) => void onImageFile(file)}
            onInsertTable={() => setDialog({ kind: 'table' })}
          />
          <div className="editor-body">
            <div className="canvas" onClick={onClickCanvas}>
              <Sheet pageSize={pageSize} margins={margins} editing>
                <EditorContent editor={editor} />
              </Sheet>
            </div>
            <FieldsPanel
              fields={fields}
              uses={uses}
              onInsert={insertTag}
              onNew={() => setDialog({ kind: 'field', field: null, insertAfter: false })}
              onEdit={(field) => setDialog({ kind: 'field', field, insertAfter: false })}
              onDelete={onDeleteField}
            />
          </div>
        </>
      )}

      {dialog?.kind === 'field' && (
        <FieldDialog
          initial={dialog.field}
          takenKeys={fields.filter((f) => f.key !== dialog.field?.key).map((f) => f.key)}
          onSave={onSaveField}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'place' && (
        <PlaceTagDialog
          fields={fields}
          initial={dialog.attrs}
          onSave={onPlaceTag}
          onRemove={onRemoveNode}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'image' && (
        <ImageDialog
          initial={dialog.attrs}
          onSave={onSaveImage}
          onRemove={onRemoveNode}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'table' && (
        <TableDialog
          onInsert={({ rows, cols, withHeaderRow, bordered }: NewTable) => {
            editor
              ?.chain()
              .focus()
              .insertTable({ rows, cols, withHeaderRow })
              .updateAttributes('table', { bordered })
              .run()
            setDialog(null)
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'margins' && (
        <MarginsDialog
          initial={margins}
          onSave={(m) => {
            setMargins(m)
            setDirty(true)
            setDialog(null)
          }}
          onCancel={() => setDialog(null)}
        />
      )}
    </main>
  )
}
