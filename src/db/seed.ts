import { db } from './db'
import type { Account, Category } from '../types'

const CREATED_AT = new Date().toISOString()

export const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: 'acc-tunai',
    name: 'Tunai',
    kind: 'cash',
    openingBalance: 0,
    color: '#10b981',
    sortOrder: 1,
    archived: false,
    createdAt: CREATED_AT,
  },
  {
    id: 'acc-bca',
    name: 'BCA',
    kind: 'bank',
    openingBalance: 0,
    color: '#2563eb',
    sortOrder: 2,
    archived: false,
    createdAt: CREATED_AT,
  },
  {
    id: 'acc-bri',
    name: 'BRI',
    kind: 'bank',
    openingBalance: 0,
    color: '#1d4ed8',
    sortOrder: 3,
    archived: false,
    createdAt: CREATED_AT,
  },
  {
    id: 'acc-seabank',
    name: 'Seabank',
    kind: 'bank',
    openingBalance: 0,
    color: '#f97316',
    sortOrder: 4,
    archived: false,
    createdAt: CREATED_AT,
  },
  {
    id: 'acc-blue-bca',
    name: 'Blue BCA',
    kind: 'bank',
    openingBalance: 0,
    color: '#0ea5e9',
    sortOrder: 5,
    archived: false,
    createdAt: CREATED_AT,
  },
  {
    id: 'acc-bank-jago',
    name: 'Bank Jago',
    kind: 'bank',
    openingBalance: 0,
    color: '#8b5cf6',
    sortOrder: 6,
    archived: false,
    createdAt: CREATED_AT,
  },
  {
    id: 'acc-gopay',
    name: 'Gopay',
    kind: 'ewallet',
    openingBalance: 0,
    color: '#22c55e',
    sortOrder: 7,
    archived: false,
    createdAt: CREATED_AT,
  },
  {
    id: 'acc-shopeepay',
    name: 'Shopee Pay',
    kind: 'ewallet',
    openingBalance: 0,
    color: '#f43f5e',
    sortOrder: 8,
    archived: false,
    createdAt: CREATED_AT,
  },
  {
    id: 'acc-dana',
    name: 'Dana',
    kind: 'ewallet',
    openingBalance: 0,
    color: '#3b82f6',
    sortOrder: 9,
    archived: false,
    createdAt: CREATED_AT,
  },
]

export const DEFAULT_CATEGORIES: Category[] = [
  // Pemasukan
  {
    id: 'cat-inc-bagi-hasil',
    name: 'Bagi Hasil / Jaga Toko',
    type: 'income',
    color: '#10b981',
    sortOrder: 1,
    archived: false,
    createdAt: CREATED_AT,
  },
  {
    id: 'cat-inc-ojol',
    name: 'Pendapatan Ojol / Gojek',
    type: 'income',
    color: '#22c55e',
    sortOrder: 2,
    archived: false,
    createdAt: CREATED_AT,
  },
  {
    id: 'cat-inc-gaji',
    name: 'Gaji Utama',
    type: 'income',
    color: '#14b8a6',
    sortOrder: 3,
    archived: false,
    createdAt: CREATED_AT,
  },
  {
    id: 'cat-inc-lain',
    name: 'Lain-lain',
    type: 'income',
    color: '#64748b',
    sortOrder: 4,
    archived: false,
    createdAt: CREATED_AT,
  },
  // Pengeluaran
  {
    id: 'cat-exp-makan',
    name: 'Makan / Minum Harian',
    type: 'expense',
    color: '#f59e0b',
    sortOrder: 1,
    archived: false,
    createdAt: CREATED_AT,
  },
  {
    id: 'cat-exp-keluarga',
    name: 'Kebutuhan Keluarga dan Anak',
    type: 'expense',
    color: '#f43f5e',
    sortOrder: 2,
    archived: false,
    createdAt: CREATED_AT,
  },
  {
    id: 'cat-exp-tagihan',
    name: 'Tagihan',
    type: 'expense',
    color: '#ef4444',
    sortOrder: 3,
    archived: false,
    createdAt: CREATED_AT,
  },
  {
    id: 'cat-exp-renovasi',
    name: 'Renovasi Rumah',
    type: 'expense',
    color: '#f97316',
    sortOrder: 4,
    archived: false,
    createdAt: CREATED_AT,
  },
  {
    id: 'cat-exp-hiburan',
    name: 'Hiburan Keluarga',
    type: 'expense',
    color: '#8b5cf6',
    sortOrder: 5,
    archived: false,
    createdAt: CREATED_AT,
  },
  {
    id: 'cat-exp-sedekah',
    name: 'Sedekah',
    type: 'expense',
    color: '#06b6d4',
    sortOrder: 6,
    archived: false,
    createdAt: CREATED_AT,
  },
  {
    id: 'cat-exp-lain',
    name: 'Lain-lain',
    type: 'expense',
    color: '#64748b',
    sortOrder: 7,
    archived: false,
    createdAt: CREATED_AT,
  },
]

export async function seedIfEmpty(): Promise<void> {
  const [accountCount, categoryCount] = await Promise.all([
    db.accounts.count(),
    db.categories.count(),
  ])

  if (accountCount > 0 && categoryCount > 0) return

  await db.transaction('rw', db.accounts, db.categories, async () => {
    if (accountCount === 0) await db.accounts.bulkAdd(DEFAULT_ACCOUNTS)
    if (categoryCount === 0) await db.categories.bulkAdd(DEFAULT_CATEGORIES)
  })
}

export async function resetMasterData(): Promise<void> {
  await db.transaction(
    'rw',
    db.accounts,
    db.categories,
    db.transactions,
    db.budgets,
    db.recurringTransactions,
    async () => {
      await db.transactions.clear()
      await db.budgets.clear()
      await db.recurringTransactions.clear()
      await db.accounts.clear()
      await db.categories.clear()
      await db.accounts.bulkAdd(DEFAULT_ACCOUNTS)
      await db.categories.bulkAdd(DEFAULT_CATEGORIES)
    },
  )
}
