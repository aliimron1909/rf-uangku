import Dexie from 'dexie'
import { useSyncExternalStore } from 'react'
import { db, getSetting, setSetting } from '../../db/db'
import { errorMessage } from '../utils'
import {
  consumePendingOAuth,
  getAccessToken,
  listenForNativeLogin,
  loadSession,
  signOut,
  startGoogleLogin,
} from './auth'
import { getSupabaseConfig } from './config'
import { SYNC_TABLE_NAMES, markLocalChanges, resetSyncLocalState, syncOnce } from './engine'
import { SupabaseRemote, SyncAuthError } from './supabaseRemote'

const LEGACY_KEY_SETTING = 'syncKey'
const FORMAT_SETTING = 'syncFormat'
const SYNC_FORMAT = 2
const LAST_SYNC_SETTING = 'syncLastAt'
const DEBOUNCE_MS = 3000
const INTERVAL_MS = 120_000

export interface SyncState {
  configured: boolean
  email: string | null
  status: 'idle' | 'syncing' | 'error'
  lastSyncAt: string | null
  error: string | null
}

let state: SyncState = {
  configured: getSupabaseConfig() !== null,
  email: null,
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

export function makeRemote() {
  const config = requireConfig()
  return new SupabaseRemote(config, () => getAccessToken(config))
}

export async function refreshSyncState(): Promise<void> {
  const [session, lastSyncAt] = await Promise.all([
    loadSession(),
    getSetting<string | null>(LAST_SYNC_SETTING, null),
  ])
  setState({
    configured: getSupabaseConfig() !== null,
    email: session?.email ?? null,
    lastSyncAt,
  })
}

let running = false

/** Menjalankan satu putaran sinkronisasi bila sudah masuk. */
export async function syncNow(): Promise<void> {
  if (running || !getSupabaseConfig()) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  const session = await loadSession()
  if (!session) return

  running = true
  setState({ status: 'syncing', error: null })
  try {
    await migrateSyncFormat()
    await syncOnce({ remote: makeRemote() })
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
  try {
    startGoogleLogin(requireConfig())
  } catch (caught) {
    setState({ status: 'error', error: errorMessage(caught) })
  }
}

/**
 * Format lama (terenkripsi) diganti JSON biasa. Status sinkron lokal dilupakan sekali saja
 * supaya seluruh data di perangkat diunggah ulang ke cloud yang sudah dikosongkan.
 */
async function migrateSyncFormat(): Promise<void> {
  if ((await getSetting<number>(FORMAT_SETTING, 0)) === SYNC_FORMAT) return
  await resetSyncLocalState()
  await db.settings.delete(LEGACY_KEY_SETTING)
  await setSetting(FORMAT_SETTING, SYNC_FORMAT)
}

export async function disconnectSync(): Promise<void> {
  await signOut(getSupabaseConfig())
  await db.settings.delete(LAST_SYNC_SETTING)
  await resetSyncLocalState()
  setState({ status: 'idle', error: null })
  await refreshSyncState()
}

/** Menghapus semua data cloud akun ini (data lokal tetap), lalu mengunggah ulang dari perangkat ini. */
export async function resetCloudData(): Promise<void> {
  await makeRemote().deleteAll()
  await db.settings.delete(LAST_SYNC_SETTING)
  await resetSyncLocalState()
  await refreshSyncState()
  void syncNow()
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

  listenForNativeLogin(() => {
    void (async () => {
      const config = getSupabaseConfig()
      if (!config) return
      try {
        const failure = await consumePendingOAuth(config)
        if (failure) setState({ status: 'error', error: failure })
      } catch (caught) {
        setState({ status: 'error', error: errorMessage(caught) })
      }
      await refreshSyncState()
      void syncNow()
    })()
  })

  let timer: number | undefined
  const schedule = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      // Catat waktu perubahan segera (juga saat offline), baru sinkronkan bila memungkinkan.
      void (async () => {
        if (await loadSession()) await markLocalChanges().catch(() => undefined)
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
