import type { Table } from 'dexie'
import { db, getSetting, setSetting } from '../../db/db'
import type { SyncStateRow } from '../../types'
import { hashRecord } from './stable'

/** Tabel data yang disinkronkan. Pengaturan (PIN, API key, tema) sengaja tidak ikut. */
export const SYNC_TABLE_NAMES = [
  'accounts',
  'categories',
  'transactions',
  'budgets',
  'recurringTransactions',
  'transfers',
  'goals',
  'goalContributions',
  'debts',
  'debtPayments',
  'favorites',
  'receipts',
  'kprSimulations',
  'trash',
] as const

export type SyncTableName = (typeof SYNC_TABLE_NAMES)[number]

export const SYNC_CURSOR_KEY = 'syncCursor'

export interface RemoteRow {
  key: string
  /** Isi record (JSON biasa); null untuk tombstone. */
  data: unknown | null
  deleted: boolean
  clientTs: number
  serverTs: string
}

export type PushRow = Omit<RemoteRow, 'serverTs'>

/** Antarmuka server; implementasi nyata ada di supabaseRemote.ts, tes memakai versi memori. */
export interface SyncRemote {
  /** Semua baris dengan serverTs >= since (inklusif; penerapan bersifat idempoten). */
  pull(since: string | null): Promise<RemoteRow[]>
  push(rows: PushRow[]): Promise<void>
}

export interface SyncReport {
  pulled: number
  applied: number
  pushed: number
  firstSync: boolean
}

type AnyTable = Table<{ id: string }, string>

function tableFor(name: SyncTableName): AnyTable {
  return db.table(name) as unknown as AnyTable
}

export function recordKey(table: SyncTableName, id: string): string {
  return `${table}|${id}`
}

export function parseRecordKey(key: string): { table: SyncTableName; id: string } | null {
  const index = key.indexOf('|')
  if (index <= 0) return null
  const table = key.slice(0, index)
  const id = key.slice(index + 1)
  if (!id || !(SYNC_TABLE_NAMES as readonly string[]).includes(table)) return null
  return { table: table as SyncTableName, id }
}

const PUSH_BATCH_ROWS = 50
const PUSH_BATCH_CHARS = 1_500_000

/**
 * Mendeteksi perubahan lokal dengan membandingkan hash record dengan catatan terakhir.
 * Mengubah `state` dan mengembalikan baris yang perlu disimpan.
 */
async function scanLocal(
  state: Map<string, SyncStateRow>,
  now: () => number,
): Promise<SyncStateRow[]> {
  const changed: SyncStateRow[] = []
  const timestamp = (previous?: SyncStateRow) => Math.max(now(), (previous?.ts ?? 0) + 1)
  for (const name of SYNC_TABLE_NAMES) {
    const records = await tableFor(name).toArray()
    const seen = new Set<string>()
    for (const record of records) {
      const key = recordKey(name, record.id)
      seen.add(key)
      const hash = hashRecord(record)
      const existing = state.get(key)
      if (!existing || existing.deleted || existing.hash !== hash) {
        const row: SyncStateRow = {
          key,
          hash,
          ts: timestamp(existing),
          pushed: false,
          deleted: false,
        }
        state.set(key, row)
        changed.push(row)
      }
    }
    const prefix = `${name}|`
    for (const [key, existing] of state) {
      if (!key.startsWith(prefix) || existing.deleted || seen.has(key)) continue
      const row: SyncStateRow = {
        key,
        hash: '',
        ts: timestamp(existing),
        pushed: false,
        deleted: true,
      }
      state.set(key, row)
      changed.push(row)
    }
  }
  return changed
}

/**
 * Mencatat perubahan lokal beserta waktunya tanpa memakai jaringan. Dipanggil segera setelah
 * data berubah (walau offline) supaya waktu versi mencerminkan saat edit, bukan saat sinkron.
 */
export async function markLocalChanges(now: () => number = Date.now): Promise<number> {
  const state = new Map<string, SyncStateRow>(
    (await db.syncState.toArray()).map((row) => [row.key, row]),
  )
  const changed = await scanLocal(state, now)
  if (changed.length > 0) await db.syncState.bulkPut(changed)
  return changed.length
}

