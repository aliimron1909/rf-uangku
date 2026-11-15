import { db } from './db'
import { createId } from '../lib/utils'
import type { Transfer } from '../types'

export interface TransferInput {
  fromAccountId: string
  toAccountId: string
  amount: number
  occurredAt: string
  note?: string
}

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
  const [from, to] = await Promise.all([
    db.accounts.get(input.fromAccountId),
    db.accounts.get(input.toAccountId),
  ])
  if (!from || !to) throw new Error('Rekening transfer tidak ditemukan.')
}

export async function createTransfer(input: TransferInput): Promise<Transfer> {
  await assertValid(input)
  const now = new Date().toISOString()
  const transfer: Transfer = {
    id: createId(),
    ...input,
    note: input.note?.trim() || '',
    createdAt: now,
    updatedAt: now,
  }
  await db.transfers.add(transfer)
  return transfer
}

export async function updateTransfer(id: string, input: TransferInput): Promise<void> {
  await assertValid(input)
  await db.transfers.update(id, {
    ...input,
    note: input.note?.trim() || '',
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteTransfer(id: string): Promise<void> {
  await db.transfers.delete(id)
}
