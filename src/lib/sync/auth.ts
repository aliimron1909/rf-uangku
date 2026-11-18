import { db, getSetting, setSetting } from '../../db/db'
import type { SupabaseConfig } from './config'
import { NATIVE_AUTH_REDIRECT, isNativeApp, nativePlugin, noteNativeEvent } from '../native'
import { SyncAuthError } from './supabaseRemote'

export const SYNC_SESSION_KEY = 'syncSession'
const PENDING_KEY = 'rf-uangku-oauth-pending'

export interface SyncSession {
  accessToken: string
  refreshToken: string
  /** Detik epoch kedaluwarsa access token. */
  expiresAt: number
  userId: string
  email: string
}

/**
 * Dipanggil sedini mungkin saat aplikasi dimuat: Supabase mengembalikan token OAuth di
 * fragmen URL (#access_token=...). Token dipindah ke sessionStorage lalu URL dibersihkan.
 */
export function captureOAuthRedirect(): void {
  try {
    const hash = window.location.hash
    if (!hash.includes('access_token=') && !hash.includes('error_description=')) return
    sessionStorage.setItem(PENDING_KEY, hash.slice(1))
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  } catch {
    // sessionStorage bisa tidak tersedia; login Google dicoba ulang oleh pengguna.
  }
}

interface BrowserPlugin {
  open(options: { url: string }): Promise<void>
  close(): Promise<void>
}
interface AppPlugin {
  addListener(event: 'appUrlOpen', handler: (event: { url: string }) => void): unknown
  getLaunchUrl?(): Promise<{ url?: string } | undefined>
}

