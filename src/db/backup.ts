import { db } from './db'
import type {
  Account,
  BackupData,
  Budget,
  Category,
  ProfileBackup,
  RecurringTransaction,
  Transaction,
} from '../types'
import { DEFAULT_PROFILE_NAME } from '../lib/constants'
import { PROFILE_PHOTO_MAX_DATA_URL_LENGTH } from '../lib/profile'

export async function buildBackup(): Promise<BackupData> {
  const [nameRow, photoRow] = await Promise.all([
    db.settings.get('profileName'),
    db.settings.get('profilePhoto'),
  ])
  const name = typeof nameRow?.value === 'string' ? nameRow.value.trim() : ''
  const photo = typeof photoRow?.value === 'string' ? photoRow.value.trim() : ''
  const profile: ProfileBackup | undefined =
    name || photo
      ? { name: name || DEFAULT_PROFILE_NAME, ...(photo ? { photo } : {}) }
      : undefined

  return {
    app: 'rf-uangku',
    version: 2,
    exportedAt: new Date().toISOString(),
    accounts: await db.accounts.toArray(),
    categories: await db.categories.toArray(),
    transactions: await db.transactions.toArray(),
    budgets: await db.budgets.toArray(),
    recurringTransactions: await db.recurringTransactions.toArray(),
    ...(profile ? { profile } : {}),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function isAccountRow(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    (value.kind === 'cash' || value.kind === 'bank' || value.kind === 'ewallet') &&
    typeof value.openingBalance === 'number' &&
    Number.isFinite(value.openingBalance) &&
    typeof value.color === 'string' &&
    typeof value.sortOrder === 'number' &&
    typeof value.archived === 'boolean' &&
    typeof value.createdAt === 'string'
  )
}

function isCategoryRow(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    (value.type === 'income' || value.type === 'expense') &&
    typeof value.color === 'string' &&
    typeof value.sortOrder === 'number' &&
    typeof value.archived === 'boolean' &&
    typeof value.createdAt === 'string'
  )
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isTransactionRow(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    (value.type === 'income' || value.type === 'expense') &&
    typeof value.amount === 'number' &&
    Number.isFinite(value.amount) &&
    value.amount > 0 &&
    typeof value.accountId === 'string' &&
    typeof value.categoryId === 'string' &&
    isDateString(value.occurredAt) &&
    (value.recurringId === undefined || typeof value.recurringId === 'string') &&
    typeof value.createdAt === 'string'
  )
}

