import type {
  Budget,
  BudgetProgress,
  BudgetStatus,
  BudgetSummary,
  Category,
  Transaction,
} from '../types'
import { BUDGET_LEGACY_MONTH } from './constants'
import { categoryLabel } from './categoryTree'

interface MonthRange {
  start: string
  end: string
  label?: string
}

function statusFor(percentage: number): BudgetStatus {
  if (percentage >= 100) return 'over'
  if (percentage >= 80) return 'warning'
  return 'safe'
}

function statusRank(status: BudgetStatus): number {
  if (status === 'over') return 3
  if (status === 'warning') return 2
  return 1
}

/**
 * Budget yang berlaku untuk bulan tertentu: per kategori dipakai baris dengan
 * bulan mulai terbaru yang tidak melewati `monthKey`. Baris dengan amount 0
 * berarti budget dihentikan sejak bulan itu.
 */
export function resolveBudgets(budgets: Budget[], monthKey: string): Budget[] {
  const latest = new Map<string, Budget>()

  for (const budget of budgets) {
    const from = budget.effectiveFrom || BUDGET_LEGACY_MONTH
    if (from > monthKey) continue
    const current = latest.get(budget.categoryId)
    const currentFrom = current ? current.effectiveFrom || BUDGET_LEGACY_MONTH : ''
    if (
      !current ||
      from > currentFrom ||
      (from === currentFrom && budget.updatedAt > current.updatedAt)
    ) {
      latest.set(budget.categoryId, budget)
    }
  }

  return Array.from(latest.values()).filter((budget) => budget.amount > 0)
}

export function budgetProgress(
  budgets: Budget[],
  transactions: Transaction[],
  categories: Category[],
  month: MonthRange,
): BudgetProgress[] {
  const spentByCategory = new Map<string, number>()

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue
    if (transaction.occurredAt < month.start || transaction.occurredAt > month.end) continue
    spentByCategory.set(
      transaction.categoryId,
      (spentByCategory.get(transaction.categoryId) ?? 0) + transaction.amount,
    )
  }

  return resolveBudgets(budgets, month.start.slice(0, 7))
    .map((budget): BudgetProgress | null => {
      const category = categories.find((item) => item.id === budget.categoryId)
      if (!category || category.type !== 'expense') return null

      const spent = spentByCategory.get(budget.categoryId) ?? 0
      const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0

      return {
        budgetId: budget.id,
        categoryId: budget.categoryId,
        categoryName: categoryLabel(category, categories),
        categoryColor: category.color,
        categoryIcon: category.icon,
        categoryArchived: category.archived,
        limit: budget.amount,
        spent,
        remaining: budget.amount - spent,
        percentage,
        status: statusFor(percentage),
        effectiveFrom: budget.effectiveFrom || BUDGET_LEGACY_MONTH,
      }
    })
    .filter((row): row is BudgetProgress => row !== null)
    .sort(
      (a, b) =>
        statusRank(b.status) - statusRank(a.status) ||
        b.percentage - a.percentage ||
        a.categoryName.localeCompare(b.categoryName),
    )
}

export function budgetSummary(
  progress: BudgetProgress[],
  transactions: Transaction[],
  categories: Category[],
  month: MonthRange,
): BudgetSummary {
  const limit = progress.reduce((sum, item) => sum + item.limit, 0)
  const spent = progress.reduce((sum, item) => sum + item.spent, 0)
  const budgetedCategoryIds = new Set(progress.map((item) => item.categoryId))
  const expenseCategoryIds = new Set(
    categories.filter((category) => category.type === 'expense').map((category) => category.id),
  )

  const unbudgetedSpent = transactions.reduce((sum, transaction) => {
    if (transaction.type !== 'expense') return sum
    if (transaction.occurredAt < month.start || transaction.occurredAt > month.end) return sum
    if (!expenseCategoryIds.has(transaction.categoryId)) return sum
    if (budgetedCategoryIds.has(transaction.categoryId)) return sum
    return sum + transaction.amount
  }, 0)

  return {
    limit,
    spent,
    remaining: limit - spent,
    percentage: limit > 0 ? (spent / limit) * 100 : 0,
    overCount: progress.filter((item) => item.status === 'over').length,
    warningCount: progress.filter((item) => item.status === 'warning').length,
    unbudgetedSpent,
  }
}

export interface BudgetAlert {
  message: string
  type: 'info' | 'error'
}

export function newExpenseBudgetAlert(
  budgets: Budget[],
  transactions: Transaction[],
  categories: Category[],
  input: {
    type: Transaction['type']
    categoryId: string
    amount: number
    occurredAt: string
  },
): BudgetAlert | null {
  if (input.type !== 'expense') return null
  const monthKey = input.occurredAt.slice(0, 7)
  const budget = resolveBudgets(budgets, monthKey).find(
    (item) => item.categoryId === input.categoryId,
  )
  if (!budget || budget.amount <= 0) return null

  const spentBefore = transactions
    .filter(
      (item) =>
        item.type === 'expense' &&
        item.categoryId === input.categoryId &&
        item.occurredAt.slice(0, 7) === monthKey,
    )
    .reduce((sum, item) => sum + item.amount, 0)
  const percentageBefore = (spentBefore / budget.amount) * 100
  const percentageAfter = ((spentBefore + input.amount) / budget.amount) * 100
  const categoryName =
    categories.find((category) => category.id === input.categoryId)?.name ?? 'Kategori'

  if (percentageBefore < 100 && percentageAfter >= 100) {
    return {
      message: `Budget ${categoryName} terlampaui (${Math.round(percentageAfter)}%).`,
      type: 'error',
    }
  }
  if (percentageBefore < 80 && percentageAfter >= 80) {
    return {
      message: `Budget ${categoryName} sudah ${Math.round(percentageAfter)}% terpakai.`,
      type: 'info',
    }
  }
  return null
}

export function budgetStatusLabel(status: BudgetStatus): string {
  if (status === 'over') return 'Melewati budget'
  if (status === 'warning') return 'Hampir penuh'
  return 'Aman'
}

export function budgetBarClass(status: BudgetStatus): string {
  if (status === 'over') return 'bg-rose-500'
  if (status === 'warning') return 'bg-amber-500'
  return 'bg-emerald-500'
}

export function budgetTextClass(status: BudgetStatus): string {
  if (status === 'over') return 'text-rose-600 dark:text-rose-400'
  if (status === 'warning') return 'text-amber-600 dark:text-amber-400'
  return 'text-emerald-600 dark:text-emerald-400'
}
