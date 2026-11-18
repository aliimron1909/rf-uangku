import { getSetting, setSetting } from '../db/db'
import { isNativeApp, nativePlugin } from './native'
import {
  BANK_NOTIF_ENABLED_KEY,
  BANK_NOTIF_PENDING_KEY,
  mergePending,
  parseBankNotification,
  type PendingNotifTx,
  type RawBankNotif,
} from './bankNotif'

interface RfNotifPlugin {
  status(): Promise<{ access?: boolean; enabled?: boolean }>
  setEnabled(data: { enabled: boolean }): Promise<unknown>
  openAccessSettings(): Promise<unknown>
  openAppInfo(): Promise<unknown>
  drain(): Promise<{ items?: unknown }>
}

function plugin(): RfNotifPlugin | null {
  return isNativeApp() ? nativePlugin<RfNotifPlugin>('RfNotif') : null
}

export async function bankNotifStatus(): Promise<{ supported: boolean; access: boolean }> {
  const notif = plugin()
  if (!notif) return { supported: false, access: false }
  try {
    const status = await notif.status()
    return { supported: true, access: Boolean(status.access) }
  } catch {
    return { supported: false, access: false }
  }
}

export async function setBankNotifEnabled(enabled: boolean): Promise<void> {
  await setSetting(BANK_NOTIF_ENABLED_KEY, enabled)
  await plugin()?.setEnabled({ enabled })
}

export const openNotifAccessSettings = () => plugin()?.openAccessSettings()
export const openAppInfoSettings = () => plugin()?.openAppInfo()

export async function getPendingNotifs(): Promise<PendingNotifTx[]> {
  return getSetting<PendingNotifTx[]>(BANK_NOTIF_PENDING_KEY, [])
}

export async function removePendingNotif(id: string): Promise<void> {
  const list = await getPendingNotifs()
  await setSetting(BANK_NOTIF_PENDING_KEY, list.filter((item) => item.id !== id))
}

export async function clearPendingNotifs(): Promise<void> {
  await setSetting(BANK_NOTIF_PENDING_KEY, [])
}

/** Mengambil notifikasi baru dari antrean native, mengurai, lalu menambahkannya ke daftar tinjauan. Mengembalikan jumlah baru. */
export async function syncBankNotifications(): Promise<number> {
  const notif = plugin()
  if (!notif) return 0
  if (!(await getSetting<boolean>(BANK_NOTIF_ENABLED_KEY, false))) return 0
  const drained = await notif.drain()
  const items = Array.isArray(drained.items) ? (drained.items as RawBankNotif[]) : []
  const parsed = items
    .map((item) => parseBankNotification(item))
    .filter((item): item is PendingNotifTx => item !== null)
  if (parsed.length === 0) return 0
  const existing = await getPendingNotifs()
  const merged = mergePending(existing, parsed)
  await setSetting(BANK_NOTIF_PENDING_KEY, merged)
  return Math.max(0, merged.length - existing.length)
}
