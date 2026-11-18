import type { TrendPoint } from '../types'

const WIDTH = 480
const HEIGHT = 200

/**
 * Menggambar grafik batang pemasukan (hijau) dan pengeluaran (merah) sebagai PNG base64 tanpa awalan data URL.
 * Tanpa angka sumbu supaya saldo tidak terbaca saat disembunyikan. Mengembalikan null bila canvas tidak tersedia.
 */
export function renderTrendChart(points: TrendPoint[]): string | null {
  if (typeof document === 'undefined' || points.length === 0) return null
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const left = 6
  const right = WIDTH - 6
  const top = 8
  const bottom = HEIGHT - 26
  const max = Math.max(1, ...points.flatMap((point) => [point.income, point.expense]))
  const slot = (right - left) / points.length
  const barWidth = Math.max(3, Math.min(18, slot / 2 - 2))

  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 2; i++) {
    const y = top + ((bottom - top) * i) / 2
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
    ctx.stroke()
  }

  const bar = (x: number, value: number, color: string) => {
    const height = Math.max(value > 0 ? 2 : 0, (value / max) * (bottom - top))
    const y = bottom - height
    ctx.fillStyle = color
    ctx.beginPath()
    const radius = Math.min(barWidth / 2, 4, height)
    ctx.moveTo(x, bottom)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.lineTo(x + barWidth - radius, y)
    ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius)
    ctx.lineTo(x + barWidth, bottom)
    ctx.closePath()
    ctx.fill()
  }

  points.forEach((point, index) => {
    const center = left + slot * index + slot / 2
    bar(center - barWidth - 1, point.income, '#34d399')
    bar(center + 1, point.expense, '#fb7185')
  })

  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '16px sans-serif'
  ctx.textBaseline = 'alphabetic'
  const labelAt = (index: number, align: CanvasTextAlign) => {
    ctx.textAlign = align
    const x = align === 'left' ? left : align === 'right' ? right : left + slot * index + slot / 2
    ctx.fillText(points[index].label, x, HEIGHT - 6)
  }
  labelAt(0, 'left')
  if (points.length > 4) labelAt(Math.floor(points.length / 2), 'center')
  labelAt(points.length - 1, 'right')

  return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
}
