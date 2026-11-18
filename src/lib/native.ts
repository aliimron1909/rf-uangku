/**
 * Jembatan ke pembungkus native (Capacitor). Tidak mengimpor paket Capacitor: bila aplikasi
 * berjalan di browser/PWA semua fungsi di sini aman dipanggil dan mengembalikan "tidak ada".
 */
interface CapacitorGlobal {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
  Plugins?: Record<string, unknown>
  registerPlugin?: (name: string) => unknown
  /** Primitif jembatan native; ada walau paket @capacitor/core tidak dibundel di aplikasi web. */
  nativePromise?: (plugin: string, method: string, options?: unknown) => Promise<unknown>
  nativeCallback?: (
    plugin: string,
    method: string,
    options: unknown,
    callback: (data: unknown) => void,
  ) => unknown
}

function capacitor(): CapacitorGlobal | null {
  const value = (globalThis as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
  return value ?? null
}

export function isNativeApp(): boolean {
  try {
    const cap = capacitor()
    if (!cap) return false
    if (cap.isNativePlatform?.() === true) return true
    const platform = cap.getPlatform?.()
    if (platform === 'android' || platform === 'ios') return true
    // Capacitor melayani aplikasi dari https://localhost; tidak dipakai oleh situs biasa.
    return window.location.protocol === 'https:' && window.location.hostname === 'localhost'
  } catch {
    return false
  }
}

let lastNativeEvent = ''
const listeners = new Set<() => void>()

/** Mencatat kejadian terakhir (tautan balik login dsb.) agar terlihat di layar Pengaturan. */
export function noteNativeEvent(text: string): void {
  const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  lastNativeEvent = `${time} ${text}`
  listeners.forEach((listener) => listener())
}

export function subscribeNativeEvents(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Ringkasan untuk membantu mencari masalah plugin di aplikasi native. */
export function nativeDiagnostics(): string {
  if (!isNativeApp()) return ''
  const cap = capacitor()
  const has = (name: string) => (nativePlugin(name) ? 'ada' : 'tidak ada')
  const bridge = `${cap?.nativePromise ? 'promise' : '-'}/${cap?.nativeCallback ? 'callback' : '-'}`
  return `Native: ya (${cap?.getPlatform?.() ?? '?'}) · plugin Browser: ${has('Browser')} · plugin App: ${has('App')} · jembatan: ${bridge}${lastNativeEvent ? ` · ${lastNativeEvent}` : ''}`
}

const registered = new Map<string, unknown>()

/**
 * Pembungkus tipis di atas primitif jembatan native. Aplikasi web tidak membundel @capacitor/core,
 * jadi `Capacitor.Plugins` dan `registerPlugin` tidak tersedia; plugin dipanggil langsung lewat nama.
 */
function bridgePlugin(name: string): unknown | null {
  const cap = capacitor()
  const nativePromise = cap?.nativePromise
  if (!cap || !nativePromise) return null
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (typeof property !== 'string' || property === 'then') return undefined
        if (property === 'addListener') {
          return (eventName: string, handler: (data: unknown) => void) => {
            cap.nativeCallback?.(name, 'addListener', { eventName }, handler)
          }
        }
        return (options?: unknown) => nativePromise.call(cap, name, property, options ?? {})
      },
    },
  )
}

export function nativePlugin<T>(name: string): T | null {
  if (!isNativeApp()) return null
  const cached = registered.get(name)
  if (cached) return cached as T
  const cap = capacitor()
  const plugin = cap?.Plugins?.[name] ?? cap?.registerPlugin?.(name) ?? bridgePlugin(name)
  if (plugin) registered.set(name, plugin)
  return (plugin as T | null) ?? null
}

/** Skema tautan khusus untuk kembali ke aplikasi setelah login Google (tambahkan di Redirect URLs Supabase). */
export const NATIVE_AUTH_REDIRECT = 'rfuangku://auth'

/** Tautan dari widget layar utama untuk membuka form transaksi baru. */
export const NATIVE_NEW_LINK = 'rfuangku://new'

/** Mencari tautan berawalan tertentu di data event; bentuk data dari jembatan native bisa berlapis. */
export function extractNativeUrl(value: unknown, prefix: string, depth = 0): string | undefined {
  if (depth > 3 || value == null) return undefined
  if (typeof value === 'string') {
    if (value.startsWith(prefix)) return value
    if (value.startsWith('{')) {
      try {
        return extractNativeUrl(JSON.parse(value), prefix, depth + 1)
      } catch {
        return undefined
      }
    }
    return undefined
  }
  if (typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const found = extractNativeUrl(item, prefix, depth + 1)
      if (found) return found
    }
  }
  return undefined
}
