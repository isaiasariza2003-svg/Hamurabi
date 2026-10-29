import Color from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'
import { FontSize } from './FontSize'
import { ImageBlock } from './ImageBlock'
import { Indent } from './Indent'
import { tableExtensions } from './Tables'
import { TagNode, type TagNodeOptions } from './TagNode'

/** Mismas extensiones para el editor y la vista previa, para que el resultado coincida. */
export function createEditorExtensions(isValidTag: TagNodeOptions['isValidTag'] = null) {
  return [
    StarterKit,
    TextStyle,
    FontFamily,
    FontSize,
    Color,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TagNode.configure({ isValidTag }),
    ...tableExtensions,
    Indent,
    ImageBlock,
  ]
}
