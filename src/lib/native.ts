/**
 * Jembatan ke pembungkus native (Capacitor). Tidak mengimpor paket Capacitor: bila aplikasi
 * berjalan di browser/PWA semua fungsi di sini aman dipanggil dan mengembalikan "tidak ada".
 */
interface CapacitorGlobal {
  isNativePlatform?: () => boolean
  Plugins?: Record<string, unknown>
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

export function nativePlugin<T>(name: string): T | null {
  if (!isNativeApp()) return null
  return ((capacitor()?.Plugins ?? {})[name] as T | undefined) ?? null
}

/** Skema tautan khusus untuk kembali ke aplikasi setelah login Google (tambahkan di Redirect URLs Supabase). */
export const NATIVE_AUTH_REDIRECT = 'rfuangku://auth'
