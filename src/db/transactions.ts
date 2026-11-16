import { db } from './db'
import { createId } from '../lib/utils'
import { normalizeTags } from '../lib/tags'
import { splitIssue, type SplitPart } from '../lib/split'
import { isReceiptDataUrl } from '../lib/receipts'
import type { Transaction, TrashItem, TxType } from '../types'

export interface TransactionInput {
  type: TxType
  amount: number
  accountId: string
  categoryId: string
  occurredAt: string
  note?: string
  tags?: string[]
  /** Struk yang sudah tersimpan dan ingin dipertahankan. */
  receiptId?: string
}

export interface SaveTransactionInput extends TransactionInput {
  /** Foto struk baru (data URL terkompres). Menggantikan `receiptId` bila diisi. */
  newReceiptDataUrl?: string
  /** Dua pecahan atau lebih = split; `amount` adalah total struk. */
  parts?: SplitPart[]
}

function buildRow(
  base: Pick<Transaction, 'id' | 'createdAt' | 'updatedAt'> & Partial<Transaction>,
  input: TransactionInput,
  categoryId: string,
  amount: number,
  receiptId: string | undefined,
): Transaction {
  const tags = normalizeTags(input.tags)
  const row: Transaction = {
    id: base.id,
    type: input.type,
    amount,
    accountId: input.accountId,
    categoryId,
    occurredAt: input.occurredAt,
    note: input.note?.trim() || '',
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
  }
  if (base.recurringId) row.recurringId = base.recurringId
  if (base.splitGroupId) row.splitGroupId = base.splitGroupId
  if (tags.length > 0) row.tags = tags
  if (receiptId) row.receiptId = receiptId
  return row
}

async function deleteOrphanReceipts(receiptIds: Iterable<string | undefined>): Promise<void> {
  for (const receiptId of new Set(receiptIds)) {
    if (!receiptId) continue
    const stillUsed = await db.transactions.where('receiptId').equals(receiptId).count()
    if (stillUsed === 0) await db.receipts.delete(receiptId)
  }
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const saved = await saveTransaction(null, input)
  return saved[0]
}

export async function updateTransaction(id: string, input: TransactionInput): Promise<void> {
  const existing = await db.transactions.get(id)
  if (!existing) throw new Error('Transaksi tidak ditemukan.')
  await saveTransaction(existing, input)
}

/**
 * Menyimpan transaksi baru atau perubahan transaksi lama dalam satu transaksi database.
 * Mendukung split (beberapa baris dengan `splitGroupId` sama) dan foto struk. Mengubah
 * transaksi biasa menjadi split, atau sebaliknya, menggantikan baris lama.
 */
export async function saveTransaction(
  existing: Transaction | null,
  input: SaveTransactionInput,
): Promise<Transaction[]> {
  const parts = input.parts && input.parts.length >= 2 ? input.parts : null
  if (parts) {
    const issue = splitIssue(input.amount, parts)
    if (issue) throw new Error(issue)
  }
  if (input.newReceiptDataUrl !== undefined && !isReceiptDataUrl(input.newReceiptDataUrl)) {
    throw new Error('Foto struk tidak valid atau terlalu besar.')
  }

  return db.transaction('rw', db.transactions, db.receipts, async () => {
    const now = new Date().toISOString()
    let members: Transaction[] = []
    if (existing) {
      const current = await db.transactions.get(existing.id)
      if (!current) throw new Error('Transaksi tidak ditemukan. Mungkin sudah dihapus.')
      members = current.splitGroupId
        ? await db.transactions.where('splitGroupId').equals(current.splitGroupId).toArray()
        : [current]
    }
    const oldReceiptIds = members.map((member) => member.receiptId)

    let receiptId = input.receiptId
    if (input.newReceiptDataUrl) {
      receiptId = createId()
      await db.receipts.add({ id: receiptId, dataUrl: input.newReceiptDataUrl, createdAt: now })
    }

    const createdAt = members[0]?.createdAt ?? now
    const rows: Transaction[] = []
    if (parts) {
      const splitGroupId = members[0]?.splitGroupId ?? createId()
      for (const part of parts) {
        rows.push(
          buildRow(
            { id: createId(), createdAt, updatedAt: now, splitGroupId },
            input,
            part.categoryId,
            part.amount,
            receiptId,
          ),
        )
      }
    } else {
      const reuse = members.length === 1 && !members[0].splitGroupId ? members[0] : null
      rows.push(
        buildRow(
          {
            id: reuse?.id ?? createId(),
            createdAt,
            updatedAt: now,
            recurringId: reuse?.recurringId,
          },
          input,
          input.categoryId,
          input.amount,
          receiptId,
        ),
      )
    }

    const keepIds = new Set(rows.map((row) => row.id))
    const removeIds = members.map((member) => member.id).filter((id) => !keepIds.has(id))
    if (removeIds.length > 0) await db.transactions.bulkDelete(removeIds)
    await db.transactions.bulkPut(rows)
    await deleteOrphanReceipts(oldReceiptIds)
    return rows
  })
}

