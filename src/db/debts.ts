import { db } from './db'
import { isIsoDate } from '../lib/dateMath'
import { createId } from '../lib/utils'
import type { Debt, DebtDirection, DebtPayment } from '../types'

export const DEBT_PERSON_MAX_LENGTH = 60

export interface DebtInput {
  direction: DebtDirection
  person: string
  amount: number
  dueDate?: string
  note?: string
  /** Rekening tempat uang masuk/keluar (opsional). */
  accountId?: string
}

async function assertAccountExists(accountId?: string): Promise<void> {
  if (accountId && !(await db.accounts.get(accountId))) {
    throw new Error('Rekening tidak ditemukan.')
  }
}

function cleanDebt(input: DebtInput): Omit<Debt, 'id' | 'createdAt' | 'updatedAt'> {
  const person = input.person.trim()
  if (!person) throw new Error('Nama orang/pihak wajib diisi.')
  if (person.length > DEBT_PERSON_MAX_LENGTH) {
    throw new Error(`Nama maksimal ${DEBT_PERSON_MAX_LENGTH} karakter.`)
  }
  if (input.direction !== 'owe' && input.direction !== 'lent') {
    throw new Error('Jenis hutang/piutang tidak valid.')
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Nominal harus lebih dari 0.')
  }
  if (input.dueDate && !isIsoDate(input.dueDate)) throw new Error('Jatuh tempo tidak valid.')
  return {
    direction: input.direction,
    person,
    amount: input.amount,
    dueDate: input.dueDate || undefined,
    note: input.note?.trim() || '',
    accountId: input.accountId || undefined,
  }
}

async function paidTotal(debtId: string): Promise<number> {
  const payments = await db.debtPayments.where('debtId').equals(debtId).toArray()
  return payments.reduce((sum, payment) => sum + payment.amount, 0)
}

export async function createDebt(input: DebtInput): Promise<Debt> {
  const clean = cleanDebt(input)
  await assertAccountExists(clean.accountId)
  const now = new Date().toISOString()
  const debt: Debt = { id: createId(), ...clean, createdAt: now, updatedAt: now }
  await db.debts.add(debt)
  return debt
}

export async function updateDebt(id: string, input: DebtInput): Promise<void> {
  const clean = cleanDebt(input)
  await db.transaction('rw', db.debts, db.debtPayments, db.accounts, async () => {
    if (!(await db.debts.get(id))) throw new Error('Data tidak ditemukan.')
    await assertAccountExists(clean.accountId)
    if (clean.amount < (await paidTotal(id))) {
      throw new Error('Nominal tidak boleh lebih kecil dari total yang sudah dibayar.')
    }
    await db.debts.update(id, { ...clean, updatedAt: new Date().toISOString() })
  })
}

export async function deleteDebt(id: string): Promise<void> {
  await db.transaction('rw', db.debts, db.debtPayments, async () => {
    await db.debtPayments.where('debtId').equals(id).delete()
    await db.debts.delete(id)
  })
}

export interface DebtPaymentInput {
  debtId: string
  amount: number
  occurredAt: string
  note?: string
  accountId?: string
}

export async function addDebtPayment(input: DebtPaymentInput): Promise<DebtPayment> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Nominal harus lebih dari 0.')
  }
  if (!isIsoDate(input.occurredAt)) throw new Error('Tanggal tidak valid.')

  return db.transaction('rw', db.debts, db.debtPayments, db.accounts, async () => {
    await assertAccountExists(input.accountId)
    const debt = await db.debts.get(input.debtId)
    if (!debt) throw new Error('Data tidak ditemukan.')
    const remaining = debt.amount - (await paidTotal(input.debtId))
    if (input.amount > remaining) {
      throw new Error('Nominal melebihi sisa yang harus dibayar.')
    }
    const row: DebtPayment = {
      id: createId(),
      debtId: input.debtId,
      amount: input.amount,
      accountId: input.accountId || undefined,
      occurredAt: input.occurredAt,
      note: input.note?.trim() || '',
      createdAt: new Date().toISOString(),
    }
    await db.debtPayments.add(row)
    return row
  })
}

export async function deleteDebtPayment(id: string): Promise<void> {
  await db.debtPayments.delete(id)
}
