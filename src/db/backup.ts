import { db } from './db'
import type {
  Account,
  BackupData,
  Budget,
  Category,
  Debt,
  DebtPayment,
  Favorite,
  KprSimulation,
  Goal,
  GoalContribution,
  ProfileBackup,
  Receipt,
  RecurringTransaction,
  Transaction,
  Transfer,
} from '../types'
import { BUDGET_LEGACY_MONTH, DEFAULT_PROFILE_NAME } from '../lib/constants'
import { isMonthKey } from '../lib/dates'
import { isIsoDate } from '../lib/dateMath'
import { FAVORITE_NAME_MAX_LENGTH } from '../lib/favorites'
import { ICON_KEY_MAX_LENGTH } from '../lib/icons'
import { isReceiptDataUrl } from '../lib/receipts'
import { isValidTagList } from '../lib/tags'
import { PROFILE_PHOTO_MAX_DATA_URL_LENGTH } from '../lib/profile'
import { categoryLabel } from '../lib/categoryTree'

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
    version: 8,
    exportedAt: new Date().toISOString(),
    accounts: await db.accounts.toArray(),
    categories: await db.categories.toArray(),
    transactions: await db.transactions.toArray(),
    budgets: await db.budgets.toArray(),
    recurringTransactions: await db.recurringTransactions.toArray(),
    transfers: await db.transfers.toArray(),
    goals: await db.goals.toArray(),
    goalContributions: await db.goalContributions.toArray(),
    debts: await db.debts.toArray(),
    debtPayments: await db.debtPayments.toArray(),
    favorites: await db.favorites.toArray(),
    receipts: await db.receipts.toArray(),
    kprSimulations: await db.kprSimulations.toArray(),
    ...(profile ? { profile } : {}),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

/** Ikon opsional: teks pendek. Kunci tak dikenal tetap diterima (tampil sebagai ikon bawaan). */
function isOptionalIcon(value: unknown): boolean {
  return value === undefined || (typeof value === 'string' && value.length <= ICON_KEY_MAX_LENGTH)
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
    isOptionalIcon(value.icon) &&
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
    isOptionalIcon(value.icon) &&
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
    (value.tags === undefined || isValidTagList(value.tags)) &&
    (value.splitGroupId === undefined || typeof value.splitGroupId === 'string') &&
    (value.receiptId === undefined || typeof value.receiptId === 'string') &&
    typeof value.createdAt === 'string'
  )
}

function isReceiptRow(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    isReceiptDataUrl(value.dataUrl) &&
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
    // amount 0 = penanda budget dihentikan mulai bulan tertentu
    value.amount >= 0 &&
    (value.effectiveFrom === undefined ||
      value.effectiveFrom === BUDGET_LEGACY_MONTH ||
      isMonthKey(value.effectiveFrom)) &&
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
    (value.toAccountId === undefined || typeof value.toAccountId === 'string') &&
    (value.fee === undefined || (typeof value.fee === 'number' && Number.isFinite(value.fee) && value.fee >= 0)) &&
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

function isTransferRow(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.fromAccountId === 'string' &&
    typeof value.toAccountId === 'string' &&
    value.fromAccountId !== value.toAccountId &&
    typeof value.amount === 'number' &&
    Number.isFinite(value.amount) &&
    value.amount > 0 &&
    isDateString(value.occurredAt) &&
    (value.fee === undefined || (typeof value.fee === 'number' && Number.isFinite(value.fee) && value.fee >= 0)) &&
    (value.feeTransactionId === undefined || typeof value.feeTransactionId === 'string') &&
    (value.recurringId === undefined || typeof value.recurringId === 'string') &&
    (value.note === undefined || typeof value.note === 'string') &&
    typeof value.createdAt === 'string'
  )
}

function isPositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isGoalRow(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    isPositive(value.targetAmount) &&
    (value.deadline === undefined || isIsoDate(value.deadline)) &&
    typeof value.color === 'string' &&
    (value.note === undefined || typeof value.note === 'string') &&
    typeof value.createdAt === 'string'
  )
}

function isGoalContributionRow(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.goalId === 'string' &&
    (value.kind === 'deposit' || value.kind === 'withdrawal') &&
    isPositive(value.amount) &&
    (value.accountId === undefined || typeof value.accountId === 'string') &&
    isIsoDate(value.occurredAt) &&
    (value.note === undefined || typeof value.note === 'string') &&
    typeof value.createdAt === 'string'
  )
}

