import { Node } from '@tiptap/core'

export type ImageAlign = 'left' | 'center' | 'right'

export interface ImageAttrs {
  /** Data URL JPEG o PNG: se guarda dentro de la tablilla y pdfmake la usa tal cual. */
  src: string
  /** Porcentaje del ancho útil de la hoja, igual en el editor y en el PDF. */
  width: number
  align: ImageAlign
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageBlock: {
      insertImage: (attrs: Pick<ImageAttrs, 'src'> & Partial<ImageAttrs>) => ReturnType
    }
  }
}

/** Imagen como bloque propio (logos, firmas, sellos) con ancho relativo y alineación. */
export const ImageBlock = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: '' },
      width: { default: 50 },
      align: { default: 'center' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-image]',
        getAttrs: (el) => {
          const img = el.querySelector('img')
          const src = img?.getAttribute('src') ?? ''
          // Solo imágenes incrustadas: las externas no se pueden garantizar en el PDF.
          if (!src.startsWith('data:image/')) return false
          return {
            src,
            width: Number(el.getAttribute('data-width')) || 50,
            align: el.getAttribute('data-align') ?? 'center',
          }
        },
      },
    ]
  },

  renderHTML({ node }) {
    const { src, width, align } = node.attrs as ImageAttrs
    return [
      'div',
      { 'data-image': '', 'data-width': width, 'data-align': align, class: `image-block ${align}` },
      ['img', { src, style: `width: ${width}%`, alt: '', draggable: 'false' }],
    ]
  },

  addCommands() {
    return {
      insertImage:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { width: 50, align: 'center', ...attrs } }),
    }
  },
})
