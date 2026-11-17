import { db, getSetting, setSetting } from '../db/db'
import {
  DAILY_REMINDER_ENABLED_KEY,
  DAILY_REMINDER_TIME_KEY,
  DEFAULT_REMINDER_TIME,
  isValidReminderTime,
} from './dailyReminder'
import { getAccessToken, loadSession } from './sync/auth'
import { getSupabaseConfig } from './sync/config'
import { makeRemote } from './sync/controller'

/** Perangkat ini sudah berlangganan notifikasi push dari server. */
export const PUSH_ENABLED_KEY = 'pushEnabled'

export function getVapidPublicKey(): string | null {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  return env?.VITE_VAPID_PUBLIC_KEY?.trim() || null
}

export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  )
}

function urlBase64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function toBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  let binary = ''
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Mengirim jam, status, dan zona waktu pengingat ke server (bila push aktif dan sudah login). */
export async function syncReminderToServer(): Promise<void> {
  if (!getSupabaseConfig()) return
  if (!(await getSetting<boolean>(PUSH_ENABLED_KEY, false))) return
  if (!(await loadSession())) return
  const [enabled, time] = await Promise.all([
    getSetting<boolean>(DAILY_REMINDER_ENABLED_KEY, false),
    getSetting<string>(DAILY_REMINDER_TIME_KEY, DEFAULT_REMINDER_TIME),
  ])
  await makeRemote().saveReminderSettings({
    enabled,
    remindTime: isValidReminderTime(time) ? time : DEFAULT_REMINDER_TIME,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta',
  })
}

/** Meminta izin, berlangganan push, dan mendaftarkannya ke Supabase. */
export async function enablePush(): Promise<void> {
  const vapid = getVapidPublicKey()
  if (!vapid) throw new Error('Kunci VAPID belum diisi (VITE_VAPID_PUBLIC_KEY). Lihat docs/PUSH.md.')
  if (!pushSupported()) throw new Error('Browser ini tidak mendukung notifikasi push.')
  if (!(await loadSession())) throw new Error('Masuk dengan Google dulu di Sinkronisasi cloud.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Izin notifikasi tidak diberikan.')

  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBytes(vapid),
    }))

  await makeRemote().upsertPushSubscription({
    endpoint: subscription.endpoint,
    p256dh: toBase64Url(subscription.getKey('p256dh')),
    auth: toBase64Url(subscription.getKey('auth')),
    userAgent: navigator.userAgent,
  })
  await setSetting(PUSH_ENABLED_KEY, true)
  await syncReminderToServer()
}

export async function disablePush(): Promise<void> {
  const registration = await navigator.serviceWorker?.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) {
    try {
      if (await loadSession()) await makeRemote().deletePushSubscription(subscription.endpoint)
    } finally {
      await subscription.unsubscribe()
    }
  }
  await db.settings.delete(PUSH_ENABLED_KEY)
}

/** Meminta server mengirim satu notifikasi tes ke semua perangkat akun ini. */
export async function sendTestPush(): Promise<number> {
  const config = getSupabaseConfig()
  if (!config) throw new Error('Supabase belum dikonfigurasi.')
  const token = await getAccessToken(config)
  const response = await fetch(`${config.url}/functions/v1/daily-reminder`, {
    method: 'POST',
    headers: { apikey: config.anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (response.status === 404) throw new Error('Edge Function daily-reminder belum di-deploy. Lihat docs/PUSH.md.')
  if (!response.ok) throw new Error(`Gagal mengirim tes (${response.status}).`)
  const result = (await response.json()) as { sent?: number }
  return result.sent ?? 0
}