function isDebtRow(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    (value.direction === 'owe' || value.direction === 'lent') &&
    typeof value.person === 'string' &&
    value.person.trim().length > 0 &&
    isPositive(value.amount) &&
    (value.dueDate === undefined || isIsoDate(value.dueDate)) &&
    (value.accountId === undefined || typeof value.accountId === 'string') &&
    (value.note === undefined || typeof value.note === 'string') &&
    typeof value.createdAt === 'string'
  )
}

function isFavoriteRow(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    (value.type === 'income' || value.type === 'expense') &&
    isPositive(value.amount) &&
    typeof value.accountId === 'string' &&
    typeof value.categoryId === 'string' &&
    (value.note === undefined || typeof value.note === 'string') &&
    (value.useCount === undefined ||
      (typeof value.useCount === 'number' && Number.isFinite(value.useCount) && value.useCount >= 0)) &&
    (value.lastUsedAt === undefined || typeof value.lastUsedAt === 'string') &&
    typeof value.createdAt === 'string'
  )
}

function isKprRow(value: unknown): boolean {
  if (!isRecord(value)) return false
  const finite = (item: unknown) => typeof item === 'number' && Number.isFinite(item) && item >= 0
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    finite(value.price) &&
    finite(value.downPayment) &&
    finite(value.years) &&
    finite(value.fixedRate) &&
    finite(value.fixedYears) &&
    finite(value.floatingRate) &&
    typeof value.startMonth === 'string' &&
    /^\d{4}-\d{2}$/.test(value.startMonth) &&
    typeof value.createdAt === 'string'
  )
}

