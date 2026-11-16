export const RECEIPT_MAX_INPUT_BYTES = 10 * 1024 * 1024
export const RECEIPT_MAX_DATA_URL_LENGTH = 450_000
const RECEIPT_MAX_SIDE = 1280

export function isReceiptDataUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^data:image\/(jpeg|webp|png);base64,/.test(value) &&
    value.length <= RECEIPT_MAX_DATA_URL_LENGTH
  )
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Lanjut ke dekoder <img> untuk format yang tidak bisa didekode sebagai bitmap.
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

/** Mengecilkan foto struk (sisi terpanjang 1280 px) dan mengompresnya menjadi data URL. */
export async function processReceiptPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('File yang dipilih harus berupa gambar.')
  if (file.size > RECEIPT_MAX_INPUT_BYTES) throw new Error('Ukuran foto maksimal 10 MB.')

  const image = await loadImage(file)
  try {
    const scale = Math.min(1, RECEIPT_MAX_SIDE / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Browser tidak mendukung pemrosesan foto.')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)

    for (const quality of [0.75, 0.6, 0.45]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      if (dataUrl.length <= RECEIPT_MAX_DATA_URL_LENGTH) return dataUrl
    }
    throw new Error('Foto masih terlalu besar setelah dikompres. Coba foto yang lebih sederhana.')
  } finally {
    if ('close' in image && typeof image.close === 'function') image.close()
  }
}
