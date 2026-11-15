import { db } from './db'
import { isMonthKey, monthKey } from '../lib/dates'
import { resolveBudgets } from '../lib/budget'
import { createId } from '../lib/utils'
import type { Budget } from '../types'

export interface BudgetInput {
  categoryId: string
  amount: number
  /** Bulan mulai berlaku (YYYY-MM). Default: bulan ini. */
  month?: string
}

/**
 * Menetapkan limit budget yang berlaku mulai `month` sampai ada perubahan
 * berikutnya. Bulan sebelumnya tetap memakai limit lama.
 */
export async function upsertBudget(input: BudgetInput): Promise<Budget> {
  const month = input.month ?? monthKey()
  if (!isMonthKey(month)) throw new Error('Bulan budget tidak valid.')
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Batas budget harus lebih dari 0.')
  }

  const now = new Date().toISOString()
  const existing = await db.budgets
    .where('[categoryId+effectiveFrom]')
    .equals([input.categoryId, month])
    .first()

  if (existing) {
    await db.budgets.update(existing.id, { amount: input.amount, updatedAt: now })
    return { ...existing, amount: input.amount, updatedAt: now }
  }

  const budget: Budget = {
    id: createId(),
    categoryId: input.categoryId,
    amount: input.amount,
    effectiveFrom: month,
    createdAt: now,
    updatedAt: now,
  }
  await db.budgets.add(budget)
  return budget
}

/**
 * Menghentikan budget kategori mulai `month`. Bulan sebelumnya tidak berubah:
 * jika ada limit dari bulan sebelumnya, dicatat baris penanda (amount 0) agar
 * limit itu tidak terus berlaku.
 */
export async function stopBudget(categoryId: string, month: string): Promise<void> {
  if (!isMonthKey(month)) throw new Error('Bulan budget tidak valid.')

  await db.transaction('rw', db.budgets, async () => {
    const rows = await db.budgets.where('categoryId').equals(categoryId).toArray()
    const atMonth = rows.filter((row) => row.effectiveFrom === month)
    const carriedIn =
      resolveBudgets(
        rows.filter((row) => row.effectiveFrom < month),
        month,
      ).length > 0

    if (atMonth.length > 0) await db.budgets.bulkDelete(atMonth.map((row) => row.id))
    if (carriedIn) {
      const now = new Date().toISOString()
      await db.budgets.add({
        id: createId(),
        categoryId,
        amount: 0,
        effectiveFrom: month,
        createdAt: now,
        updatedAt: now,
      })
    }
  })
}

export async function deleteBudget(id: string): Promise<void> {
  await db.budgets.delete(id)
}

export async function deleteBudgetForCategory(categoryId: string): Promise<void> {
  await db.budgets.where('categoryId').equals(categoryId).delete()
}
