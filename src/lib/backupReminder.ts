const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Kartu "Backup data" hanya perlu muncul bila data berisi, backup manual sudah lama,
 * dan cloud tidak bisa dianggap sebagai cadangan (belum login atau sinkron terakhir > 7 hari).
 */
export function backupNeedsAttention(input: {
  hasData: boolean
  backupAgeMs: number
  signedIn: boolean
  lastSyncAt: string | null
  now?: number
}): boolean {
  if (!input.hasData || input.backupAgeMs <= WEEK_MS) return false
  const now = input.now ?? Date.now()
  const synced = input.lastSyncAt ? new Date(input.lastSyncAt).getTime() : NaN
  const cloudFresh = input.signedIn && Number.isFinite(synced) && now - synced <= WEEK_MS
  return !cloudFresh
}