function isDebtPaymentRow(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.debtId === 'string' &&
    isPositive(value.amount) &&
    (value.accountId === undefined || typeof value.accountId === 'string') &&
    isIsoDate(value.occurredAt) &&
    (value.note === undefined || typeof value.note === 'string') &&
    typeof value.createdAt === 'string'
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
  if ((value as { encrypted?: unknown }).encrypted === true) {
    throw new Error('File backup ini terenkripsi. Buka dulu dengan password.')
  }
  const data = value as Partial<BackupData>
  if (data.app !== 'rf-uangku') {
    throw new Error('File ini bukan backup RF Uangku.')
  }
  if (
    data.version !== 1 &&
    data.version !== 2 &&
    data.version !== 3 &&
    data.version !== 4 &&
    data.version !== 5 &&
    data.version !== 6 &&
    data.version !== 7 &&
    data.version !== 8
  ) {
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
  if (data.transfers !== undefined) {
    if (!Array.isArray(data.transfers) || !data.transfers.every(isTransferRow)) {
      throw new Error('Data transfer di file backup tidak valid.')
    }
  }
  if (data.goals !== undefined) {
    if (!Array.isArray(data.goals) || !data.goals.every(isGoalRow)) {
      throw new Error('Data target tabungan di file backup tidak valid.')
    }
  }
  if (data.goalContributions !== undefined) {
    if (
      !Array.isArray(data.goalContributions) ||
      !data.goalContributions.every(isGoalContributionRow)
    ) {
      throw new Error('Data setoran tabungan di file backup tidak valid.')
    }
  }
  if (data.debts !== undefined) {
    if (!Array.isArray(data.debts) || !data.debts.every(isDebtRow)) {
      throw new Error('Data hutang/piutang di file backup tidak valid.')
    }
  }
  if (data.debtPayments !== undefined) {
    if (!Array.isArray(data.debtPayments) || !data.debtPayments.every(isDebtPaymentRow)) {
      throw new Error('Data pembayaran hutang/piutang di file backup tidak valid.')
    }
  }
  if (data.receipts !== undefined) {
    if (!Array.isArray(data.receipts) || !data.receipts.every(isReceiptRow)) {
      throw new Error('Data foto struk di file backup tidak valid.')
    }
  }
  if (data.favorites !== undefined) {
    if (!Array.isArray(data.favorites) || !data.favorites.every(isFavoriteRow)) {
      throw new Error('Data favorit di file backup tidak valid.')
    }
  }
  if (data.kprSimulations !== undefined) {
    if (!Array.isArray(data.kprSimulations) || !data.kprSimulations.every(isKprRow)) {
      throw new Error('Data simulasi KPR di file backup tidak valid.')
    }
  }
  if (data.profile !== undefined && !isProfileRow(data.profile)) {
    throw new Error('Data profil di file backup tidak valid.')
  }
  const budgets = data.budgets ?? []
  const recurringTransactions = data.recurringTransactions ?? []
  const transfers = data.transfers ?? []
  const goals = data.goals ?? []
  const goalContributions = data.goalContributions ?? []
  const debts = data.debts ?? []
  const debtPayments = data.debtPayments ?? []
  const favorites = data.favorites ?? []
  const receipts = data.receipts ?? []
  if (
    new Set(data.accounts.map((account) => account.id)).size !== data.accounts.length ||
    new Set(data.categories.map((category) => category.id)).size !== data.categories.length ||
    new Set(data.transactions.map((transaction) => transaction.id)).size !==
      data.transactions.length ||
    new Set(budgets.map((budget) => budget.id)).size !== budgets.length ||
    new Set(
      budgets.map((budget) => `${budget.categoryId}|${budget.effectiveFrom ?? BUDGET_LEGACY_MONTH}`),
    ).size !== budgets.length ||
    new Set(recurringTransactions.map((rule) => rule.id)).size !== recurringTransactions.length ||
    new Set(transfers.map((transfer) => transfer.id)).size !== transfers.length ||
    new Set(goals.map((goal) => goal.id)).size !== goals.length ||
    new Set(goalContributions.map((item) => item.id)).size !== goalContributions.length ||
    new Set(debts.map((debt) => debt.id)).size !== debts.length ||
    new Set(debtPayments.map((payment) => payment.id)).size !== debtPayments.length ||
    new Set(favorites.map((favorite) => favorite.id)).size !== favorites.length ||
    new Set(receipts.map((receipt) => receipt.id)).size !== receipts.length
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

  const receiptIds = new Set(receipts.map((receipt) => receipt.id))
  if (!data.transactions.every((item) => !item.receiptId || receiptIds.has(item.receiptId))) {
    throw new Error('Transaksi di file backup merujuk foto struk yang tidak ada.')
  }

  if (
    !transfers.every(
      (transfer) => accountIds.has(transfer.fromAccountId) && accountIds.has(transfer.toAccountId),
    )
  ) {
    throw new Error('Transfer di file backup merujuk rekening yang tidak ada.')
  }

  const goalIds = new Set(goals.map((goal) => goal.id))
  if (!goalContributions.every((item) => !item.accountId || accountIds.has(item.accountId))) {
    throw new Error('Setoran tabungan di file backup merujuk rekening yang tidak ada.')
  }
  if (!goalContributions.every((item) => goalIds.has(item.goalId))) {
    throw new Error('Setoran tabungan di file backup merujuk target yang tidak ada.')
  }
  const savedByGoal = new Map<string, number>()
  for (const item of goalContributions) {
    const delta = item.kind === 'deposit' ? item.amount : -item.amount
    savedByGoal.set(item.goalId, (savedByGoal.get(item.goalId) ?? 0) + delta)
  }
  if (Array.from(savedByGoal.values()).some((saved) => saved < 0)) {
    throw new Error('Tabungan di file backup bernilai negatif.')
  }

  if (
    !debts.every((debt) => !debt.accountId || accountIds.has(debt.accountId)) ||
    !debtPayments.every((payment) => !payment.accountId || accountIds.has(payment.accountId))
  ) {
    throw new Error('Hutang/piutang di file backup merujuk rekening yang tidak ada.')
  }

  const debtIds = new Set(debts.map((debt) => debt.id))
  if (!debtPayments.every((payment) => debtIds.has(payment.debtId))) {
    throw new Error('Pembayaran di file backup merujuk hutang/piutang yang tidak ada.')
  }
  const paidByDebt = new Map<string, number>()
  for (const payment of debtPayments) {
    paidByDebt.set(payment.debtId, (paidByDebt.get(payment.debtId) ?? 0) + payment.amount)
  }
  if (debts.some((debt) => (paidByDebt.get(debt.id) ?? 0) > debt.amount)) {
    throw new Error('Pembayaran di file backup melebihi nominal hutang/piutang.')
  }

  const categoryMap = new Map(data.categories.map((category) => [category.id, category]))
  if (
    !favorites.every((favorite) => {
      const category = categoryMap.get(favorite.categoryId)
      return accountIds.has(favorite.accountId) && Boolean(category && category.type === favorite.type)
    })
  ) {
    throw new Error('Favorit di file backup merujuk rekening/kategori yang tidak ada atau tipenya tidak cocok.')
  }
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
      if (rule.toAccountId) {
        // Aturan transfer: tidak memakai kategori.
        return (
          accountIds.has(rule.accountId) &&
          accountIds.has(rule.toAccountId) &&
          rule.toAccountId !== rule.accountId &&
          (!rule.endDate || rule.endDate >= rule.startDate) &&
          rule.nextRunAt >= rule.startDate
        )
      }
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
    // Backup lama (v1-v3) tidak punya bulan mulai: berlaku sejak awal.
    effectiveFrom: budget.effectiveFrom || BUDGET_LEGACY_MONTH,
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

  const transfers: Transfer[] = (data.transfers ?? []).map((transfer) => ({
    ...transfer,
    amount: Number(transfer.amount) || 0,
    note: transfer.note || '',
    updatedAt: transfer.updatedAt || transfer.createdAt,
  }))

  const goalsRows: Goal[] = (data.goals ?? []).map((goal) => ({
    ...goal,
    targetAmount: Number(goal.targetAmount) || 0,
    note: goal.note || '',
    updatedAt: goal.updatedAt || goal.createdAt,
  }))
  const goalContributionRows: GoalContribution[] = (data.goalContributions ?? []).map(
    (item) => ({ ...item, amount: Number(item.amount) || 0, note: item.note || '' }),
  )
  const debtRows: Debt[] = (data.debts ?? []).map((debt) => ({
    ...debt,
    amount: Number(debt.amount) || 0,
    note: debt.note || '',
    updatedAt: debt.updatedAt || debt.createdAt,
  }))
  const debtPaymentRows: DebtPayment[] = (data.debtPayments ?? []).map((payment) => ({
    ...payment,
    amount: Number(payment.amount) || 0,
    note: payment.note || '',
  }))

  const receiptRows: Receipt[] = (data.receipts ?? []).map((receipt) => ({ ...receipt }))
  const kprRows: KprSimulation[] = (data.kprSimulations ?? []).map((item) => ({
    ...item,
    name: item.name.trim().slice(0, 60) || 'Simulasi KPR',
    updatedAt: item.updatedAt || item.createdAt,
  }))
  const favoriteRows: Favorite[] = (data.favorites ?? []).map((favorite) => ({
    ...favorite,
    name: favorite.name.trim().slice(0, FAVORITE_NAME_MAX_LENGTH),
    amount: Number(favorite.amount) || 0,
    note: favorite.note || '',
    useCount: Number(favorite.useCount) || 0,
    updatedAt: favorite.updatedAt || favorite.createdAt,
  }))

  await db.transaction(
    'rw',
    [
      db.accounts,
      db.categories,
      db.transactions,
      db.budgets,
      db.recurringTransactions,
      db.transfers,
      db.goals,
      db.goalContributions,
      db.debts,
      db.debtPayments,
      db.favorites,
      db.receipts,
      db.kprSimulations,
      db.trash,
      db.settings,
    ],
    async () => {
      await db.transactions.clear()
      await db.accounts.clear()
      await db.categories.clear()
      await db.budgets.clear()
      await db.recurringTransactions.clear()
      await db.transfers.clear()
      await db.goalContributions.clear()
      await db.goals.clear()
      await db.debtPayments.clear()
      await db.debts.clear()
      await db.favorites.clear()
      await db.receipts.clear()
      await db.kprSimulations.clear()
      await db.trash.clear()
      await db.accounts.bulkAdd(accounts)
      await db.categories.bulkAdd(categories)
      await db.transactions.bulkAdd(transactions)
      if (budgets.length > 0) await db.budgets.bulkAdd(budgets)
      if (recurringTransactions.length > 0) {
        await db.recurringTransactions.bulkAdd(recurringTransactions)
      }
      if (transfers.length > 0) await db.transfers.bulkAdd(transfers)
      if (goalsRows.length > 0) await db.goals.bulkAdd(goalsRows)
      if (goalContributionRows.length > 0) {
        await db.goalContributions.bulkAdd(goalContributionRows)
      }
      if (debtRows.length > 0) await db.debts.bulkAdd(debtRows)
      if (debtPaymentRows.length > 0) await db.debtPayments.bulkAdd(debtPaymentRows)
      if (favoriteRows.length > 0) await db.favorites.bulkAdd(favoriteRows)
      if (receiptRows.length > 0) await db.receipts.bulkAdd(receiptRows)
      if (kprRows.length > 0) await db.kprSimulations.bulkAdd(kprRows)

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
  const categoryMap = new Map(categories.map((category) => [category.id, categoryLabel(category, categories)]))
  const rows: string[][] = [
    ['Tanggal', 'Jenis', 'Kategori', 'Rekening', 'Catatan', 'Nominal', 'Tag', 'Split'],
    ...transactions.map((transaction) => [
      transaction.occurredAt,
      transaction.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      categoryMap.get(transaction.categoryId) ?? '',
      accountMap.get(transaction.accountId) ?? '',
      transaction.note ?? '',
      String(transaction.amount),
      (transaction.tags ?? []).join(' '),
      transaction.splitGroupId ? 'ya' : '',
    ]),
  ]

  return rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
}
