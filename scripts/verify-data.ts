import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { db, getSetting, setSetting } from '../src/db/db'
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, resetMasterData, seedIfEmpty } from '../src/db/seed'
import {
  createTransaction,
  deleteTransaction,
  emptyTrash,
  purgeExpiredTrash,
  restoreFromTrash,
  saveTransaction,
  updateTransaction,
} from '../src/db/transactions'
import { collectTags, normalizeTag, parseTagInput } from '../src/lib/tags'
import { splitIssue } from '../src/lib/split'
import { stopBudget, upsertBudget } from '../src/db/budgets'
import {
  addGoalContribution,
  createGoal,
  deleteGoal,
  deleteGoalContribution,
  updateGoal,
} from '../src/db/goals'
import {
  addDebtPayment,
  createDebt,
  deleteDebt,
  deleteDebtPayment,
  updateDebt,
} from '../src/db/debts'
import { goalProgress, goalSaved } from '../src/lib/goals'
import { debtAccountFlows, debtProgress } from '../src/lib/debts'
import { createFavorite, deleteFavorite, undoFavoriteUse, updateFavorite, useFavorite } from '../src/db/favorites'
import { favoriteIssue } from '../src/lib/favorites'
import { evaluateBudgetAlerts } from '../src/lib/budgetAlerts'
import { factsSignature, monthlyInsights } from '../src/lib/insights'
import { deriveSyncKey, randomSalt, createSyncProfile, unlockSyncProfile } from '../src/lib/sync/crypto'
import {
  SYNC_CURSOR_KEY,
  SYNC_TABLE_NAMES,
  markLocalChanges,
  syncOnce,
  type PushRow,
  type RemoteRow,
  type SyncRemote,
} from '../src/lib/sync/engine'
import { hashRecord, stableStringify } from '../src/lib/sync/stable'
import type { BudgetProgress } from '../src/types'
import {
  defaultAccountIconKey,
  defaultCategoryIconKey,
  ICON_KEYS,
  isKnownIcon,
  resolveIcon,
} from '../src/lib/icons'
import { createTransfer, deleteTransfer, updateTransfer } from '../src/db/transfers'
import {
  createRecurring,
  deleteRecurring,
  processDueRecurring,
  setRecurringActive,
} from '../src/db/recurring'
import { buildBackup, restoreBackup, toCsv, validateBackup } from '../src/db/backup'
import {
  accountsWithBalance,
  categoryBreakdown,
  computeTotals,
  sortTransactions,
  totalBalance,
  withRefs,
} from '../src/lib/analytics'
import {
  buildTrend,
  monthKey,
  monthRange,
  monthRangeFromKey,
  presetRange,
  shiftMonthKey,
  todayISO,
} from '../src/lib/dates'
import { formatNumberInput, formatRupiah, parseNumberInput } from '../src/lib/format'
import {
  budgetProgress,
  budgetSummary,
  newExpenseBudgetAlert,
  resolveBudgets,
} from '../src/lib/budget'
import {
  advanceOccurrence,
  frequencyLabel,
  nextOccurrenceAfter,
  nextOccurrenceOnOrAfter,
} from '../src/lib/recurrence'
import { profileInitials } from '../src/lib/profile'
import { isValidPin, savePin, verifyPin, hasPin } from '../src/lib/pin'
import { decryptBackup, encryptBackup, isEncryptedBackup } from '../src/lib/backupCrypto'

const store = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
  },
})