export function startGoogleLogin(config: SupabaseConfig): void {
  if (isNativeApp()) {
    // Google menolak login di WebView; buka di Custom Tab lalu kembali lewat tautan khusus.
    const url = `${config.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(NATIVE_AUTH_REDIRECT)}`
    const browser = nativePlugin<BrowserPlugin>('Browser')
    if (browser) {
      void browser.open({ url }).catch(() => window.location.assign(url))
    } else {
      // Tanpa plugin, WebView membuka alamat luar di browser sistem; tujuan tetap tautan aplikasi.
      window.location.assign(url)
    }
    return
  }
  const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}settings`
  window.location.assign(
    `${config.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`,
  )
}

/** Di aplikasi native: menangkap tautan rfuangku://auth#access_token=... dari login Google. */
/** Mencari tautan rfuangku:// di data event; bentuk data dari jembatan native bisa berlapis. */
function extractUrl(value: unknown, depth = 0): string | undefined {
  if (depth > 3 || value == null) return undefined
  if (typeof value === 'string') {
    if (value.startsWith(NATIVE_AUTH_REDIRECT)) return value
    if (value.startsWith('{')) {
      try {
        return extractUrl(JSON.parse(value), depth + 1)
      } catch {
        return undefined
      }
    }
    return undefined
  }
  if (typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const found = extractUrl(item, depth + 1)
      if (found) return found
    }
  }
  return undefined
}

export function listenForNativeLogin(onToken: () => void): void {
  const app = nativePlugin<AppPlugin>('App')
  if (!app) {
    noteNativeEvent('listener login: plugin App tidak ada')
    return
  }
  const handle = (source: string, url: string | undefined): void => {
    if (!url) return
    if (!url.startsWith(NATIVE_AUTH_REDIRECT)) {
      noteNativeEvent(`${source}: tautan lain (${url.slice(0, 40)})`)
      return
    }
    // Supabase mengirim token di fragmen (#...), tetapi galat bisa lewat query (?...).
    const hashIndex = url.indexOf('#')
    const queryIndex = url.indexOf('?')
    const payload =
      hashIndex >= 0 ? url.slice(hashIndex + 1) : queryIndex >= 0 ? url.slice(queryIndex + 1) : ''
    const hasToken = payload.includes('access_token=')
    noteNativeEvent(
      `${source}: tautan balik diterima, ${payload.length} karakter, token ${hasToken ? 'ada' : 'tidak ada'}`,
    )
    try {
      sessionStorage.setItem(
        PENDING_KEY,
        payload || 'error_description=Tautan balik tidak membawa token (fragmen hilang).',
      )
    } catch {
      noteNativeEvent('sessionStorage tidak tersedia')
      return
    }
    void nativePlugin<BrowserPlugin>('Browser')?.close().catch(() => undefined)
    onToken()
  }
  try {
    app.addListener('appUrlOpen', (event) => {
      const url = extractUrl(event)
      if (!url) {
        // Hanya nama kunci yang dicatat; isi event bisa memuat token login.
        const keys = event && typeof event === 'object' ? Object.keys(event as object).join(',') : typeof event
        noteNativeEvent(`appUrlOpen: url tidak ditemukan (bentuk: ${keys || 'kosong'})`)
        return
      }
      handle('appUrlOpen', url)
    })
    noteNativeEvent('listener login terpasang')
  } catch (caught) {
    noteNativeEvent(`listener gagal: ${caught instanceof Error ? caught.message : 'galat'}`)
  }
  // Bila sistem mematikan aplikasi saat pengguna login di browser, tautan balik menjadi URL peluncuran.
  // Diperiksa saat mulai dan setiap aplikasi kembali aktif; tiap tautan hanya diproses sekali.
  const seen = new Set<string>()
  const checkLaunch = (source: string): void => {
    void app
      .getLaunchUrl?.()
      .then((launch) => {
        const url = extractUrl(launch)
        if (!url) {
          const keys = launch && typeof launch === 'object' ? Object.keys(launch as object).join(',') : typeof launch
          noteNativeEvent(`${source}: tanpa tautan (bentuk: ${keys || 'kosong'})`)
          return
        }
        if (seen.has(url)) return
        seen.add(url)
        handle(source, url)
      })
      .catch((caught) =>
        noteNativeEvent(`${source}: getLaunchUrl gagal (${caught instanceof Error ? caught.message : 'galat'})`),
      )
  }
  checkLaunch('peluncuran')
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkLaunch('kembali aktif')
  })
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in?: number
  expires_at?: number
  user?: { id: string; email?: string }
}

async function fetchUser(config: SupabaseConfig, accessToken: string): Promise<{ id: string; email: string }> {
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new SyncAuthError('Login Google gagal diverifikasi. Coba lagi.')
  const user = (await response.json()) as { id: string; email?: string }
  return { id: user.id, email: user.email ?? '' }
}

function expiryOf(token: TokenResponse): number {
  if (token.expires_at) return token.expires_at
  return Math.floor(Date.now() / 1000) + (token.expires_in ?? 3600)
}

/** Menyimpan sesi dari redirect OAuth yang tertunda. Mengembalikan pesan galat bila ada. */
export async function consumePendingOAuth(config: SupabaseConfig): Promise<string | null> {
  let pending: string | null = null
  try {
    pending = sessionStorage.getItem(PENDING_KEY)
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    return null
  }
  if (!pending) return null
  const params = new URLSearchParams(pending)
  const errorText = params.get('error_description')
  if (errorText) return errorText.replace(/\+/g, ' ')
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (!accessToken || !refreshToken) return 'Login Google tidak mengembalikan token.'
  const user = await fetchUser(config, accessToken)
  const expiresIn = Number(params.get('expires_in')) || 3600
  const session: SyncSession = {
    accessToken,
    refreshToken,
    expiresAt: Number(params.get('expires_at')) || Math.floor(Date.now() / 1000) + expiresIn,
    userId: user.id,
    email: user.email,
  }
  await setSetting(SYNC_SESSION_KEY, session)
  return null
}

export function loadSession(): Promise<SyncSession | null> {
  return getSetting<SyncSession | null>(SYNC_SESSION_KEY, null)
}

async function refresh(config: SupabaseConfig, session: SyncSession): Promise<SyncSession> {
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  })
  if (!response.ok) {
    await db.settings.delete(SYNC_SESSION_KEY)
    throw new SyncAuthError()
  }
  const token = (await response.json()) as TokenResponse
  const next: SyncSession = {
    ...session,
    accessToken: token.access_token,
    refreshToken: token.refresh_token || session.refreshToken,
    expiresAt: expiryOf(token),
  }
  await setSetting(SYNC_SESSION_KEY, next)
  return next
}

/** Access token yang masih berlaku; diperbarui otomatis bila hampir kedaluwarsa. */
export async function getAccessToken(config: SupabaseConfig): Promise<string> {
  const session = await loadSession()
  if (!session) throw new SyncAuthError('Belum masuk. Masuk dengan Google dulu.')
  if (session.expiresAt - 60 > Math.floor(Date.now() / 1000)) return session.accessToken
  return (await refresh(config, session)).accessToken
}

export async function signOut(config: SupabaseConfig | null): Promise<void> {
  const session = await loadSession()
  if (config && session) {
    try {
      await fetch(`${config.url}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: config.anonKey, Authorization: `Bearer ${session.accessToken}` },
      })
    } catch {
      // Tetap keluar secara lokal walau server tak terjangkau.
    }
  }
  await db.settings.delete(SYNC_SESSION_KEY)
}
