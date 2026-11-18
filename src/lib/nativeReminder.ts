import { db, getSetting } from '../db/db'
import {
  DAILY_REMINDER_ENABLED_KEY,
  DAILY_REMINDER_TIME_KEY,
  DEFAULT_REMINDER_TIME,
  planReminderTimes,
} from './dailyReminder'
import { todayISO } from './dates'
import { isNativeApp, nativePlugin, noteNativeEvent } from './native'

interface LocalNotificationsPlugin {
  checkPermissions(): Promise<{ display: string }>
  requestPermissions(): Promise<{ display: string }>
  getPending(): Promise<{ notifications: { id: number }[] }>
  cancel(options: { notifications: { id: number }[] }): Promise<void>
  schedule(options: {
    notifications: {
      id: number
      title: string
      body: string
      schedule: { at: string; allowWhileIdle: boolean }
    }[]
  }): Promise<unknown>
  addListener(eventName: string, handler: (event: unknown) => void): unknown
}

/** ID notifikasi pengingat harian: 9001..9007 (hari ini sampai 6 hari ke depan). */
const ID_BASE = 9001
const ID_COUNT = 7

function plugin(): LocalNotificationsPlugin | null {
  return isNativeApp() ? nativePlugin<LocalNotificationsPlugin>('LocalNotifications') : null
}

export type NativeNotifPermission = 'granted' | 'denied' | 'prompt' | 'unsupported'

export async function nativeNotifPermission(): Promise<NativeNotifPermission> {
  const notifications = plugin()
  if (!notifications) return 'unsupported'
  try {
    const { display } = await notifications.checkPermissions()
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt'
  } catch {
    return 'unsupported'
  }
}

export async function requestNativeNotifPermission(): Promise<NativeNotifPermission> {
  const notifications = plugin()
  if (!notifications) return 'unsupported'
  try {
    const { display } = await notifications.requestPermissions()
    return display === 'granted' ? 'granted' : 'denied'
  } catch {
    return 'unsupported'
  }
}

/**
 * Menjadwalkan ulang pengingat harian sebagai notifikasi lokal Android (tanpa server/internet).
 * Aman dipanggil berulang: jadwal lama dibatalkan lalu dibuat ulang.
 */
export async function syncNativeReminders(): Promise<void> {
  const notifications = plugin()
  if (!notifications) return
  try {
    const enabled = await getSetting<boolean>(DAILY_REMINDER_ENABLED_KEY, false)
    const time = await getSetting<string>(DAILY_REMINDER_TIME_KEY, DEFAULT_REMINDER_TIME)
    const today = todayISO()
    const hasEntryToday =
      (await db.transactions.where('occurredAt').equals(today).count()) +
        (await db.transfers.where('occurredAt').equals(today).count()) >
      0
    await notifications.cancel({
      notifications: Array.from({ length: ID_COUNT }, (_, i) => ({ id: ID_BASE + i })),
    })
    const times = planReminderTimes({ enabled, time, now: new Date(), hasEntryToday, days: ID_COUNT })
    if (times.length === 0) return
    if ((await nativeNotifPermission()) !== 'granted') return
    const start = Math.round((times[0].getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
    await notifications.schedule({
      notifications: times.map((at, index) => ({
        id: ID_BASE + Math.max(0, start) + index,
        title: 'Pengingat catat uang',
        body: 'Belum ada catatan hari ini. Yuk catat pemasukan dan pengeluaranmu.',
        schedule: { at: at.toISOString(), allowWhileIdle: true },
      })),
    })
  } catch (caught) {
    noteNativeEvent(`pengingat lokal gagal: ${caught instanceof Error ? caught.message : 'galat'}`)
  }
}

/** Dipanggil saat pengguna mengetuk notifikasi pengingat. */
export function onNativeReminderTap(handler: () => void): void {
  try {
    plugin()?.addListener('localNotificationActionPerformed', handler)
  } catch {
    // Tanpa listener, mengetuk notifikasi tetap membuka aplikasi.
  }
}