export const TRASH_RETENTION_DAYS = 30

/**
 * Memindahkan transaksi ke tempat sampah; bila bagian dari split, seluruh pecahan struk ikut.
 * Mengembalikan ID item sampah (null bila transaksi tidak ditemukan).
 */
export async function deleteTransaction(id: string): Promise<string | null> {
  return db.transaction('rw', db.transactions, db.receipts, db.trash, async () => {
    const current = await db.transactions.get(id)
    if (!current) return null
    const members = current.splitGroupId
      ? await db.transactions.where('splitGroupId').equals(current.splitGroupId).toArray()
      : [current]
    const receiptId = members.find((member) => member.receiptId)?.receiptId
    const receipt = receiptId ? await db.receipts.get(receiptId) : undefined
    const item: TrashItem = {
      id: createId(),
      transactions: members,
      ...(receipt ? { receipt } : {}),
      deletedAt: new Date().toISOString(),
    }
    await db.trash.add(item)
    await db.transactions.bulkDelete(members.map((member) => member.id))
    await deleteOrphanReceipts(members.map((member) => member.receiptId))
    return item.id
  })
}

/** Memulihkan item sampah. Gagal bila rekening/kategori transaksinya sudah dihapus permanen. */
export async function restoreFromTrash(trashId: string): Promise<number> {
  return db.transaction(
    'rw',
    [db.transactions, db.receipts, db.trash, db.accounts, db.categories],
    async () => {
      const item = await db.trash.get(trashId)
      if (!item) throw new Error('Item sampah tidak ditemukan.')
      for (const transaction of item.transactions) {
        const [account, category] = await Promise.all([
          db.accounts.get(transaction.accountId),
          db.categories.get(transaction.categoryId),
        ])
        if (!account || !category) {
          throw new Error('Tidak bisa dipulihkan: rekening atau kategori transaksi ini sudah dihapus.')
        }
      }
      if (item.receipt) await db.receipts.put(item.receipt)
      await db.transactions.bulkPut(item.transactions)
      await db.trash.delete(trashId)
      return item.transactions.length
    },
  )
}

export async function deleteTrashItem(trashId: string): Promise<void> {
  await db.trash.delete(trashId)
}

export async function emptyTrash(): Promise<void> {
  await db.trash.clear()
}

/** Menghapus permanen item yang lebih lama dari masa simpan. Mengembalikan jumlah yang dihapus. */
export async function purgeExpiredTrash(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * 86_400_000).toISOString()
  return db.trash.where('deletedAt').below(cutoff).delete()
}

export interface ImportedRow {
  date: string
  description: string
  amount: number
  type: TxType
  categoryId: string
}

/** Menyimpan banyak transaksi hasil impor sekaligus (semua berhasil atau tidak sama sekali). */
export async function importTransactions(
  rows: ImportedRow[],
  accountId: string,
  tags: string[] = ['impor'],
): Promise<number> {
  if (rows.length === 0) return 0
  return db.transaction('rw', db.transactions, db.accounts, db.categories, async () => {
    if (!(await db.accounts.get(accountId))) throw new Error('Rekening tujuan tidak ditemukan.')
    const categoryIds = new Set(rows.map((row) => row.categoryId))
    for (const id of categoryIds) {
      if (!id || !(await db.categories.get(id))) {
        throw new Error('Ada transaksi tanpa kategori yang valid. Pilih kategori untuk semua baris.')
      }
    }
    const now = new Date().toISOString()
    const normalizedTags = normalizeTags(tags)
    const transactions: Transaction[] = rows.map((row) => ({
      id: createId(),
      type: row.type,
      amount: row.amount,
      accountId,
      categoryId: row.categoryId,
      occurredAt: row.date,
      note: row.description,
      ...(normalizedTags.length > 0 ? { tags: normalizedTags } : {}),
      createdAt: now,
      updatedAt: now,
    }))
    await db.transactions.bulkAdd(transactions)
    return transactions.length
  })
}
