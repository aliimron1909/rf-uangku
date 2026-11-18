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

/** Ringkasan untuk membantu mencari masalah plugin di aplikasi native. */
export function nativeDiagnostics(): string {
  if (!isNativeApp()) return ''
  const cap = capacitor()
  const has = (name: string) => (nativePlugin(name) ? 'ada' : 'tidak ada')
  const bridge = `${cap?.nativePromise ? 'promise' : '-'}/${cap?.nativeCallback ? 'callback' : '-'}`
  return `Native: ya (${cap?.getPlatform?.() ?? '?'}) · plugin Browser: ${has('Browser')} · plugin App: ${has('App')} · jembatan: ${bridge}`
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
