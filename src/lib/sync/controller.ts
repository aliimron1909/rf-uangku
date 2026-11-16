import Dexie from 'dexie'
import { useSyncExternalStore } from 'react'
import { db, getSetting, setSetting } from '../../db/db'
import { errorMessage } from '../utils'
import { consumePendingOAuth, getAccessToken, loadSession, signOut, startGoogleLogin } from './auth'
import { getSupabaseConfig } from './config'
import { createSyncProfile, unlockSyncProfile } from './crypto'
import { SYNC_TABLE_NAMES, markLocalChanges, resetSyncLocalState, syncOnce } from './engine'
import { SupabaseRemote, SyncAuthError } from './supabaseRemote'

const KEY_SETTING = 'syncKey'
const LAST_SYNC_SETTING = 'syncLastAt'
const DEBOUNCE_MS = 3000
const INTERVAL_MS = 120_000

export interface SyncState {
  configured: boolean
  email: string | null
  hasKey: boolean
  status: 'idle' | 'syncing' | 'error'
  lastSyncAt: string | null
  error: string | null
}

let state: SyncState = {
  configured: getSupabaseConfig() !== null,
  email: null,
  hasKey: false,
  status: 'idle',
  lastSyncAt: null,
  error: null,
}
const listeners = new Set<() => void>()

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribe, () => state)
}

function requireConfig() {
  const config = getSupabaseConfig()
  if (!config) throw new Error('Supabase belum dikonfigurasi (VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY).')
  return config
}

function makeRemote() {
  const config = requireConfig()
  return new SupabaseRemote(config, () => getAccessToken(config))
}

export async function refreshSyncState(): Promise<void> {
  const [session, key, lastSyncAt] = await Promise.all([
    loadSession(),
    getSetting<CryptoKey | null>(KEY_SETTING, null),
    getSetting<string | null>(LAST_SYNC_SETTING, null),
  ])
  setState({
    configured: getSupabaseConfig() !== null,
    email: session?.email ?? null,
    hasKey: key !== null,
    lastSyncAt,
  })
}

let running = false

/** Menjalankan satu putaran sinkronisasi bila sudah masuk dan kunci tersedia. */
export async function syncNow(): Promise<void> {
  if (running || !getSupabaseConfig()) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  const [session, key] = await Promise.all([
    loadSession(),
    getSetting<CryptoKey | null>(KEY_SETTING, null),
  ])
  if (!session || !key) return

  running = true
  setState({ status: 'syncing', error: null })
  try {
    await syncOnce({ remote: makeRemote(), key })
    const lastSyncAt = new Date().toISOString()
    await setSetting(LAST_SYNC_SETTING, lastSyncAt)
    setState({ status: 'idle', lastSyncAt })
  } catch (caught) {
    if (caught instanceof SyncAuthError) await refreshSyncState()
    setState({ status: 'error', error: errorMessage(caught) })
  } finally {
    running = false
  }
}

export function signInWithGoogle(): void {
  startGoogleLogin(requireConfig())
}

/** Apakah akun ini sudah punya frasa sandi di cloud (perangkat lain sudah mengaturnya)? */
export async function cloudHasProfile(): Promise<boolean> {
  return (await makeRemote().getProfile()) !== null
}

/** Membuat frasa sandi baru atau membuka yang sudah ada, lalu menyimpan kunci di perangkat ini. */
export async function setupPassphrase(passphrase: string): Promise<'created' | 'unlocked'> {
  const remote = makeRemote()
  const existing = await remote.getProfile()
  let result: 'created' | 'unlocked'
  let key: CryptoKey
  if (existing) {
    key = await unlockSyncProfile(passphrase, existing)
    result = 'unlocked'
  } else {
    const created = await createSyncProfile(passphrase)
    await remote.createProfile(created.profile)
    key = created.key
    result = 'created'
  }
  await resetSyncLocalState()
  await setSetting(KEY_SETTING, key)
  await refreshSyncState()
  void syncNow()
  return result
}

export async function disconnectSync(): Promise<void> {
  await signOut(getSupabaseConfig())
  await db.settings.delete(KEY_SETTING)
  await db.settings.delete(LAST_SYNC_SETTING)
  await resetSyncLocalState()
  setState({ status: 'idle', error: null })
  await refreshSyncState()
}

/** Menghapus semua data cloud akun ini (data lokal tetap). Dipakai bila frasa sandi hilang. */
export async function resetCloudData(): Promise<void> {
  await makeRemote().deleteAll()
  await db.settings.delete(KEY_SETTING)
  await db.settings.delete(LAST_SYNC_SETTING)
  await resetSyncLocalState()
  await refreshSyncState()
}

let started = false

/** Dipanggil sekali dari AppShell: memulihkan sesi login dan memasang pemicu sinkronisasi otomatis. */
export async function startAutoSync(): Promise<void> {
  if (started) return
  started = true

  const config = getSupabaseConfig()
  if (config) {
    try {
      const failure = await consumePendingOAuth(config)
      if (failure) setState({ status: 'error', error: failure })
    } catch (caught) {
      setState({ status: 'error', error: errorMessage(caught) })
    }
  }
  await refreshSyncState()

  let timer: number | undefined
  const schedule = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      // Catat waktu perubahan segera (juga saat offline), baru sinkronkan bila memungkinkan.
      void (async () => {
        const key = await getSetting<CryptoKey | null>(KEY_SETTING, null)
        if (key) await markLocalChanges().catch(() => undefined)
        await syncNow()
      })()
    }, DEBOUNCE_MS)
  }

  // Hanya perubahan pada tabel data yang memicu sinkronisasi (bukan pengaturan/status).
  const dexieOn = (
    Dexie as unknown as {
      on: (event: 'storagemutated', handler: (parts: Record<string, unknown>) => void) => void
    }
  ).on
  dexieOn('storagemutated', (parts) => {
    const touched = Object.keys(parts).some((part) =>
      SYNC_TABLE_NAMES.some((name) => part.includes(`/${name}/`)),
    )
    if (touched) schedule()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
  window.addEventListener('online', () => void syncNow())
  window.setInterval(() => void syncNow(), INTERVAL_MS)
  void syncNow()
}
