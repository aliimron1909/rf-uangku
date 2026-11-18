/**
 * Jembatan ke pembungkus native (Capacitor). Tidak mengimpor paket Capacitor: bila aplikasi
 * berjalan di browser/PWA semua fungsi di sini aman dipanggil dan mengembalikan "tidak ada".
 */
interface CapacitorGlobal {
  isNativePlatform?: () => boolean
  Plugins?: Record<string, unknown>
  registerPlugin?: (name: string) => unknown
}

function capacitor(): CapacitorGlobal | null {
  const value = (globalThis as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
  return value ?? null
}

export function isNativeApp(): boolean {
  try {
    return capacitor()?.isNativePlatform?.() === true
  } catch {
    return false
  }
}

const registered = new Map<string, unknown>()

/**
 * Plugin native lewat nama. `Capacitor.Plugins` hanya terisi bila paket JS plugin diimpor, padahal
 * kita tidak mengimpornya (agar build web biasa tetap bebas dependensi), jadi plugin
 * didaftarkan langsung lewat `registerPlugin` dan dipanggil lewat jembatan native.
 */
export function nativePlugin<T>(name: string): T | null {
  if (!isNativeApp()) return null
  const cached = registered.get(name)
  if (cached) return cached as T
  const cap = capacitor()
  const existing = cap?.Plugins?.[name]
  const plugin = existing ?? cap?.registerPlugin?.(name) ?? null
  if (plugin) registered.set(name, plugin)
  return (plugin as T | null) ?? null
}

/** Skema tautan khusus untuk kembali ke aplikasi setelah login Google (tambahkan di Redirect URLs Supabase). */
export const NATIVE_AUTH_REDIRECT = 'rfuangku://auth'
