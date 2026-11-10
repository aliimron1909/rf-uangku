import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const svg = path.join(root, 'public', 'logo.svg')
const out = path.join(root, 'public', 'icons')

await mkdir(out, { recursive: true })

await sharp(svg).resize(192, 192).png().toFile(path.join(out, 'icon-192.png'))
await sharp(svg).resize(512, 512).png().toFile(path.join(out, 'icon-512.png'))
await sharp(svg).resize(180, 180).png().toFile(path.join(out, 'apple-touch-180.png'))

// Maskable icon: keep the logo inside the safe zone (80%).
const inner = await sharp(svg).resize(410, 410).png().toBuffer()
await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 4,
    background: { r: 6, g: 95, b: 70, alpha: 1 },
  },
})
  .composite([{ input: inner, top: 51, left: 51 }])
  .png()
  .toFile(path.join(out, 'maskable-512.png'))

console.log('Ikon RF Uangku berhasil dibuat di public/icons/')
