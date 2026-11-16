import { db } from './db'
import { createId } from '../lib/utils'
import type { Category, Transaction, Transfer } from '../types'

export interface TransferInput {
  fromAccountId: string
  toAccountId: string
  amount: number
  occurredAt: string
  note?: string
  /** Biaya admin opsional; dicatat sebagai pengeluaran dari rekening asal. */
  fee?: number
  recurringId?: string
}

export const FEE_CATEGORY_NAME = 'Biaya Admin'
export const FEE_TAG = 'biaya-admin'

async function assertValid(input: TransferInput): Promise<void> {
  if (!input.fromAccountId || !input.toAccountId) {
    throw new Error('Pilih rekening asal dan tujuan.')
  }
  if (input.fromAccountId === input.toAccountId) {
    throw new Error('Rekening asal dan tujuan tidak boleh sama.')
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Nominal transfer harus lebih dari 0.')
  }
  if (input.fee !== undefined && (!Number.isFinite(input.fee) || input.fee < 0)) {
    throw new Error('Biaya admin tidak valid.')
  }
  const [from, to] = await Promise.all([
    db.accounts.get(input.fromAccountId),
    db.accounts.get(input.toAccountId),
  ])
  if (!from || !to) throw new Error('Rekening transfer tidak ditemukan.')
}

/** Kategori pengeluaran "Biaya Admin"; dibuat otomatis bila belum ada. */
async function feeCategoryId(): Promise<string> {
  const categories = await db.categories.toArray()
  const existing = categories.find(
    (category) =>
      category.type === 'expense' &&
      !category.archived &&
      category.name.trim().toLowerCase() === FEE_CATEGORY_NAME.toLowerCase(),
  )
  if (existing) return existing.id
  const category: Category = {
    id: createId(),
    name: FEE_CATEGORY_NAME,
    type: 'expense',
    color: '#64748b',
    sortOrder: categories.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1,
    archived: false,
    createdAt: new Date().toISOString(),
  }
  await db.categories.add(category)
  return category.id
}

async function feeNote(fromAccountId: string, toAccountId: string): Promise<string> {
  const [from, to] = await Promise.all([
    db.accounts.get(fromAccountId),
    db.accounts.get(toAccountId),
  ])
  return `Biaya admin transfer ${from?.name ?? ''} → ${to?.name ?? ''}`.trim()
}

/**
 * Menulis transfer (dan pengeluaran biaya admin bila ada). Harus dipanggil di dalam
 * transaksi Dexie yang mencakup tabel transfers, transactions, categories, accounts.
 */
export async function writeTransfer(input: TransferInput): Promise<Transfer> {
  await assertValid(input)
  const now = new Date().toISOString()
  const fee = input.fee && input.fee > 0 ? Math.round(input.fee) : 0

  let feeTransactionId: string | undefined
  if (fee > 0) {
    const transaction: Transaction = {
      id: createId(),
      type: 'expense',
      amount: fee,
      accountId: input.fromAccountId,
      categoryId: await feeCategoryId(),
      occurredAt: input.occurredAt,
      note: await feeNote(input.fromAccountId, input.toAccountId),
      tags: [FEE_TAG],
      createdAt: now,
      updatedAt: now,
    }
    await db.transactions.add(transaction)
    feeTransactionId = transaction.id
  }

  const transfer: Transfer = {
    id: createId(),
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    amount: input.amount,
    occurredAt: input.occurredAt,
    note: input.note?.trim() || '',
    ...(fee > 0 ? { fee, feeTransactionId } : {}),
    ...(input.recurringId ? { recurringId: input.recurringId } : {}),
    createdAt: now,
    updatedAt: now,
  }
  await db.transfers.add(transfer)
  return transfer
}

export async function createTransfer(input: TransferInput): Promise<Transfer> {
  return db.transaction('rw', db.transfers, db.transactions, db.categories, db.accounts, () =>
    writeTransfer(input),
  )
}

export async function updateTransfer(id: string, input: TransferInput): Promise<void> {
  await db.transaction(
    'rw',
    db.transfers,
    db.transactions,
    db.categories,
    db.accounts,
    async () => {
      await assertValid(input)
      const existing = await db.transfers.get(id)
      if (!existing) throw new Error('Transfer tidak ditemukan.')
      const now = new Date().toISOString()
      const fee = input.fee && input.fee > 0 ? Math.round(input.fee) : 0

      let feeTransactionId = existing.feeTransactionId
      const feeTx = feeTransactionId ? await db.transactions.get(feeTransactionId) : undefined

      if (fee > 0) {
        const note = await feeNote(input.fromAccountId, input.toAccountId)
        if (feeTx) {
          await db.transactions.update(feeTx.id, {
            amount: fee,
            accountId: input.fromAccountId,
            occurredAt: input.occurredAt,
            note,
            updatedAt: now,
          })
        } else {
          const transaction: Transaction = {
            id: createId(),
            type: 'expense',
            amount: fee,
            accountId: input.fromAccountId,
            categoryId: await feeCategoryId(),
            occurredAt: input.occurredAt,
            note,
            tags: [FEE_TAG],
            createdAt: now,
            updatedAt: now,
          }
          await db.transactions.add(transaction)
          feeTransactionId = transaction.id
        }
      } else if (feeTx) {
        await db.transactions.delete(feeTx.id)
        feeTransactionId = undefined
      }

      const next: Transfer = {
        ...existing,
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        amount: input.amount,
        occurredAt: input.occurredAt,
        note: input.note?.trim() || '',
        updatedAt: now,
      }
      if (fee > 0) {
        next.fee = fee
        next.feeTransactionId = feeTransactionId
      } else {
        delete next.fee
        delete next.feeTransactionId
      }
      await db.transfers.put(next)
    },
  )
}

export async function deleteTransfer(id: string): Promise<void> {
  await db.transaction('rw', db.transfers, db.transactions, async () => {
    const existing = await db.transfers.get(id)
    if (existing?.feeTransactionId) await db.transactions.delete(existing.feeTransactionId)
    await db.transfers.delete(id)
  })
}
