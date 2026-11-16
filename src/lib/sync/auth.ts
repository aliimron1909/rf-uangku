import { db, getSetting, setSetting } from '../../db/db'
import type { SupabaseConfig } from './config'
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

export function startGoogleLogin(config: SupabaseConfig): void {
  const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}settings`
  window.location.assign(
    `${config.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`,
  )
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