async function main() {
  await db.delete()
  await db.open()
  await seedIfEmpty()

  assert.equal(await db.accounts.count(), DEFAULT_ACCOUNTS.length)
  assert.equal(await db.categories.count(), DEFAULT_CATEGORIES.length)
  assert.equal(await db.transactions.count(), 0)

  const bca = DEFAULT_ACCOUNTS.find((account) => account.name === 'BCA')!
  const gopay = DEFAULT_ACCOUNTS.find((account) => account.name === 'Gopay')!
  const gaji = DEFAULT_CATEGORIES.find((category) => category.name === 'Gaji Utama')!
  const makan = DEFAULT_CATEGORIES.find((category) => category.name === 'Makan / Minum Harian')!

  const income = await createTransaction({
    type: 'income',
    amount: 5_000_000,
    accountId: bca.id,
    categoryId: gaji.id,
    occurredAt: todayISO(),
    note: 'Gaji bulan ini',
  })
  const expense = await createTransaction({
    type: 'expense',
    amount: 25_000,
    accountId: gopay.id,
    categoryId: makan.id,
    occurredAt: todayISO(),
    note: 'Makan siang',
  })

  assert.equal(await db.transactions.count(), 2)

  const transactions = sortTransactions(await db.transactions.toArray())
  const totals = computeTotals(transactions)
  assert.equal(totals.income, 5_000_000)
  assert.equal(totals.expense, 25_000)
  assert.equal(totals.net, 4_975_000)
  assert.equal(totals.count, 2)
  assert.equal(totalBalance(DEFAULT_ACCOUNTS, transactions), 4_975_000)

  const balances = accountsWithBalance(DEFAULT_ACCOUNTS, transactions)
  assert.equal(balances.find((account) => account.id === bca.id)?.balance, 5_000_000)
  assert.equal(balances.find((account) => account.id === gopay.id)?.balance, -25_000)

  const breakdown = categoryBreakdown(transactions, DEFAULT_CATEGORIES)
  assert.equal(breakdown.length, 1)
  assert.equal(breakdown[0].name, 'Makan / Minum Harian')
  assert.equal(breakdown[0].total, 25_000)
  assert.equal(breakdown[0].percentage, 100)

  const refs = withRefs(transactions, DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES)
  assert.equal(refs.find((row) => row.id === expense.id)?.accountName, 'Gopay')
  assert.equal(refs.find((row) => row.id === expense.id)?.categoryName, 'Makan / Minum Harian')

  const budget = await upsertBudget({ categoryId: makan.id, amount: 100_000 })
  const budgetAgain = await upsertBudget({ categoryId: makan.id, amount: 100_000 })
  assert.equal(budgetAgain.id, budget.id)
  assert.equal(await db.budgets.count(), 1)

  const currentMonth = monthRange()
  const progress = budgetProgress([budget], transactions, DEFAULT_CATEGORIES, currentMonth)
  assert.equal(progress.length, 1)
  assert.equal(progress[0].spent, 25_000)
  assert.equal(progress[0].remaining, 75_000)
  assert.equal(progress[0].status, 'safe')
  assert.equal(progress[0].percentage, 25)

  const warningProgress = budgetProgress(
    [budget],
    [...transactions, { ...expense, id: 'synthetic-warning', amount: 60_000 }],
    DEFAULT_CATEGORIES,
    currentMonth,
  )
  assert.equal(warningProgress[0].spent, 85_000)
  assert.equal(warningProgress[0].status, 'warning')

  const overProgress = budgetProgress(
    [budget],
    [...transactions, { ...expense, id: 'synthetic-over', amount: 80_000 }],
    DEFAULT_CATEGORIES,
    currentMonth,
  )
  assert.equal(overProgress[0].spent, 105_000)
  assert.equal(overProgress[0].status, 'over')

  const summary = budgetSummary(progress, transactions, DEFAULT_CATEGORIES, currentMonth)
  assert.equal(summary.limit, 100_000)
  assert.equal(summary.spent, 25_000)
  assert.equal(summary.remaining, 75_000)
  assert.equal(summary.overCount, 0)

  const recurring = await createRecurring({
    type: 'expense',
    amount: 50_000,
    accountId: bca.id,
    categoryId: makan.id,
    note: 'Langganan internet',
    frequency: 'monthly',
    interval: 1,
    startDate: '2026-01-31',
    endDate: '2026-12-31',
  })
  assert.equal(recurring.nextRunAt, '2026-01-31')
  assert.equal(frequencyLabel('monthly', 1), 'Setiap bulan')
  assert.equal(
    advanceOccurrence('2026-02-28', {
      startDate: '2026-01-31',
      frequency: 'monthly',
      interval: 1,
    }),
    '2026-03-31',
  )
  assert.equal(
    nextOccurrenceOnOrAfter(
      { startDate: '2026-01-31', frequency: 'monthly', interval: 1 },
      '2026-04-30',
    ),
    '2026-04-30',
  )
  assert.equal(
    nextOccurrenceAfter(
      { startDate: '2026-01-31', frequency: 'monthly', interval: 1 },
      '2026-04-30',
    ),
    '2026-05-31',
  )

  await db.settings.put({ key: 'profileName', value: 'Rafi' })
  await db.settings.put({ key: 'profilePhoto', value: 'data:image/png;base64,AAAA' })

  const transfer = await createTransfer({
    fromAccountId: bca.id,
    toAccountId: gopay.id,
    amount: 1_000_000,
    occurredAt: todayISO(),
    note: '  Isi saldo Gopay  ',
  })
  assert.equal(transfer.note, 'Isi saldo Gopay')
  const savedTransfers = await db.transfers.toArray()
  assert.equal(savedTransfers.length, 1)

  // Transfers move money between accounts but never change totals.
  const afterTransfer = accountsWithBalance(DEFAULT_ACCOUNTS, transactions, savedTransfers)
  assert.equal(afterTransfer.find((account) => account.id === bca.id)?.balance, 4_000_000)
  assert.equal(afterTransfer.find((account) => account.id === gopay.id)?.balance, 975_000)
  assert.equal(
    afterTransfer.reduce((sum, account) => sum + account.balance, 0),
    totalBalance(DEFAULT_ACCOUNTS, transactions),
  )
  assert.equal(computeTotals(transactions).income, 5_000_000)
  assert.equal(computeTotals(transactions).expense, 25_000)

  await assert.rejects(
    createTransfer({ fromAccountId: bca.id, toAccountId: bca.id, amount: 1, occurredAt: todayISO() }),
    /tidak boleh sama/,
  )
  await assert.rejects(
    createTransfer({ fromAccountId: bca.id, toAccountId: gopay.id, amount: 0, occurredAt: todayISO() }),
    /lebih dari 0/,
  )
  await assert.rejects(
    createTransfer({ fromAccountId: bca.id, toAccountId: 'tidak-ada', amount: 1, occurredAt: todayISO() }),
    /tidak ditemukan/,
  )
  assert.equal(await db.transfers.count(), 1)

  await updateTransfer(transfer.id, {
    fromAccountId: bca.id,
    toAccountId: gopay.id,
    amount: 250_000,
    occurredAt: todayISO(),
  })
  assert.equal((await db.transfers.get(transfer.id))?.amount, 250_000)
  const extra = await createTransfer({
    fromAccountId: gopay.id,
    toAccountId: bca.id,
    amount: 50_000,
    occurredAt: todayISO(),
  })
  await deleteTransfer(extra.id)
  assert.equal(await db.transfers.count(), 1)

  const backup = await buildBackup()
  validateBackup(backup)
  assert.equal(backup.app, 'rf-uangku')
  assert.equal(backup.version, 8)
  assert.equal(backup.transfers?.length, 1)
  assert.throws(
    () =>
      validateBackup({
        ...backup,
        transfers: [{ ...transfer, toAccountId: transfer.fromAccountId }],
      }),
    /transfer/i,
  )
  assert.throws(
    () => validateBackup({ ...backup, transfers: [{ ...transfer, toAccountId: 'hilang' }] }),
    /transfer/i,
  )
  assert.throws(
    () => validateBackup({ ...backup, transfers: [transfer, transfer] }),
    /ID ganda/,
  )
  assert.equal(backup.accounts.length, DEFAULT_ACCOUNTS.length)
  assert.equal(backup.transactions.length, 2)
  assert.equal(backup.budgets?.length, 1)
  assert.equal(backup.recurringTransactions?.length, 1)
  assert.equal(backup.profile?.name, 'Rafi')
  assert.equal(backup.profile?.photo, 'data:image/png;base64,AAAA')
  assert.equal(profileInitials('Rafi'), 'RA')
  assert.equal(profileInitials('Rafi Fauzan'), 'RF')
  assert.equal(profileInitials('   '), 'RF')
  assert.throws(() => validateBackup({ ...backup, profile: { name: '   ' } }), /profil/)
  assert.throws(() => validateBackup({ app: 'other' }), /bukan backup/)
  assert.throws(() => validateBackup(null), /tidak valid/)
  assert.throws(
    () => validateBackup({ ...backup, budgets: [{ ...budget, amount: -1 }] }),
    /budget/i,
  )
  assert.throws(
    () =>
      validateBackup({
        ...backup,
        recurringTransactions: [{ ...recurring, categoryId: gaji.id }],
      }),
    /berulang/i,
  )

  await updateTransaction(expense.id, {
    type: 'expense',
    amount: 30_000,
    accountId: gopay.id,
    categoryId: makan.id,
    occurredAt: todayISO(),
    note: 'Makan siang dan minum',
  })
  assert.equal((await db.transactions.get(expense.id))?.amount, 30_000)

  const csv = toCsv(transactions, DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES)
  assert.match(csv, /"Tanggal","Jenis","Kategori"/)
  assert.match(csv, /Makan \/ Minum Harian/)

  const daily = buildTrend(transactions, 'daily')
  assert.equal(daily.data.length, 14)
  assert.equal(daily.data.at(-1)?.expense, 25_000)

  const monthly = buildTrend(transactions, 'monthly')
  assert.equal(monthly.data.length, 12)

  const range = presetRange('month')
  assert.ok(range.start.endsWith('-01'))
  assert.ok(range.end >= range.start)
  assert.equal(monthRange().label.length > 0, true)

  assert.equal(formatRupiah(4_975_000), 'Rp 4.975.000')
  assert.equal(formatRupiah(-25_000), '-Rp 25.000')
  assert.equal(formatNumberInput('25000'), '25.000')
  assert.equal(parseNumberInput('25.000'), 25_000)

  assert.equal(isValidPin('1234'), true)
  assert.equal(isValidPin('123456'), true)
  assert.equal(isValidPin('123'), false)
  assert.equal(isValidPin('12a4'), false)
  assert.equal(hasPin(), false)
  await savePin('1234')
  assert.equal(hasPin(), true)
  assert.equal(await verifyPin('1234'), true)
  assert.equal(await verifyPin('9999'), false)

  await restoreBackup(backup)
  assert.equal(await db.transactions.count(), 2)
  assert.equal((await db.transactions.get(expense.id))?.amount, 25_000)
  assert.equal(await db.budgets.count(), 1)
  assert.equal(await db.recurringTransactions.count(), 1)
  assert.equal(await db.transfers.count(), 1)
  assert.equal((await db.transfers.get(transfer.id))?.amount, 250_000)
  assert.equal((await db.settings.get('profileName'))?.value, 'Rafi')
  assert.equal((await db.settings.get('profilePhoto'))?.value, 'data:image/png;base64,AAAA')

  const { profile: _profile, ...legacyBackup } = backup
  validateBackup(legacyBackup)
  await restoreBackup(legacyBackup)
  assert.equal((await db.settings.get('profileName'))?.value, 'Rafi')
  assert.equal((await db.settings.get('profilePhoto'))?.value, 'data:image/png;base64,AAAA')

  const run = await processDueRecurring('2026-04-30')
  assert.equal(run.created, 4)
  assert.equal(await db.transactions.where('recurringId').equals(recurring.id).count(), 4)
  const recurringAfterRun = await db.recurringTransactions.get(recurring.id)
  assert.equal(recurringAfterRun?.lastRunAt, '2026-04-30')
  assert.equal(recurringAfterRun?.nextRunAt, '2026-05-31')
  assert.equal(recurringAfterRun?.active, true)

  const pauseRule = await createRecurring({
    type: 'expense',
    amount: 10_000,
    accountId: bca.id,
    categoryId: makan.id,
    frequency: 'daily',
    interval: 1,
    startDate: todayISO(),
  })
  await setRecurringActive(pauseRule.id, false)
  assert.equal((await db.recurringTransactions.get(pauseRule.id))?.active, false)
  const resumed = await setRecurringActive(pauseRule.id, true)
  assert.equal(resumed.active, true)
  await deleteRecurring(pauseRule.id)

  await deleteTransaction(income.id)
  assert.equal(await db.transactions.count(), 5)

  const {
    budgets: _budgets,
    recurringTransactions: _recurringTransactions,
    transfers: _transfers,
    ...legacyV1
  } = backup
  const v1Backup = { ...legacyV1, version: 1 as const }
  validateBackup(v1Backup)
  await restoreBackup(v1Backup)
  assert.equal(await db.budgets.count(), 0)
  assert.equal(await db.recurringTransactions.count(), 0)
  assert.equal(await db.transfers.count(), 0)
  assert.equal(await db.transactions.count(), 2)

  // Riwayat budget per bulan
  const nowKey = monthKey()
  const prevKey = shiftMonthKey(nowKey, -1)
  assert.equal(shiftMonthKey('2026-01', -1), '2025-12')
  assert.equal(shiftMonthKey('2026-12', 1), '2027-01')
  assert.equal(shiftMonthKey('2026-03', 12), '2027-03')
  assert.equal(await db.budgets.count(), 0)

  // Budget lama (tanpa bulan mulai) otomatis berlaku sejak awal.
  await db.budgets.add({
    id: 'legacy-budget',
    categoryId: makan.id,
    amount: 100_000,
    effectiveFrom: '0000-00',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  const changed = await upsertBudget({ categoryId: makan.id, amount: 200_000 })
  assert.equal(changed.effectiveFrom, nowKey)
  const again = await upsertBudget({ categoryId: makan.id, amount: 250_000 })
  assert.equal(again.id, changed.id)
  assert.equal(await db.budgets.count(), 2)
  await assert.rejects(upsertBudget({ categoryId: makan.id, amount: 0 }), /lebih dari 0/)
  await assert.rejects(
    upsertBudget({ categoryId: makan.id, amount: 1, month: '2026-13' }),
    /tidak valid/,
  )

  let rows = await db.budgets.toArray()
  assert.equal(resolveBudgets(rows, prevKey)[0].amount, 100_000)
  assert.equal(resolveBudgets(rows, nowKey)[0].amount, 250_000)
  assert.equal(resolveBudgets(rows, shiftMonthKey(nowKey, 3))[0].amount, 250_000)
  assert.equal(resolveBudgets(rows, '2020-01')[0].amount, 100_000)

  // Perubahan bulan ini tidak mengubah progres bulan lalu.
  const prevProgress = budgetProgress([...rows], [], DEFAULT_CATEGORIES, monthRangeFromKey(prevKey))
  assert.equal(prevProgress[0].limit, 100_000)
  const nowProgress = budgetProgress([...rows], [], DEFAULT_CATEGORIES, monthRangeFromKey(nowKey))
  assert.equal(nowProgress[0].limit, 250_000)
  assert.equal(
    newExpenseBudgetAlert(rows, [], DEFAULT_CATEGORIES, {
      type: 'expense',
      categoryId: makan.id,
      amount: 90_000,
      occurredAt: `${prevKey}-15`,
    })?.type,
    'info',
  )
  assert.equal(
    newExpenseBudgetAlert(rows, [], DEFAULT_CATEGORIES, {
      type: 'expense',
      categoryId: makan.id,
      amount: 90_000,
      occurredAt: `${nowKey}-15`,
    }),
    null,
  )

  // Menghentikan budget mulai bulan ini: bulan lalu tetap, bulan ini dst. kosong.
  await stopBudget(makan.id, nowKey)
  rows = await db.budgets.toArray()
  assert.equal(rows.length, 2)
  assert.equal(rows.find((row) => row.effectiveFrom === nowKey)?.amount, 0)
  assert.equal(resolveBudgets(rows, prevKey)[0].amount, 100_000)
  assert.equal(resolveBudgets(rows, nowKey).length, 0)
  assert.equal(resolveBudgets(rows, shiftMonthKey(nowKey, 2)).length, 0)

  // Menetapkan lagi setelah dihentikan memakai baris penanda yang sama.
  const revived = await upsertBudget({ categoryId: makan.id, amount: 80_000 })
  assert.equal(revived.effectiveFrom, nowKey)
  assert.equal(await db.budgets.count(), 2)
  assert.equal(resolveBudgets(await db.budgets.toArray(), nowKey)[0].amount, 80_000)

  // Menghentikan budget tanpa riwayat sebelumnya: baris cukup dihapus.
  const lain = DEFAULT_CATEGORIES.find(
    (category) => category.type === 'expense' && category.id !== makan.id,
  )!
  await upsertBudget({ categoryId: lain.id, amount: 30_000 })
  assert.equal(await db.budgets.count(), 3)
  await stopBudget(lain.id, nowKey)
  assert.equal(await db.budgets.count(), 2)

  // Menghentikan di bulan lalu: penanda ditambahkan, riwayat lama tetap utuh.
  await stopBudget(makan.id, prevKey)
  rows = await db.budgets.toArray()
  assert.equal(rows.length, 3)
  assert.equal(resolveBudgets(rows, prevKey).length, 0)
  assert.equal(resolveBudgets(rows, '2020-01')[0].amount, 100_000)
  assert.equal(resolveBudgets(rows, nowKey)[0].amount, 80_000)

  // Backup memuat riwayat budget (v4); file lama tanpa bulan mulai tetap bisa dipulihkan.
  const withHistory = await buildBackup()
  validateBackup(withHistory)
  assert.equal(withHistory.version, 8)
  assert.equal(withHistory.budgets?.length, rows.length)
  assert.throws(
    () =>
      validateBackup({
        ...withHistory,
        budgets: [rows[0], { ...rows[0], id: 'dup' }],
      }),
    /ID ganda/,
  )
  assert.throws(
    () =>
      validateBackup({
        ...withHistory,
        budgets: [{ ...rows[0], effectiveFrom: '2026-13' }],
      }),
    /budget/i,
  )
  await restoreBackup(withHistory)
  assert.equal(await db.budgets.count(), rows.length)

  const oldBudgetBackup: unknown = {
    ...withHistory,
    version: 3,
    budgets: [
      {
        id: 'old-budget',
        categoryId: makan.id,
        amount: 50_000,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  }
  validateBackup(oldBudgetBackup)
  await restoreBackup(oldBudgetBackup)
  assert.equal((await db.budgets.get('old-budget'))?.effectiveFrom, '0000-00')
  assert.equal(resolveBudgets(await db.budgets.toArray(), '2020-01')[0].amount, 50_000)

  // Target tabungan
  const goal = await createGoal({
    name: '  Laptop  ',
    targetAmount: 12_000_000,
    deadline: '2027-05-15',
    color: '#10b981',
  })
  assert.equal(goal.name, 'Laptop')
  await assert.rejects(createGoal({ name: '  ', targetAmount: 1, color: '#000' }), /wajib diisi/)
  await assert.rejects(createGoal({ name: 'X', targetAmount: 0, color: '#000' }), /lebih dari 0/)
  await assert.rejects(
    createGoal({ name: 'X', targetAmount: 1, deadline: '2026-02-30', color: '#000' }),
    /Tenggat/,
  )
  const deposit = await addGoalContribution({
    goalId: goal.id,
    kind: 'deposit',
    amount: 3_000_000,
    occurredAt: todayISO(),
  })
  const withdrawal = await addGoalContribution({
    goalId: goal.id,
    kind: 'withdrawal',
    amount: 500_000,
    occurredAt: todayISO(),
    note: ' dipakai ',
  })
  assert.equal(withdrawal.note, 'dipakai')
  assert.equal(goalSaved(await db.goalContributions.toArray(), goal.id), 2_500_000)
  await assert.rejects(
    addGoalContribution({ goalId: goal.id, kind: 'withdrawal', amount: 9_999_999, occurredAt: todayISO() }),
    /melebihi/,
  )
  await assert.rejects(
    addGoalContribution({ goalId: 'tidak-ada', kind: 'deposit', amount: 1, occurredAt: todayISO() }),
    /tidak ditemukan/,
  )
  await assert.rejects(
    addGoalContribution({ goalId: goal.id, kind: 'deposit', amount: 0, occurredAt: todayISO() }),
    /lebih dari 0/,
  )
  await assert.rejects(
    addGoalContribution({ goalId: goal.id, kind: 'deposit', amount: 1, occurredAt: 'bukan-tanggal' }),
    /Tanggal/,
  )
  assert.equal(await db.goalContributions.count(), 2)

  // Menghapus setoran yang membuat tabungan negatif ditolak; menghapus pengambilan boleh.
  await assert.rejects(deleteGoalContribution(deposit.id), /negatif/)
  await deleteGoalContribution(withdrawal.id)
  assert.equal(goalSaved(await db.goalContributions.toArray(), goal.id), 3_000_000)
  await updateGoal(goal.id, { name: 'Laptop', targetAmount: 3_000_000, color: '#0ea5e9' })
  assert.equal(
    goalProgress(await db.goals.toArray(), await db.goalContributions.toArray(), todayISO())[0].status,
    'done',
  )
  await assert.rejects(
    updateGoal('tidak-ada', { name: 'X', targetAmount: 1, color: '#000' }),
    /tidak ditemukan/,
  )

  // Hapus target ikut menghapus setorannya.
  const temp = await createGoal({ name: 'Sementara', targetAmount: 1_000, color: '#000' })
  await addGoalContribution({ goalId: temp.id, kind: 'deposit', amount: 500, occurredAt: todayISO() })
  assert.equal(await db.goalContributions.count(), 2)
  await deleteGoal(temp.id)
  assert.equal(await db.goalContributions.count(), 1)
  assert.equal(await db.goals.count(), 1)

  // Hutang & piutang
  const debt = await createDebt({
    direction: 'owe',
    person: ' Budi ',
    amount: 1_000_000,
    dueDate: '2026-12-01',
  })
  assert.equal(debt.person, 'Budi')
  await assert.rejects(createDebt({ direction: 'owe', person: ' ', amount: 1 }), /wajib diisi/)
  await assert.rejects(
    createDebt({ direction: 'x' as never, person: 'A', amount: 1 }),
    /tidak valid/,
  )
  await assert.rejects(createDebt({ direction: 'lent', person: 'A', amount: -5 }), /lebih dari 0/)
  await assert.rejects(
    createDebt({ direction: 'lent', person: 'A', amount: 1, dueDate: '2026-13-01' }),
    /Jatuh tempo/,
  )
  const payment = await addDebtPayment({ debtId: debt.id, amount: 400_000, occurredAt: todayISO() })
  await assert.rejects(
    addDebtPayment({ debtId: debt.id, amount: 700_000, occurredAt: todayISO() }),
    /melebihi sisa/,
  )
  await assert.rejects(
    addDebtPayment({ debtId: 'tidak-ada', amount: 1, occurredAt: todayISO() }),
    /tidak ditemukan/,
  )
  await assert.rejects(
    updateDebt(debt.id, { direction: 'owe', person: 'Budi', amount: 300_000 }),
    /lebih kecil/,
  )
  await updateDebt(debt.id, { direction: 'owe', person: 'Budi', amount: 1_200_000 })
  await addDebtPayment({ debtId: debt.id, amount: 800_000, occurredAt: todayISO() })
  const paidOff = debtProgress(await db.debts.toArray(), await db.debtPayments.toArray(), todayISO())
  assert.equal(paidOff[0].status, 'paid')
  assert.equal(paidOff[0].remaining, 0)
  await deleteDebtPayment(payment.id)
  const reopened = debtProgress(await db.debts.toArray(), await db.debtPayments.toArray(), todayISO())
  assert.notEqual(reopened[0].status, 'paid')
  assert.equal(reopened[0].remaining, 400_000)

  const piutang = await createDebt({ direction: 'lent', person: 'Sari', amount: 250_000 })
  await addDebtPayment({ debtId: piutang.id, amount: 50_000, occurredAt: todayISO() })
  assert.equal(await db.debtPayments.count(), 2)
  await deleteDebt(piutang.id)
  assert.equal(await db.debtPayments.count(), 1)
  assert.equal(await db.debts.count(), 1)

  // Hutang/piutang yang dikaitkan ke rekening mengubah saldo, bukan laporan.
  const linkedDebt = await createDebt({
    direction: 'owe',
    person: 'Bank',
    amount: 2_000_000,
    accountId: bca.id,
  })
  assert.equal(linkedDebt.accountId, bca.id)
  await assert.rejects(
    createDebt({ direction: 'owe', person: 'X', amount: 1, accountId: 'tidak-ada' }),
    /Rekening tidak ditemukan/,
  )
  await assert.rejects(
    updateDebt(linkedDebt.id, { direction: 'owe', person: 'Bank', amount: 2_000_000, accountId: 'tidak-ada' }),
    /Rekening tidak ditemukan/,
  )
  const linkedPayment = await addDebtPayment({
    debtId: linkedDebt.id,
    amount: 500_000,
    occurredAt: todayISO(),
    accountId: gopay.id,
  })
  assert.equal(linkedPayment.accountId, gopay.id)
  await assert.rejects(
    addDebtPayment({ debtId: linkedDebt.id, amount: 1, occurredAt: todayISO(), accountId: 'tidak-ada' }),
    /Rekening tidak ditemukan/,
  )
  const flows = debtAccountFlows(await db.debts.toArray(), await db.debtPayments.toArray())
  const baseBalances = accountsWithBalance(DEFAULT_ACCOUNTS, transactions, await db.transfers.toArray())
  const linkedBalances = accountsWithBalance(
    DEFAULT_ACCOUNTS,
    transactions,
    await db.transfers.toArray(),
    flows,
  )
  const balanceOf = (rows: typeof baseBalances, id: string) =>
    rows.find((account) => account.id === id)!.balance
  assert.equal(balanceOf(linkedBalances, bca.id), balanceOf(baseBalances, bca.id) + 2_000_000)
  assert.equal(balanceOf(linkedBalances, gopay.id), balanceOf(baseBalances, gopay.id) - 500_000)
  assert.equal(
    totalBalance(DEFAULT_ACCOUNTS, transactions, flows),
    totalBalance(DEFAULT_ACCOUNTS, transactions) + 2_000_000 - 500_000,
  )
  // Tidak memengaruhi total pemasukan/pengeluaran.
  assert.equal(computeTotals(transactions).income, 5_000_000)
  assert.equal(computeTotals(transactions).expense, 25_000)

  // Backup merujuk rekening hutang yang valid; rekening hilang ditolak.
  const linkedBackup = await buildBackup()
  validateBackup(linkedBackup)
  assert.equal(linkedBackup.debts?.find((row) => row.id === linkedDebt.id)?.accountId, bca.id)
  assert.throws(
    () =>
      validateBackup({
        ...linkedBackup,
        debts: (linkedBackup.debts ?? []).map((row) => ({ ...row, accountId: 'hilang' })),
      }),
    /rekening yang tidak ada/,
  )
  assert.throws(
    () =>
      validateBackup({
        ...linkedBackup,
        debtPayments: (linkedBackup.debtPayments ?? []).map((row) => ({ ...row, accountId: 'hilang' })),
      }),
    /rekening yang tidak ada/,
  )
  await deleteDebt(linkedDebt.id)
  assert.equal(
    (await db.debtPayments.filter((row) => row.debtId === linkedDebt.id).count()),
    0,
  )

  // Backup v5 memuat target tabungan dan hutang/piutang.
  const withPlans = await buildBackup()
  validateBackup(withPlans)
  assert.equal(withPlans.version, 8)
  assert.equal(withPlans.goals?.length, 1)
  assert.equal(withPlans.goalContributions?.length, 1)
  assert.equal(withPlans.debts?.length, 1)
  assert.equal(withPlans.debtPayments?.length, 1)
  assert.throws(
    () =>
      validateBackup({
        ...withPlans,
        goalContributions: [{ ...deposit, goalId: 'hilang' }],
      }),
    /target yang tidak ada/,
  )
  assert.throws(
    () =>
      validateBackup({
        ...withPlans,
        goalContributions: [deposit, { ...deposit, id: 'tarik', kind: 'withdrawal', amount: 3_500_000 }],
      }),
    /negatif/,
  )
  assert.throws(
    () => validateBackup({ ...withPlans, goalContributions: [deposit, deposit] }),
    /ID ganda/,
  )
  assert.throws(
    () =>
      validateBackup({
        ...withPlans,
        debtPayments: [{ ...(withPlans.debtPayments ?? [])[0], amount: 5_000_000 }],
      }),
    /melebihi/,
  )
  assert.throws(
    () =>
      validateBackup({
        ...withPlans,
        debtPayments: [{ ...(withPlans.debtPayments ?? [])[0], debtId: 'hilang' }],
      }),
    /yang tidak ada/,
  )
  assert.throws(
    () => validateBackup({ ...withPlans, debts: [{ ...debt, direction: 'x' }] }),
    /hutang/i,
  )
  await db.goals.clear()
  await db.goalContributions.clear()
  await db.debts.clear()
  await db.debtPayments.clear()
  await restoreBackup(withPlans)
  assert.equal(await db.goals.count(), 1)
  assert.equal(await db.goalContributions.count(), 1)
  assert.equal(await db.debts.count(), 1)
  assert.equal(await db.debtPayments.count(), 1)
  assert.equal((await db.debts.get(debt.id))?.amount, 1_200_000)

  // Backup versi lama (tanpa target/hutang) mengosongkan tabel baru.
  const { goals: _g, goalContributions: _gc, debts: _d, debtPayments: _dp, ...legacyNoPlans } = withPlans
  const v4Backup = { ...legacyNoPlans, version: 4 as const }
  validateBackup(v4Backup)
  await restoreBackup(v4Backup)
  assert.equal(await db.goals.count(), 0)
  assert.equal(await db.debts.count(), 0)

  // Ikon rekening dan kategori
  assert.equal(defaultAccountIconKey('cash'), 'wallet')
  assert.equal(defaultAccountIconKey('bank'), 'landmark')
  assert.equal(defaultAccountIconKey('ewallet'), 'smartphone')
  assert.equal(defaultCategoryIconKey('Makan / Minum Harian', 'expense'), 'utensils')
  assert.equal(defaultCategoryIconKey('Pendapatan Ojol / Gojek', 'income'), 'car')
  assert.equal(defaultCategoryIconKey('Gaji Utama', 'income'), 'banknote')
  assert.equal(defaultCategoryIconKey('Sedekah', 'expense'), 'hand-heart')
  assert.equal(defaultCategoryIconKey('Lain-lain', 'income'), 'trending-up')
  assert.equal(defaultCategoryIconKey('Lain-lain', 'expense'), 'tag')
  for (const category of DEFAULT_CATEGORIES) {
    assert.ok(isKnownIcon(defaultCategoryIconKey(category.name, category.type)))
  }
  assert.ok(ICON_KEYS.length >= 30)
  assert.ok(ICON_KEYS.every((key) => isKnownIcon(key)))
  assert.equal(isKnownIcon('tidak-ada'), false)
  assert.equal(isKnownIcon(undefined), false)
  assert.equal(isKnownIcon('constructor'), false) // bukan properti bawaan Object
  assert.equal(resolveIcon('tidak-ada', 'tag'), resolveIcon(undefined, 'tag'))
  assert.notEqual(resolveIcon('wallet', 'tag'), resolveIcon(undefined, 'tag'))

  const iconAccount = DEFAULT_ACCOUNTS[0]
  await db.accounts.update(iconAccount.id, { icon: 'piggy-bank' })
  await db.categories.update(makan.id, { icon: 'coffee' })
  const iconBackup = await buildBackup()
  validateBackup(iconBackup)
  assert.equal(iconBackup.accounts.find((row) => row.id === iconAccount.id)?.icon, 'piggy-bank')
  assert.equal(iconBackup.categories.find((row) => row.id === makan.id)?.icon, 'coffee')
  assert.throws(
    () =>
      validateBackup({
        ...iconBackup,
        accounts: iconBackup.accounts.map((row, index) =>
          index === 0 ? { ...row, icon: 'x'.repeat(100) } : row,
        ),
      }),
    /rekening/,
  )
  assert.throws(
    () =>
      validateBackup({
        ...iconBackup,
        categories: iconBackup.categories.map((row, index) =>
          index === 0 ? { ...row, icon: 5 as never } : row,
        ),
      }),
    /kategori/,
  )
  await restoreBackup(iconBackup)
  assert.equal((await db.accounts.get(iconAccount.id))?.icon, 'piggy-bank')
  assert.equal((await db.categories.get(makan.id))?.icon, 'coffee')
  // Backup lama tanpa ikon tetap valid; ikon kosong memakai ikon bawaan.
  const { icon: _icon, ...accountNoIcon } = iconBackup.accounts[0]
  validateBackup({ ...iconBackup, accounts: [accountNoIcon, ...iconBackup.accounts.slice(1)] })

  // Backup terenkripsi
  const secret = await buildBackup()
  assert.equal(secret.profile?.name, 'Rafi')
  const envelope = await encryptBackup(secret, 'rahasia-123')
  assert.equal(isEncryptedBackup(envelope), true)
  assert.equal(isEncryptedBackup(secret), false)
  const serialized = JSON.stringify(envelope)
  assert.ok(!serialized.includes('Rafi'))
  assert.ok(!serialized.includes('transactions'))
  const decrypted = await decryptBackup(JSON.parse(serialized), 'rahasia-123')
  validateBackup(decrypted)
  assert.deepEqual(decrypted, JSON.parse(JSON.stringify(secret)))
  assert.notEqual((await encryptBackup(secret, 'rahasia-123')).data, envelope.data)
  await assert.rejects(decryptBackup(envelope, 'salah-total'), /Password salah/)
  await assert.rejects(encryptBackup(secret, 'pendek'), /minimal 8/)
  const flipped = envelope.data[10] === 'A' ? 'B' : 'A'
  await assert.rejects(
    decryptBackup(
      { ...envelope, data: envelope.data.slice(0, 10) + flipped + envelope.data.slice(11) },
      'rahasia-123',
    ),
    /Password salah atau file backup rusak/,
  )
  await assert.rejects(decryptBackup({ ...envelope, iterations: 10 }, 'rahasia-123'), /tidak valid/)
  assert.throws(() => validateBackup(envelope), /terenkripsi/)


  // ---- Template favorit ----
  await resetMasterData()
  const favAccount = DEFAULT_ACCOUNTS[0]
  const favCategory = DEFAULT_CATEGORIES.find((item) => item.type === 'expense')!
  const favorite = await createFavorite({
    name: '  Kopi pagi  ',
    type: 'expense',
    amount: 18000,
    accountId: favAccount.id,
    categoryId: favCategory.id,
    note: '',
  })
  assert.equal(favorite.name, 'Kopi pagi')
  assert.equal(favorite.useCount, 0)
  const favTx = await useFavorite(favorite.id)
  assert.equal(favTx.amount, 18000)
  assert.equal(favTx.note, 'Kopi pagi')
  assert.equal((await db.favorites.get(favorite.id))?.useCount, 1)
  await undoFavoriteUse(favorite.id, favTx.id)
  assert.equal(await db.transactions.get(favTx.id), undefined)
  assert.equal((await db.favorites.get(favorite.id))?.useCount, 0)
  await updateFavorite(favorite.id, {
    name: 'Kopi pagi',
    type: 'expense',
    amount: 20000,
    accountId: favAccount.id,
    categoryId: favCategory.id,
  })
  assert.equal((await db.favorites.get(favorite.id))?.amount, 20000)
  assert.equal(
    favoriteIssue(favorite, { ...favAccount, archived: true }, favCategory)?.length ? true : false,
    true,
  )
  const favBackup = await buildBackup()
  assert.equal(favBackup.favorites?.length, 1)
  assert.doesNotThrow(() => validateBackup(JSON.parse(JSON.stringify(favBackup))))
  assert.throws(
    () =>
      validateBackup({
        ...favBackup,
        favorites: [{ ...favBackup.favorites![0], accountId: 'tidak-ada' }],
      }),
    /favorit/i,
  )
  await restoreBackup(JSON.parse(JSON.stringify(favBackup)))
  assert.equal(await db.favorites.count(), 1)
  const noFavBackup = { ...favBackup, version: 6 as const, favorites: undefined }
  validateBackup(noFavBackup)
  await restoreBackup(noFavBackup)
  assert.equal(await db.favorites.count(), 0)
  await deleteFavorite(favorite.id)


  // ---- Notifikasi budget ----
  const row = (categoryId: string, percentage: number): BudgetProgress => ({
    budgetId: `b-${categoryId}`,
    categoryId,
    categoryName: categoryId,
    categoryColor: '#000',
    limit: 100,
    spent: percentage,
    remaining: 100 - percentage,
    percentage,
    status: percentage >= 100 ? 'over' : percentage >= 80 ? 'warning' : 'safe',
    effectiveFrom: '0000-00',
  })
  const first = evaluateBudgetAlerts([row('a', 90), row('b', 10)], '2026-11', undefined)
  assert.equal(first.events.length, 0)
  assert.deepEqual(first.nextSeen, ['2026-11|a|80'])
  const same = evaluateBudgetAlerts([row('a', 95), row('b', 10)], '2026-11', first.nextSeen)
  assert.equal(same.events.length, 0)
  const crossed = evaluateBudgetAlerts([row('a', 105), row('b', 85)], '2026-11', first.nextSeen)
  assert.deepEqual(crossed.events.map((e) => `${e.categoryId}:${e.threshold}`).sort(), ['a:100', 'b:80'])
  const jump = evaluateBudgetAlerts([row('b', 120)], '2026-11', [])
  assert.deepEqual(jump.events.map((e) => e.threshold), [100])
  const dropped = evaluateBudgetAlerts([row('a', 50)], '2026-11', crossed.nextSeen)
  assert.deepEqual(dropped.nextSeen, [])
  const rearmed = evaluateBudgetAlerts([row('a', 82)], '2026-11', dropped.nextSeen)
  assert.equal(rearmed.events.length, 1)
  const newMonth = evaluateBudgetAlerts([row('a', 85)], '2026-12', rearmed.nextSeen)
  assert.equal(newMonth.events.length, 1)


  // ---- Insight bulanan ----
  const insCats = [
    { id: 'c-makan', name: 'Makan', type: 'expense' as const, color: '#000', createdAt: '' },
    { id: 'c-gaji', name: 'Gaji', type: 'income' as const, color: '#000', createdAt: '' },
  ]
  const insTx = (id: string, categoryId: string, type: 'income' | 'expense', amount: number, occurredAt: string) => ({
    id,
    type,
    amount,
    accountId: 'x',
    categoryId,
    occurredAt,
    note: '',
    createdAt: '',
    updatedAt: '',
  })
  const insData = [
    insTx('1', 'c-makan', 'expense', 1_000_000, '2026-10-05'),
    insTx('2', 'c-makan', 'expense', 900_000, '2026-10-25'), // di luar rentang hari yang sama
    insTx('3', 'c-makan', 'expense', 1_300_000, '2026-11-08'),
    insTx('4', 'c-gaji', 'income', 5_000_000, '2026-11-01'),
  ]
  const ins = monthlyInsights(insData, insCats, '2026-11', '2026-11-15', 'November 2026')
  const up = ins.insights.find((item) => item.id === 'up-c-makan')
  assert.ok(up, 'insight kenaikan kategori harus ada')
  assert.match(up!.text, /naik 30%/)
  assert.equal(ins.facts.previousExpenseSamePeriod, 1_000_000)
  assert.ok(ins.insights.some((item) => item.id === 'saving-rate'))
  assert.equal(monthlyInsights([], insCats, '2026-11', '2026-11-15').insights.length, 0)
  assert.equal(factsSignature(ins.facts), factsSignature(structuredClone(ins.facts)))
  assert.notEqual(factsSignature(ins.facts), factsSignature({ ...ins.facts, expense: 1 }))


  // ---- Tag, split, dan foto struk ----
  assert.equal(normalizeTag('  #Liburan Bali! '), 'liburan-bali')
  assert.deepEqual(parseTagInput('Kantor, #kantor; Dinas Luar\n'), ['kantor', 'dinas-luar'])
  assert.equal(splitIssue(100, [{ categoryId: 'a', amount: 60 }]), 'Pecahan minimal dua kategori.')
  assert.match(
    splitIssue(100, [
      { categoryId: 'a', amount: 60 },
      { categoryId: 'b', amount: 30 },
    ])!,
    /kurang/,
  )
  assert.match(
    splitIssue(100, [
      { categoryId: 'a', amount: 60 },
      { categoryId: 'a', amount: 40 },
    ])!,
    /sekali/,
  )

  await resetMasterData()
  const sAccount = DEFAULT_ACCOUNTS[0]
  const sCats = DEFAULT_CATEGORIES.filter((item) => item.type === 'expense')
  const receiptUrl = 'data:image/jpeg;base64,/9j/AAAA'
  const splitRows = await saveTransaction(null, {
    type: 'expense',
    amount: 150_000,
    accountId: sAccount.id,
    categoryId: sCats[0].id,
    occurredAt: '2026-11-10',
    note: 'Belanja bulanan',
    tags: ['Rumah', 'rumah', 'Bulanan'],
    newReceiptDataUrl: receiptUrl,
    parts: [
      { categoryId: sCats[0].id, amount: 100_000 },
      { categoryId: sCats[1].id, amount: 50_000 },
    ],
  })
  assert.equal(splitRows.length, 2)
  assert.equal(new Set(splitRows.map((row) => row.splitGroupId)).size, 1)
  assert.ok(splitRows[0].splitGroupId)
  assert.deepEqual(splitRows[0].tags, ['rumah', 'bulanan'])
  assert.equal(splitRows[0].receiptId, splitRows[1].receiptId)
  assert.equal(await db.receipts.count(), 1)
  assert.equal(await db.transactions.where('tags').equals('rumah').count(), 2)
  assert.deepEqual(collectTags(await db.transactions.toArray()).map((item) => item.tag), ['bulanan', 'rumah'])
  await assert.rejects(
    saveTransaction(null, {
      type: 'expense',
      amount: 100,
      accountId: sAccount.id,
      categoryId: sCats[0].id,
      occurredAt: '2026-11-10',
      parts: [
        { categoryId: sCats[0].id, amount: 60 },
        { categoryId: sCats[1].id, amount: 30 },
      ],
    }),
    /kurang/,
  )
  assert.equal(await db.transactions.count(), 2)

  // Backup menyertakan struk & split, lalu bisa dipulihkan.
  const splitBackup = await buildBackup()
  assert.equal(splitBackup.receipts?.length, 1)
  validateBackup(JSON.parse(JSON.stringify(splitBackup)))
  assert.throws(
    () =>
      validateBackup({
        ...splitBackup,
        transactions: splitBackup.transactions.map((row) => ({ ...row, receiptId: 'hilang' })),
      }),
    /foto struk/,
  )
  assert.throws(
    () =>
      validateBackup({
        ...splitBackup,
        receipts: [{ ...splitBackup.receipts![0], dataUrl: 'javascript:alert(1)' }],
      }),
    /foto struk/,
  )

  // Ubah split menjadi nominal berbeda dengan struk yang sama: grup dipertahankan, struk tidak yatim.
  const groupId = splitRows[0].splitGroupId
  const kept = await saveTransaction(splitRows[0], {
    type: 'expense',
    amount: 200_000,
    accountId: sAccount.id,
    categoryId: sCats[0].id,
    occurredAt: '2026-11-10',
    note: 'Belanja bulanan',
    tags: ['rumah'],
    receiptId: splitRows[0].receiptId,
    parts: [
      { categoryId: sCats[0].id, amount: 120_000 },
      { categoryId: sCats[1].id, amount: 80_000 },
    ],
  })
  assert.equal(kept[0].splitGroupId, groupId)
  assert.equal(await db.transactions.count(), 2)
  assert.equal(await db.receipts.count(), 1)

  // Menggabungkan kembali menjadi satu transaksi biasa dan mengganti struk.
  const merged = await saveTransaction(kept[0], {
    type: 'expense',
    amount: 200_000,
    accountId: sAccount.id,
    categoryId: sCats[0].id,
    occurredAt: '2026-11-10',
    newReceiptDataUrl: 'data:image/jpeg;base64,/9j/BBBB',
  })
  assert.equal(merged.length, 1)
  assert.equal(merged[0].splitGroupId, undefined)
  assert.equal(merged[0].tags, undefined)
  assert.equal(await db.transactions.count(), 1)
  assert.equal(await db.receipts.count(), 1)
  assert.equal((await db.receipts.toArray())[0].dataUrl.endsWith('BBBB'), true)

  // Menghapus transaksi terakhir ikut menghapus struknya.
  const trashedMerged = await deleteTransaction(merged[0].id)
  assert.equal(await db.receipts.count(), 0)
  assert.ok(trashedMerged)

  // Menghapus satu bagian split menghapus seluruh grup.
  const again2 = await saveTransaction(null, {
    type: 'expense',
    amount: 90,
    accountId: sAccount.id,
    categoryId: sCats[0].id,
    occurredAt: '2026-11-10',
    parts: [
      { categoryId: sCats[0].id, amount: 40 },
      { categoryId: sCats[1].id, amount: 50 },
    ],
  })
  const trashedGroup = await deleteTransaction(again2[0].id)
  assert.equal(await db.transactions.count(), 0)

  // Tempat sampah: pulihkan transaksi + struk, pulihkan grup split, masa simpan, dan penjaga referensi.
  assert.equal(await db.trash.count(), 2)
  assert.equal(await restoreFromTrash(trashedMerged!), 1)
  assert.equal(await db.receipts.count(), 1)
  assert.equal(await db.transactions.count(), 1)
  assert.equal(await restoreFromTrash(trashedGroup!), 2)
  assert.equal(await db.transactions.count(), 3)
  assert.equal(await db.trash.count(), 0)
  assert.equal(new Set((await db.transactions.toArray()).map((row) => row.splitGroupId).filter(Boolean)).size, 1)
  const trashedAgain = await deleteTransaction(again2[0].id)
  await assert.rejects(restoreFromTrash('tidak-ada'), /tidak ditemukan/)
  await db.trash.update(trashedAgain!, { deletedAt: '2020-01-01T00:00:00.000Z' })
  assert.equal(await purgeExpiredTrash(new Date('2026-11-16T00:00:00.000Z')), 1)
  const trashedLast = await deleteTransaction((await db.transactions.toArray())[0].id)
  await db.categories.delete((await db.trash.get(trashedLast!))!.transactions[0].categoryId)
  await assert.rejects(restoreFromTrash(trashedLast!), /sudah dihapus/)
  assert.equal(await db.trash.count(), 1)
  await emptyTrash()
  assert.equal(await db.trash.count(), 0)
  await resetMasterData()
  assert.equal(await db.transactions.count(), 0)

  // Restore backup dengan struk & split.
  await restoreBackup(JSON.parse(JSON.stringify(splitBackup)))
  assert.equal(await db.transactions.count(), 2)
  assert.equal(await db.receipts.count(), 1)
  const oldBackup = { ...splitBackup, version: 7 as const, receipts: undefined, transactions: splitBackup.transactions.map(({ receiptId: _r, ...row }) => row) }
  validateBackup(oldBackup)
  await restoreBackup(oldBackup)
  assert.equal(await db.receipts.count(), 0)


  // ---- Sinkronisasi cloud (server palsu di memori, dua "perangkat") ----
  assert.equal(stableStringify({ b: 1, a: [2, undefined], c: undefined }), '{"a":[2,null],"b":1}')
  assert.equal(hashRecord({ a: 1, b: 2 }), hashRecord({ b: 2, a: 1 }))
  assert.notEqual(hashRecord({ a: 1 }), hashRecord({ a: 2 }))

  const created = await createSyncProfile('frasa-rahasia-1')
  await assert.rejects(unlockSyncProfile('frasa-salah-99', created.profile), /salah/i)
  await unlockSyncProfile('frasa-rahasia-1', created.profile)

  class MemoryRemote implements SyncRemote {
    rows = new Map<string, RemoteRow>()
    counter = 0
    async pull(since: string | null): Promise<RemoteRow[]> {
      return Array.from(this.rows.values())
        .filter((row) => !since || row.serverTs >= since)
        .sort((a, b) => a.serverTs.localeCompare(b.serverTs))
    }
    async push(rows: PushRow[]): Promise<void> {
      for (const row of rows) {
        const existing = this.rows.get(row.key)
        if (existing && row.clientTs < existing.clientTs) continue
        this.counter += 1
        this.rows.set(row.key, { ...row, serverTs: String(this.counter).padStart(10, '0') })
      }
    }
  }
  const remote = new MemoryRemote()
  const syncKey = await deriveSyncKey('frasa-rahasia-1', randomSalt())
  let clock = 5_000_000_000_000
  const now = () => (clock += 1000)
  const doSync = (key = syncKey) => syncOnce({ remote, key, now })

  async function saveDevice() {
    const data: Record<string, unknown[]> = {}
    for (const name of [...SYNC_TABLE_NAMES, 'syncState'] as string[]) {
      data[name] = await db.table(name).toArray()
    }
    return { data, cursor: await getSetting<string | null>(SYNC_CURSOR_KEY, null) }
  }
  async function wipeDevice() {
    for (const name of [...SYNC_TABLE_NAMES, 'syncState'] as string[]) await db.table(name).clear()
    await db.settings.delete(SYNC_CURSOR_KEY)
  }
  async function loadDevice(saved: Awaited<ReturnType<typeof saveDevice>>) {
    await wipeDevice()
    for (const [name, rows] of Object.entries(saved.data)) {
      if (rows.length > 0) await db.table(name).bulkAdd(rows)
    }
    if (saved.cursor !== null) await setSetting(SYNC_CURSOR_KEY, saved.cursor)
  }

  // Perangkat A: data awal + satu transaksi, lalu sinkron pertama.
  await resetMasterData()
  await wipeDevice()
  await seedIfEmpty()
  const syncTx = await createTransaction({
    type: 'expense',
    amount: 12_345,
    accountId: 'acc-tunai',
    categoryId: DEFAULT_CATEGORIES.find((item) => item.type === 'expense')!.id,
    occurredAt: '2026-11-10',
    note: 'Rahasia nasi goreng',
  })
  const firstA = await doSync()
  assert.equal(firstA.firstSync, true)
  assert.ok(firstA.pushed >= 1)
  assert.ok(remote.rows.has(`transactions|${syncTx.id}`))
  for (const row of remote.rows.values()) {
    assert.ok(!(row.payload ?? '').includes('nasi goreng'))
    assert.ok(!atob(row.payload ?? '').includes('nasi goreng'))
  }
  const secondA = await doSync()
  assert.equal(secondA.pushed, 0)
  assert.equal(secondA.applied, 0)
  const deviceA = await saveDevice()

  // Perangkat B baru (data bawaan saja) menerima data A.
  await wipeDevice()
  await seedIfEmpty()
  const firstB = await doSync()
  assert.equal(firstB.firstSync, true)
  assert.equal((await db.transactions.get(syncTx.id))?.note, 'Rahasia nasi goreng')
  assert.equal(await db.accounts.count(), DEFAULT_ACCOUNTS.length)

  // B mengubah rekening dan menambah transaksi; A menerimanya.
  await db.accounts.update('acc-tunai', { name: 'Dompet B' })
  const txB = await createTransaction({
    type: 'income',
    amount: 77_000,
    accountId: 'acc-tunai',
    categoryId: DEFAULT_CATEGORIES.find((item) => item.type === 'income')!.id,
    occurredAt: '2026-11-11',
    note: 'dari B',
  })
  await doSync()
  const deviceB = await saveDevice()
  await loadDevice(deviceA)
  await doSync()
  assert.equal((await db.accounts.get('acc-tunai'))?.name, 'Dompet B')
  assert.equal((await db.transactions.get(txB.id))?.note, 'dari B')

  // Konflik: B mengedit lebih dulu, A mengedit belakangan -> A menang.
  await loadDevice(deviceB)
  await db.accounts.update('acc-bca', { name: 'Edit B' })
  await doSync() // memberi B waktu versi lebih awal, tetapi belum sempat diterima A
  await db.accounts.update('acc-bca', { name: 'Edit B2' }) // perubahan B yang belum terkirim
  await markLocalChanges(now) // mencatat waktu edit walau tanpa jaringan

  const deviceB2 = await saveDevice()
  await loadDevice(deviceA)
  await doSync() // A menerima 'Edit B'
  await db.accounts.update('acc-bca', { name: 'Edit A' })
  await markLocalChanges(now)
  await doSync() // A lebih baru
  await loadDevice(deviceB2)
  await doSync()
  assert.equal((await db.accounts.get('acc-bca'))?.name, 'Edit A')

  // Penghapusan menyebar sebagai tombstone.
  await db.transactions.delete(txB.id)
  await doSync()
  const deviceBdel = await saveDevice()
  await loadDevice(deviceA)
  await doSync()
  assert.equal(await db.transactions.get(txB.id), undefined)
  await loadDevice(deviceBdel)

  // Kunci yang salah ditolak tanpa mengubah data lokal.
  await wipeDevice()
  await seedIfEmpty()
  const wrongKey = await deriveSyncKey('frasa-lain-12345', randomSalt())
  await assert.rejects(doSync(wrongKey), /Frasa sandi salah/)

  await db.delete()
  console.log('Semua verifikasi data lulus.')
}

main().catch((error) => {
  console.error('Verifikasi gagal:', error)
  process.exitCode = 1
})
