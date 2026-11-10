import { db } from './db'
import { createId } from '../lib/utils'
import type { Budget } from '../types'

export interface BudgetInput {
  categoryId: string
  amount: number
}

export async function upsertBudget(input: BudgetInput): Promise<Budget> {
  const now = new Date().toISOString()
  const existing = await db.budgets.where('categoryId').equals(input.categoryId).first()

  if (existing) {
    await db.budgets.update(existing.id, { amount: input.amount, updatedAt: now })
    return { ...existing, amount: input.amount, updatedAt: now }
  }

  const budget: Budget = {
    id: createId(),
    categoryId: input.categoryId,
    amount: input.amount,
    createdAt: now,
    updatedAt: now,
  }
  await db.budgets.add(budget)
  return budget
}

export async function deleteBudget(id: string): Promise<void> {
  await db.budgets.delete(id)
}

export async function deleteBudgetForCategory(categoryId: string): Promise<void> {
  await db.budgets.where('categoryId').equals(categoryId).delete()
}

export async function getBudgetForCategory(categoryId: string): Promise<Budget | undefined> {
  return db.budgets.where('categoryId').equals(categoryId).first()
}
