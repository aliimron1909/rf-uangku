/**
 * Menyambungkan "overlay" (dialog, halaman detail pengaturan) dengan tombol kembali HP:
 * saat overlay terbuka satu entri riwayat ditambahkan, sehingga kembali hanya menutup overlay
 * dan tidak langsung berpindah halaman.
 */
interface Entry {
  id: number
  close: () => void
  dead: boolean
  pushed: boolean
}

const stack: Entry[] = []
const waiting: (() => void)[] = []
let seq = 0
let ignorePops = 0
let backing = false
let installed = false

function flush(): void {
  for (const job of waiting.splice(0)) job()
}

function onPop(): void {
  if (ignorePops > 0) {
    ignorePops -= 1
    if (ignorePops === 0) {
      backing = false
      flush()
    }
    return
  }
  const entry = stack.pop()
  if (entry && !entry.dead) entry.close()
}

function install(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('popstate', onPop)
}

/** Mendaftarkan overlay yang terbuka. Mengembalikan fungsi pelepas untuk dipanggil saat overlay ditutup. */
export function pushBackEntry(close: () => void): () => void {
  install()
  const entry: Entry = { id: ++seq, close, dead: false, pushed: false }
  const push = () => {
    if (entry.dead) return
    try {
      // Salinan state lama menjaga penomoran riwayat milik React Router tetap utuh.
      window.history.pushState({ ...(window.history.state ?? {}), rfBack: entry.id }, '')
      entry.pushed = true
      stack.push(entry)
    } catch {
      // Tanpa riwayat, overlay tetap bisa ditutup lewat tombolnya sendiri.
    }
  }
  if (backing) waiting.push(push)
  else push()

  return () => {
    if (!entry.pushed) {
      entry.dead = true
      return
    }
    if (stack[stack.length - 1] === entry) {
      stack.pop()
      const state = window.history.state as { rfBack?: number } | null
      if (state?.rfBack === entry.id) {
        backing = true
        ignorePops += 1
        window.history.back()
      }
    } else {
      entry.dead = true
    }
  }
}
