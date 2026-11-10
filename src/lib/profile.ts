import { DEFAULT_PROFILE_NAME } from './constants'

export const PROFILE_PHOTO_MAX_INPUT_BYTES = 5 * 1024 * 1024
export const PROFILE_PHOTO_MAX_DATA_URL_LENGTH = 500_000
const PROFILE_PHOTO_SIZE = 256

export function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return DEFAULT_PROFILE_NAME
  if (parts.length === 1) {
    return Array.from(parts[0]).slice(0, 2).join('').toUpperCase() || DEFAULT_PROFILE_NAME
  }

  const first = Array.from(parts[0])[0] ?? ''
  const last = Array.from(parts[parts.length - 1])[0] ?? ''
  return `${first}${last}`.toUpperCase() || DEFAULT_PROFILE_NAME
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Fall through to the <img> decoder for formats the browser cannot bitmap-decode.
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Foto tidak bisa dibaca. Coba file JPG, PNG, atau WebP.'))
    }
    image.src = url
  })
}

/** Resize and compress a profile photo into a small local data URL. */
export async function processProfilePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('File yang dipilih harus berupa gambar.')
  }
  if (file.size > PROFILE_PHOTO_MAX_INPUT_BYTES) {
    throw new Error('Ukuran foto maksimal 5 MB.')
  }

  const image = await loadImage(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = PROFILE_PHOTO_SIZE
    canvas.height = PROFILE_PHOTO_SIZE
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Browser tidak mendukung pemrosesan foto.')

    const scale = Math.max(
      PROFILE_PHOTO_SIZE / image.width,
      PROFILE_PHOTO_SIZE / image.height,
    )
    const width = image.width * scale
    const height = image.height * scale
    const x = (PROFILE_PHOTO_SIZE - width) / 2
    const y = (PROFILE_PHOTO_SIZE - height) / 2

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, PROFILE_PHOTO_SIZE, PROFILE_PHOTO_SIZE)
    context.drawImage(image, x, y, width, height)

    let dataUrl = canvas.toDataURL('image/webp', 0.85)
    if (!dataUrl.startsWith('data:image/webp')) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    }
    if (dataUrl.length > PROFILE_PHOTO_MAX_DATA_URL_LENGTH) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.7)
    }
    if (dataUrl.length > PROFILE_PHOTO_MAX_DATA_URL_LENGTH) {
      throw new Error('Foto masih terlalu besar setelah diproses. Coba gambar lain.')
    }

    return dataUrl
  } finally {
    if ('close' in image && typeof image.close === 'function') {
      image.close()
    }
  }
}
