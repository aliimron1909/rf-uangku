import Dexie, { type Table } from 'dexie'
import type {
  Account,
  Budget,
  Category,
  RecurringTransaction,
  SettingRow,
  Transaction,
} from '../types'

class UangkuDB extends Dexie {
  accounts!: Table<Account, string>
  categories!: Table<Category, string>
  transactions!: Table<Transaction, string>
  settings!: Table<SettingRow, string>
  budgets!: Table<Budget, string>
  recurringTransactions!: Table<RecurringTransaction, string>

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
