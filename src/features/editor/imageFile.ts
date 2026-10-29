export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_BYTES = 10 * 1024 * 1024
/** Lado máximo en píxeles: sobra para imprimir una imagen a lo ancho de la hoja (~190 ppp). */
const MAX_SIDE = 1600

const readAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('El archivo no es una imagen válida'))
    img.src = src
  })

function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const data = ctx.getImageData(0, 0, w, h).data
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true
  return false
}

/**
 * Convierte el archivo en un data URL JPEG o PNG, los formatos que admite el PDF.
 * WebP se convierte (a PNG si tiene transparencia, si no a JPEG) y las imágenes grandes se reducen.
 */
export async function imageFileToDataUrl(file: File): Promise<string> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new Error('Formato no admitido. Usa JPG, PNG o WebP.')
  if (file.size > MAX_FILE_BYTES) throw new Error('La imagen supera los 10 MB.')

  const original = await readAsDataUrl(file)
  const img = await loadImage(original)
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  if (scale === 1 && file.type !== 'image/webp') return original

  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('El navegador no pudo procesar la imagen')
  ctx.drawImage(img, 0, 0, w, h)

  const png = file.type === 'image/png' || (file.type === 'image/webp' && hasTransparency(ctx, w, h))
  return png ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9)
}