function isBudgetRow(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.categoryId === 'string' &&
    typeof value.amount === 'number' &&
    Number.isFinite(value.amount) &&
    value.amount > 0 &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

function isRecurringRow(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    (value.type === 'income' || value.type === 'expense') &&
    typeof value.amount === 'number' &&
    Number.isFinite(value.amount) &&
    value.amount > 0 &&
    typeof value.accountId === 'string' &&
    typeof value.categoryId === 'string' &&
    (value.note === undefined || typeof value.note === 'string') &&
    (value.frequency === 'daily' ||
      value.frequency === 'weekly' ||
      value.frequency === 'monthly' ||
      value.frequency === 'yearly') &&
    typeof value.interval === 'number' &&
    Number.isInteger(value.interval) &&
    value.interval >= 1 &&
    isDateString(value.startDate) &&
    (value.endDate === undefined || isDateString(value.endDate)) &&
    isDateString(value.nextRunAt) &&
    (value.lastRunAt === undefined || isDateString(value.lastRunAt)) &&
    typeof value.active === 'boolean' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

function isProfileRow(value: unknown): value is ProfileBackup {
  if (!isRecord(value)) return false
  if (typeof value.name !== 'string' || !value.name.trim()) return false
  if (value.photo === undefined) return true
  return (
    typeof value.photo === 'string' &&
    value.photo.startsWith('data:image/') &&
    value.photo.length <= PROFILE_PHOTO_MAX_DATA_URL_LENGTH
  )
}

export function validateBackup(value: unknown): asserts value is BackupData {
  if (!value || typeof value !== 'object') {
    throw new Error('File backup tidak valid.')
  }
  const data = value as Partial<BackupData>
  if (data.app !== 'rf-uangku') {
    throw new Error('File ini bukan backup RF Uangku.')
  }
  if (data.version !== 1 && data.version !== 2) {
    throw new Error('Versi file backup tidak didukung.')
  }
  if (
    !Array.isArray(data.accounts) ||
    !Array.isArray(data.categories) ||
    !Array.isArray(data.transactions)
  ) {
    throw new Error('Struktur file backup tidak lengkap.')
  }
  if (!data.accounts.every(isAccountRow)) {
    throw new Error('Data rekening di file backup tidak valid.')
  }
  if (!data.categories.every(isCategoryRow)) {
    throw new Error('Data kategori di file backup tidak valid.')
  }
  if (!data.transactions.every(isTransactionRow)) {
    throw new Error('Data transaksi di file backup tidak valid.')
  }
  if (data.budgets !== undefined) {
    if (!Array.isArray(data.budgets) || !data.budgets.every(isBudgetRow)) {
      throw new Error('Data budget di file backup tidak valid.')
    }
  }
  if (data.recurringTransactions !== undefined) {
    if (
      !Array.isArray(data.recurringTransactions) ||
      !data.recurringTransactions.every(isRecurringRow)
    ) {
      throw new Error('Data transaksi berulang di file backup tidak valid.')
    }
  }
  if (data.profile !== undefined && !isProfileRow(data.profile)) {
    throw new Error('Data profil di file backup tidak valid.')
  }
  const budgets = data.budgets ?? []
  const recurringTransactions = data.recurringTransactions ?? []
  if (
    new Set(data.accounts.map((account) => account.id)).size !== data.accounts.length ||
    new Set(data.categories.map((category) => category.id)).size !== data.categories.length ||
    new Set(data.transactions.map((transaction) => transaction.id)).size !==
      data.transactions.length ||
    new Set(budgets.map((budget) => budget.id)).size !== budgets.length ||
    new Set(budgets.map((budget) => budget.categoryId)).size !== budgets.length ||
    new Set(recurringTransactions.map((rule) => rule.id)).size !== recurringTransactions.length
  ) {
    throw new Error('File backup berisi ID ganda.')
  }
  if (!data.accounts.some((account) => !account.archived)) {
    throw new Error('File backup harus memiliki minimal satu rekening aktif.')
  }
  if (!data.categories.some((category) => !category.archived && category.type === 'income')) {
    throw new Error('File backup harus memiliki minimal satu kategori pemasukan aktif.')
  }
  if (!data.categories.some((category) => !category.archived && category.type === 'expense')) {
    throw new Error('File backup harus memiliki minimal satu kategori pengeluaran aktif.')
  }
  const accountIds = new Set(data.accounts.map((account) => account.id))
  const categoryIds = new Set(data.categories.map((category) => category.id))
  if (
    !data.transactions.every(
      (transaction) =>
        accountIds.has(transaction.accountId) && categoryIds.has(transaction.categoryId),
    )
  ) {
    throw new Error('Transaksi di file backup merujuk rekening atau kategori yang tidak ada.')
  }

  const categoryMap = new Map(data.categories.map((category) => [category.id, category]))
  if (
    !budgets.every((budget) => {
      const category = categoryMap.get(budget.categoryId)
      return Boolean(category && category.type === 'expense')
    })
  ) {
    throw new Error('Budget di file backup harus memakai kategori pengeluaran yang ada.')
  }

  if (
    !recurringTransactions.every((rule) => {
      const category = categoryMap.get(rule.categoryId)
      return (
        accountIds.has(rule.accountId) &&
        Boolean(category) &&
        (!rule.active || category?.type === rule.type) &&
        (!rule.endDate || rule.endDate >= rule.startDate) &&
        rule.nextRunAt >= rule.startDate
      )
    })
  ) {
    throw new Error('Transaksi berulang di file backup merujuk data yang tidak valid.')
  }
}

export async function restoreBackup(data: BackupData): Promise<void> {
  const accounts: Account[] = data.accounts.map((account) => ({
    ...account,
    openingBalance: Number(account.openingBalance) || 0,
    sortOrder: Number(account.sortOrder) || 0,
    archived: Boolean(account.archived),
  }))
  const categories: Category[] = data.categories.map((category) => ({
    ...category,
    sortOrder: Number(category.sortOrder) || 0,
    archived: Boolean(category.archived),
  }))
  const transactions: Transaction[] = data.transactions.map((transaction) => ({
    ...transaction,
    amount: Number(transaction.amount) || 0,
    note: transaction.note || '',
    updatedAt: transaction.updatedAt || transaction.createdAt,
  }))
  const budgets: Budget[] = (data.budgets ?? []).map((budget) => ({
    ...budget,
    amount: Number(budget.amount) || 0,
    updatedAt: budget.updatedAt || budget.createdAt,
  }))
  const recurringTransactions: RecurringTransaction[] = (
    data.recurringTransactions ?? []
  ).map((rule) => ({
    ...rule,
    amount: Number(rule.amount) || 0,
    interval: Number(rule.interval) || 1,
    note: rule.note || '',
    active: Boolean(rule.active),
    updatedAt: rule.updatedAt || rule.createdAt,
  }))

  await db.transaction(
    'rw',
    [
      db.accounts,
      db.categories,
      db.transactions,
      db.budgets,
      db.recurringTransactions,
      db.settings,
    ],
    async () => {
      await db.transactions.clear()
      await db.accounts.clear()
      await db.categories.clear()
      await db.budgets.clear()
      await db.recurringTransactions.clear()
      await db.accounts.bulkAdd(accounts)
      await db.categories.bulkAdd(categories)
      await db.transactions.bulkAdd(transactions)
      if (budgets.length > 0) await db.budgets.bulkAdd(budgets)
      if (recurringTransactions.length > 0) {
        await db.recurringTransactions.bulkAdd(recurringTransactions)
      }

      if (data.profile) {
        await db.settings.put({ key: 'profileName', value: data.profile.name.trim() })
        if (data.profile.photo) {
          await db.settings.put({ key: 'profilePhoto', value: data.profile.photo })
        } else {
          await db.settings.delete('profilePhoto')
        }
      }
    },
  )
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function downloadJson(data: unknown, filename: string): void {
  downloadBlob(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    filename,
  )
}

export function downloadCsv(text: string, filename: string): void {
  downloadBlob(new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' }), filename)
}

export function toCsv(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
): string {
  const accountMap = new Map(accounts.map((account) => [account.id, account.name]))
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]))
  const rows: string[][] = [
    ['Tanggal', 'Jenis', 'Kategori', 'Rekening', 'Catatan', 'Nominal'],
    ...transactions.map((transaction) => [
      transaction.occurredAt,
      transaction.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      categoryMap.get(transaction.categoryId) ?? '',
      accountMap.get(transaction.accountId) ?? '',
      transaction.note ?? '',
      String(transaction.amount),
    ]),
  ]

  return rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
}
