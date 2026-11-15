import Dexie, { type Table } from 'dexie'
import type {
  Account,
  Budget,
  Category,
  Debt,
  DebtPayment,
  Goal,
  GoalContribution,
  RecurringTransaction,
  SettingRow,
  Transaction,
  Transfer,
} from '../types'
import { BUDGET_LEGACY_MONTH } from '../lib/constants'

class UangkuDB extends Dexie {
  accounts!: Table<Account, string>
  categories!: Table<Category, string>
  transactions!: Table<Transaction, string>
  settings!: Table<SettingRow, string>
  budgets!: Table<Budget, string>
  recurringTransactions!: Table<RecurringTransaction, string>
  transfers!: Table<Transfer, string>
  goals!: Table<Goal, string>
  goalContributions!: Table<GoalContribution, string>
  debts!: Table<Debt, string>
  debtPayments!: Table<DebtPayment, string>

  constructor() {
    super('rf-uangku')
    this.version(1).stores({
      accounts: 'id, sortOrder, archived',
      categories: 'id, type, sortOrder, archived',
      transactions:
        'id, occurredAt, type, accountId, categoryId, updatedAt, [type+occurredAt], [accountId+occurredAt]',
      settings: 'key',
    })
    this.version(2).stores({
      transactions:
        'id, occurredAt, type, accountId, categoryId, updatedAt, recurringId, [type+occurredAt], [accountId+occurredAt]',
      budgets: 'id, &categoryId',
      recurringTransactions: 'id, nextRunAt, accountId, categoryId',
    })
    this.version(3).stores({
      transfers: 'id, occurredAt, fromAccountId, toAccountId',
    })
    // v4: riwayat budget per bulan. categoryId tidak lagi unik; satu kategori
    // bisa punya beberapa baris dengan bulan mulai berlaku berbeda.
    this.version(4)
      .stores({
        budgets: 'id, categoryId, [categoryId+effectiveFrom]',
      })
      .upgrade((tx) =>
        tx
          .table('budgets')
          .toCollection()
          .modify((row: { effectiveFrom?: string }) => {
            if (!row.effectiveFrom) row.effectiveFrom = BUDGET_LEGACY_MONTH
          }),
      )
    // v5: target tabungan dan hutang/piutang.
    this.version(5).stores({
      goals: 'id, deadline',
      goalContributions: 'id, goalId, occurredAt',
      debts: 'id, direction, dueDate',
      debtPayments: 'id, debtId, occurredAt',
    })
  }
}

export const db = new UangkuDB()

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return row ? (row.value as T) : fallback
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}

export async function deleteSetting(key: string): Promise<void> {
  await db.settings.delete(key)
}