/**
 * Satu putaran sinkronisasi dua arah.
 *
 * - Perubahan lokal dideteksi dengan membandingkan hash record dengan catatan terakhir
 *   (tanpa hook), jadi restore, reset, dan edit dari mana pun otomatis terdeteksi.
 * - Konflik per record diselesaikan "versi terbaru menang" memakai waktu deteksi
 *   perubahan; penghapusan disebarkan sebagai tombstone.
 * - Pada sinkronisasi pertama sebuah perangkat, data cloud didahulukan agar data bawaan
 *   (rekening/kategori default) tidak menimpa perubahan yang sudah ada di cloud.
 */
export async function syncOnce(options: {
  remote: SyncRemote
  now?: () => number
}): Promise<SyncReport> {
  const now = options.now ?? Date.now
  const cursor = await getSetting<string | null>(SYNC_CURSOR_KEY, null)
  const firstSync = cursor === null
  const state = new Map<string, SyncStateRow>(
    (await db.syncState.toArray()).map((row) => [row.key, row]),
  )
  const report: SyncReport = { pulled: 0, applied: 0, pushed: 0, firstSync }

  let nextCursor = cursor
  const pull = async (remoteWins: boolean) => {
    const rows = await options.remote.pull(cursor)
    report.pulled += rows.length
    for (const row of rows) {
      if (!nextCursor || row.serverTs > nextCursor) nextCursor = row.serverTs
      const parsed = parseRecordKey(row.key)
      if (!parsed) continue
      const existing = state.get(row.key)
      if (!remoteWins && existing) {
        if (existing.pushed && existing.ts === row.clientTs) continue
        if (existing.ts > row.clientTs) continue
      }

      let record: { id: string } | null = null
      if (!row.deleted) {
        const value = row.data
        if (
          !value ||
          typeof value !== 'object' ||
          (value as { id?: unknown }).id !== parsed.id
        ) {
          continue
        }
        record = value as { id: string }
      }

      const table = tableFor(parsed.table)
      let next!: SyncStateRow
      await db.transaction('rw', table, db.syncState, async () => {
        if (record) {
          await table.put(record)
          const stored = await table.get(parsed.id)
          next = {
            key: row.key,
            hash: hashRecord(stored),
            ts: row.clientTs,
            pushed: true,
            deleted: false,
          }
        } else {
          await table.delete(parsed.id)
          next = { key: row.key, hash: '', ts: row.clientTs, pushed: true, deleted: true }
        }
        await db.syncState.put(next)
      })
      state.set(row.key, next)
      report.applied += 1
    }
  }

  if (firstSync) await pull(true)

  const changed = await scanLocal(state, now)
  if (changed.length > 0) await db.syncState.bulkPut(changed)

  if (!firstSync) await pull(false)

  // Kirim perubahan yang belum terkirim.
  const pending = Array.from(state.values()).filter((row) => !row.pushed)
  let batch: PushRow[] = []
  let batchStates: SyncStateRow[] = []
  let batchChars = 0
  const flush = async () => {
    if (batch.length === 0) return
    await options.remote.push(batch)
    const done = batchStates.map((row) => ({ ...row, pushed: true }))
    await db.syncState.bulkPut(done)
    for (const row of done) state.set(row.key, row)
    report.pushed += done.length
    batch = []
    batchStates = []
    batchChars = 0
  }
  for (const row of pending) {
    const parsed = parseRecordKey(row.key)
    if (!parsed) continue
    let pushRow: PushRow
    if (row.deleted) {
      pushRow = { key: row.key, data: null, deleted: true, clientTs: row.ts }
    } else {
      const record = await tableFor(parsed.table).get(parsed.id)
      if (!record) continue // Dihapus saat sinkronisasi berjalan; putaran berikutnya mengirim tombstone.
      pushRow = { key: row.key, data: record, deleted: false, clientTs: row.ts }
    }
    const size = (pushRow.data ? JSON.stringify(pushRow.data).length : 0) + 200
    if (batch.length >= PUSH_BATCH_ROWS || (batch.length > 0 && batchChars + size > PUSH_BATCH_CHARS)) {
      await flush()
    }
    batch.push(pushRow)
    batchStates.push(row)
    batchChars += size
  }
  await flush()

  await setSetting(SYNC_CURSOR_KEY, nextCursor ?? '')
  return report
}

/** Melupakan status sinkronisasi lokal (data tetap ada); dipakai saat putus dari cloud. */
export async function resetSyncLocalState(): Promise<void> {
  await db.syncState.clear()
  await db.settings.delete(SYNC_CURSOR_KEY)
}
