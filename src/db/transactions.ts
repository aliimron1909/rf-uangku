import { db } from './db'
import { createId } from '../lib/utils'
import type { Transaction, TxType } from '../types'

export interface TransactionInput {
  type: TxType
  amount: number
  accountId: string
  categoryId: string
  occurredAt: string
  note?: string
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const now = new Date().toISOString()
  const transaction: Transaction = {
    id: createId(),
    ...input,
    note: input.note?.trim() || '',
    createdAt: now,
    updatedAt: now,
  }
  await db.transactions.add(transaction)
  return transaction
}

export async function updateTransaction(id: string, input: TransactionInput): Promise<void> {
  await db.transactions.update(id, {
    ...input,
    note: input.note?.trim() || '',
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteTransaction(id: string): Promise<void> {
  await db.transactions.delete(id)
}
