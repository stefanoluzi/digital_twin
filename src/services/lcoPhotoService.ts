import type { LcoPhotoAttachment } from '../maintenance/domain/lcoCouplings'
import { fileToDataUrl } from './dataUrlService'

const ACCEPTED_MIME_TYPES = new Set<LcoPhotoAttachment['mimeType']>(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_DIMENSION = 1800
const REENCODE_SIZE_THRESHOLD = 1_500_000

export async function processLcoPhotoFiles(files: File[]): Promise<LcoPhotoAttachment[]> {
  const accepted = files.filter((file) => ACCEPTED_MIME_TYPES.has(file.type as LcoPhotoAttachment['mimeType']))
  return Promise.all(accepted.map(processPhoto))
}

async function processPhoto(file: File): Promise<LcoPhotoAttachment> {
  const mimeType = file.type as LcoPhotoAttachment['mimeType']
  const sourceDataUrl = await fileToDataUrl(file)
  const image = await loadImage(sourceDataUrl)
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight))
  const shouldEncode = scale < 1 || file.size > REENCODE_SIZE_THRESHOLD
  const dataUrl = shouldEncode ? encodeImage(image, mimeType, scale) : sourceDataUrl
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `PHOTO_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    fileName: file.name,
    mimeType,
    dataUrl,
    createdAt: new Date().toISOString(),
    caption: '',
  }
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo procesar una de las fotografías.'))
    image.src = dataUrl
  })
}

function encodeImage(image: HTMLImageElement, mimeType: LcoPhotoAttachment['mimeType'], scale: number) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No se pudo preparar la fotografía.')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL(mimeType, mimeType === 'image/png' ? undefined : 0.88)
}
