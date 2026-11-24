import Dexie, { type Table } from 'dexie'
import type {
  Account,
  Budget,
  Category,
  Debt,
  DebtPayment,
  Favorite,
  Goal,
  KprSimulation,
  GoalContribution,
  Receipt,
  RecurringTransaction,
  SettingRow,
  SyncStateRow,
  TrashItem,
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
  favorites!: Table<Favorite, string>
  receipts!: Table<Receipt, string>
  kprSimulations!: Table<KprSimulation, string>
  syncState!: Table<SyncStateRow, string>
  trash!: Table<TrashItem, string>

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
    // v6: template transaksi favorit.
    this.version(6).stores({
      favorites: 'id, useCount, lastUsedAt, accountId, categoryId',
    })
    // v7: tag (multiEntry), split transaksi, dan foto struk.
    this.version(7).stores({
      transactions:
        'id, occurredAt, type, accountId, categoryId, updatedAt, recurringId, splitGroupId, receiptId, *tags, [type+occurredAt], [accountId+occurredAt]',
      receipts: 'id, createdAt',
    })
    // v8: catatan status sinkronisasi cloud per record (hash terakhir, waktu versi, sudah terkirim).
    this.version(8).stores({
      syncState: 'key',
    })
    // v9: tempat sampah transaksi.
    this.version(9).stores({
      trash: 'id, deletedAt',
    })
    // v10: simulasi cicilan KPR.
    this.version(10).stores({
      kprSimulations: 'id, updatedAt',
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
