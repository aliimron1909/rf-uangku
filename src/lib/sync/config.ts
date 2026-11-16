export interface SupabaseConfig {
  url: string
  anonKey: string
}

/** Membaca konfigurasi dari env Vite. Mengembalikan null bila belum diisi. */
export function getSupabaseConfig(): SupabaseConfig | null {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  const url = env?.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '')
  const anonKey = env?.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) return null
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(url)) return null
  return { url, anonKey }
}
