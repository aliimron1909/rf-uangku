import { readFileSync } from 'node:fs'
import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { db, getSetting, setSetting } from '../src/db/db'
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, resetMasterData, seedIfEmpty } from '../src/db/seed'
import {
  createTransaction,
  deleteTransaction,
  emptyTrash,
  importTransactions,
  purgeExpiredTrash,
  restoreFromTrash,
  saveTransaction,
  updateTransaction,
} from '../src/db/transactions'
import { collectTags, normalizeTag, parseTagInput, tagSummary, tagsLabel } from '../src/lib/tags'
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
import { goalAccountFlows, goalProgress, goalSaved } from '../src/lib/goals'
import { accountBalance } from '../src/lib/analytics'
import { debtAccountFlows, debtProgress } from '../src/lib/debts'
import { createFavorite, deleteFavorite, undoFavoriteUse, updateFavorite, useFavorite } from '../src/db/favorites'
import { favoriteIssue } from '../src/lib/favorites'
import {
  buildImportRows,
  detectDelimiter,
  detectHeaderRow,
  guessMapping,
  parseAmount,
  parseCsv,
  parseDate,
} from '../src/lib/csvImport'
import { evaluateBudgetAlerts } from '../src/lib/budgetAlerts'
import { factsSignature, monthlyInsights } from '../src/lib/insights'
import {
  SYNC_CURSOR_KEY,
  SYNC_TABLE_NAMES,
  markLocalChanges,
  resetSyncLocalState,
  syncOnce,
  type PushRow,
  type RemoteRow,
  type SyncRemote,
} from '../src/lib/sync/engine'
import { hashRecord, stableStringify } from '../src/lib/sync/stable'
import { isReminderDue, localParts } from '../supabase/functions/daily-reminder/logic'
import type { Account, BudgetProgress, Debt, DebtPayment, Transaction } from '../src/types'
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
import {
  billReminderMessage,
  evaluateBillReminders,
  upcomingBills,
} from '../src/lib/billReminders'
import { matchAccountName, readAiEntry, resolveAiTransfer } from '../src/lib/groq'
import { pickUpdate, releaseBuild } from '../src/lib/nativeUpdate'
import { mergePending, parseBankNotification, parseIdrAmount } from '../src/lib/bankNotif'
import { trendSummary, widgetTexts } from '../src/lib/nativeWidget'
import { extractNativeUrl } from '../src/lib/native'
import { planReminderTimes, shouldRemindToday } from '../src/lib/dailyReminder'
import { moveCategory } from '../src/db/categories'
import { matchExpenseCategory, readReceiptResult } from '../src/lib/groq'
import { moveAccount } from '../src/db/accounts'
import { moveInOrder } from '../src/lib/accountOrder'
import { netWorthSeries, trimLeadingEmpty } from '../src/lib/networth'
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
  let clock = 5_000_000_000_000
  const now = () => (clock += 1000)
  const doSync = () => syncOnce({ remote, now })

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
  const sentTx = remote.rows.get(`transactions|${syncTx.id}`)!
  assert.equal((sentTx.data as { note: string }).note, 'Rahasia nasi goreng')
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

  // Cloud dikosongkan (migrasi dari versi terenkripsi): perangkat yang direset mengunggah ulang semuanya.
  remote.rows.clear()
  await loadDevice(deviceA)
  await resetSyncLocalState()
  const reupload = await doSync()
  assert.equal(reupload.firstSync, true)
  assert.ok(reupload.pushed >= 1)
  assert.ok(remote.rows.has(`transactions|${syncTx.id}`))


  // ---- Pengingat push dari server ----
  assert.deepEqual(localParts(new Date('2026-11-17T13:30:00Z'), 'Asia/Jakarta'), {
    date: '2026-11-17',
    minutes: 20 * 60 + 30,
  })
  assert.equal(localParts(new Date('2026-11-17T20:00:00Z'), 'Asia/Jakarta').date, '2026-11-18')
  assert.equal(localParts(new Date('2026-11-17T13:30:00Z'), 'Zona/Tidak-ada').minutes, 20 * 60 + 30)
  const dueBase = { enabled: true, remindTime: '20:00', timeZone: 'Asia/Jakarta', lastSentDate: null }
  assert.equal(isReminderDue({ ...dueBase, now: new Date('2026-11-17T12:59:00Z') }).due, false) // 19:59
  assert.equal(isReminderDue({ ...dueBase, now: new Date('2026-11-17T13:00:00Z') }).due, true) // 20:00
  assert.equal(isReminderDue({ ...dueBase, now: new Date('2026-11-17T15:59:00Z') }).due, true) // 22:59
  assert.equal(isReminderDue({ ...dueBase, now: new Date('2026-11-17T16:00:00Z') }).due, false) // 23:00, lewat jendela
  assert.equal(
    isReminderDue({ ...dueBase, lastSentDate: '2026-11-17', now: new Date('2026-11-17T13:30:00Z') }).due,
    false,
  )
  assert.equal(isReminderDue({ ...dueBase, enabled: false, now: new Date('2026-11-17T13:30:00Z') }).due, false)
  assert.equal(isReminderDue({ ...dueBase, remindTime: '25:00', now: new Date('2026-11-17T13:30:00Z') }).due, false)

  // Edge Function mandiri harus memuat salinan logika yang sama persis dengan logic.ts.
  const fnSource = readFileSync('supabase/functions/daily-reminder/index.ts', 'utf8')
  const inlined = fnSource.split('// logic:begin\n')[1]?.split('\n// logic:end')[0]?.trim()
  const logicSource = readFileSync('supabase/functions/daily-reminder/logic.ts', 'utf8')
    .split('\n')
    .slice(2)
    .join('\n')
    .replace(/export /g, '')
    .trim()
  assert.equal(inlined, logicSource)

  // ---- Impor CSV ----
  assert.equal(detectDelimiter('a;b;c\n1;2;3'), ';')
  assert.deepEqual(parseCsv('a,b\n"x, y","say ""hi"""\r\n\r\n1,2'), [
    ['a', 'b'],
    ['x, y', 'say "hi"'],
    ['1', '2'],
  ])
  assert.equal(parseDate('2026-11-05'), '2026-11-05')
  assert.equal(parseDate('05/11/2026 13:45'), '2026-11-05')
  assert.equal(parseDate('5-11-26'), '2026-11-05')
  assert.equal(parseDate('5 Agu 2026'), '2026-08-05')
  assert.equal(parseDate('12 December 2026'), '2026-12-12')
  assert.equal(parseDate('31/02/2026'), null)
  assert.equal(parseDate('abc'), null)
  assert.equal(parseAmount('Rp 1.234.567'), 1234567)
  assert.equal(parseAmount('1.234.567,89'), 1234568)
  assert.equal(parseAmount('1,234,567.00'), 1234567)
  assert.equal(parseAmount('-50.000'), -50000)
  assert.equal(parseAmount('(25.000)'), -25000)
  assert.equal(parseAmount('75.000 DB'), -75000)
  assert.equal(parseAmount('150000'), 150000)
  assert.equal(parseAmount('12,50'), 13)
  assert.equal(parseAmount(''), null)
  assert.equal(parseAmount('n/a'), null)

  await resetMasterData()
  const impAccount = DEFAULT_ACCOUNTS[0]
  const impCats = DEFAULT_CATEGORIES
  const impExpense = impCats.find((item) => item.type === 'expense' && /makan/i.test(item.name))!
  const csvText = [
    'Laporan Mutasi Rekening',
    'Periode;Nov 2026;;',
    'Tanggal;Keterangan;Debit;Kredit',
    '05/11/2026;Makan siang warung;35.000;',
    '06/11/2026;Gaji November;;5.000.000',
    '07/11/2026;;;',
    'tanggal rusak;Salah;10.000;',
  ].join('\n')
  const csvTable = parseCsv(csvText)
  const csvHeader = detectHeaderRow(csvTable)
  assert.equal(csvHeader, 2)
  const csvMapping = guessMapping(csvTable[csvHeader])
  assert.equal(csvMapping.date, 0)
  assert.equal(csvMapping.description, 1)
  assert.equal(csvMapping.debit, 2)
  assert.equal(csvMapping.credit, 3)
  await createTransaction({
    type: 'expense',
    amount: 20_000,
    accountId: impAccount.id,
    categoryId: impExpense.id,
    occurredAt: '2026-10-01',
    note: 'Makan siang warung',
  })
  const imported = buildImportRows(
    csvTable,
    { mapping: csvMapping, headerRow: csvHeader, positiveIsExpense: false, accountId: impAccount.id },
    impCats,
    await db.transactions.toArray(),
  )
  assert.equal(imported.rows.length, 2)
  assert.equal(imported.skipped.length, 2)
  assert.equal(imported.rows[0].type, 'expense')
  assert.equal(imported.rows[0].amount, 35_000)
  assert.equal(imported.rows[0].categoryId, impExpense.id) // dipelajari dari riwayat
  assert.equal(imported.rows[1].type, 'income')
  assert.equal(imported.rows[1].amount, 5_000_000)
  assert.equal(imported.rows[0].duplicate, false)
  const importedCount = await importTransactions(imported.rows, impAccount.id)
  assert.equal(importedCount, 2)
  assert.equal(await db.transactions.where('tags').equals('impor').count(), 2)
  await assert.rejects(
    importTransactions([{ ...imported.rows[0], categoryId: 'tidak-ada' }], impAccount.id),
    /kategori/,
  )
  assert.equal(await db.transactions.where('tags').equals('impor').count(), 2)

  const signedMapping = { date: 0, description: 1, amount: 2, debit: null, credit: null, type: null }
  const signed = buildImportRows(
    [
      ['Tanggal', 'Keterangan', 'Jumlah'],
      ['2026-10-01', 'Makan siang warung', '-20.000'],
      ['2026-10-02', 'Transfer masuk', '100.000'],
    ],
    { mapping: signedMapping, headerRow: 0, positiveIsExpense: false, accountId: impAccount.id },
    impCats,
    await db.transactions.toArray(),
  )
  assert.equal(signed.rows[0].duplicate, true)
  assert.equal(signed.rows[1].duplicate, false)
  assert.equal(signed.rows[1].type, 'income')
  const csvFlipped = buildImportRows(
    [['Tanggal', 'Keterangan', 'Jumlah'], ['2026-10-02', 'Belanja', '100.000']],
    { mapping: signedMapping, headerRow: 0, positiveIsExpense: true, accountId: impAccount.id },
    impCats,
    [],
  )
  assert.equal(csvFlipped.rows[0].type, 'expense')


  // ---- Ringkasan per tag ----
  const tagTx = (id: string, type: 'income' | 'expense', amount: number, tags?: string[]) => ({
    id, type, amount, accountId: 'x', categoryId: 'y', occurredAt: '2026-11-01', createdAt: '', updatedAt: '', tags,
  })
  const tagRowsSummary = tagSummary([
    tagTx('1', 'expense', 100, ['bali', 'liburan']),
    tagTx('2', 'expense', 50, ['bali']),
    tagTx('3', 'income', 70, ['liburan']),
    tagTx('4', 'expense', 999),
  ])
  assert.deepEqual(tagRowsSummary.map((row) => row.tag), ['bali', 'liburan'])
  assert.equal(tagRowsSummary[0].expense, 150)
  assert.equal(tagRowsSummary[0].count, 2)
  assert.equal(tagRowsSummary[1].expense, 100)
  assert.equal(tagRowsSummary[1].income, 70)
  assert.equal(tagsLabel(['a', 'b']), '#a #b')
  assert.equal(tagsLabel(undefined), '')


  // --- Kekayaan bersih bulanan ---
  {
    const nwAccounts = [
      { id: 'nw-a', name: 'Kas', kind: 'cash', openingBalance: 1000, color: '#000', sortOrder: 0, archived: false, createdAt: '2026-01-01T00:00:00.000Z' },
    ] as Account[]
    const nwTx = [
      { id: 'nw-1', type: 'income', amount: 500, accountId: 'nw-a', categoryId: 'c', occurredAt: '2026-09-10' },
      { id: 'nw-2', type: 'expense', amount: 200, accountId: 'nw-a', categoryId: 'c', occurredAt: '2026-10-05' },
    ] as Transaction[]
    const nwDebts = [
      { id: 'nw-d1', direction: 'owe', person: 'A', amount: 300, accountId: 'nw-a', createdAt: '2026-10-02T00:00:00.000Z', updatedAt: '' },
      { id: 'nw-d2', direction: 'lent', person: 'B', amount: 400, createdAt: '2026-10-03T00:00:00.000Z', updatedAt: '' },
    ] as Debt[]
    const nwPays = [
      { id: 'nw-p1', debtId: 'nw-d1', amount: 100, accountId: 'nw-a', occurredAt: '2026-11-02', createdAt: '' },
    ] as DebtPayment[]
    const series = netWorthSeries(nwAccounts, nwTx, nwDebts, nwPays, '2026-11-16', 4)
    assert.equal(series.length, 4)
    assert.deepEqual(series.map((p) => p.key), ['2026-08', '2026-09', '2026-10', '2026-11'])
    assert.equal(series[0].netWorth, 1000)
    assert.equal(series[1].netWorth, 1500)
    // Okt: kas 1000+500-200+300(pinjaman masuk)=1600; piutang 400; hutang 300
    assert.equal(series[2].cash, 1600)
    assert.equal(series[2].netWorth, 1700)
    // Nov: bayar 100 -> kas 1500, hutang 200
    assert.equal(series[3].cash, 1500)
    assert.equal(series[3].payable, 200)
    assert.equal(series[3].netWorth, 1500 + 400 - 200)
    assert.equal(series[3].asOf, '2026-11-16')
    assert.equal(trimLeadingEmpty(netWorthSeries([], [], [], [], '2026-11-16', 3)).length, 3)
  }


  // --- Pengingat tagihan ---
  {
    const mk = (id: string, nextRunAt: string, extra: Record<string, unknown> = {}) =>
      ({
        id, type: 'expense', amount: 100000, accountId: 'a', categoryId: 'c', note: id,
        frequency: 'monthly', interval: 1, startDate: '2026-01-01', nextRunAt,
        active: true, createdAt: '', updatedAt: '', ...extra,
      }) as unknown as import('../src/types').RecurringTransaction
    const rules = [
      mk('hari-ini', '2026-11-16'),
      mk('lusa', '2026-11-18'),
      mk('jauh', '2026-11-30'),
      mk('nonaktif', '2026-11-17', { active: false }),
      mk('pemasukan', '2026-11-17', { type: 'income' }),
      mk('selesai', '2026-11-17', { endDate: '2026-11-10' }),
    ]
    const bills = upcomingBills(rules, '2026-11-16')
    assert.deepEqual(bills.map((b) => b.rule.id), ['hari-ini', 'lusa'])
    assert.equal(bills[1].daysUntil, 2)
    const first = evaluateBillReminders(bills, undefined, true)
    assert.equal(first.events.length, 2)
    const second = evaluateBillReminders(bills, first.nextSeen, true)
    assert.equal(second.events.length, 0)
    // Setelah dijalankan, tanggal berikutnya berbeda -> pengingat baru
    const advanced = upcomingBills([mk('hari-ini', '2026-11-20')], '2026-11-16')
    assert.equal(evaluateBillReminders(advanced, first.nextSeen, true).events.length, 1)
    // Notifikasi mati: tidak ada event, tapi tercatat sebagai sudah dilihat
    const muted = evaluateBillReminders(bills, undefined, false)
    assert.equal(muted.events.length, 0)
    assert.equal(evaluateBillReminders(bills, muted.nextSeen, true).events.length, 0)
    // Kunci tagihan yang tak relevan lagi dibuang
    assert.deepEqual(evaluateBillReminders([], first.nextSeen, true).nextSeen, [])
    assert.ok(billReminderMessage(bills[0]).body.includes('hari ini'))
  }


  // --- Urutan rekening & saldo hanya rekening aktif ---
  {
    assert.deepEqual(moveInOrder(['a', 'b', 'c'], 'b', 'up'), ['b', 'a', 'c'])
    assert.deepEqual(moveInOrder(['a', 'b', 'c'], 'b', 'down'), ['a', 'c', 'b'])
    assert.equal(moveInOrder(['a', 'b', 'c'], 'a', 'up'), null)
    assert.equal(moveInOrder(['a', 'b', 'c'], 'c', 'down'), null)
    assert.equal(moveInOrder(['a', 'b'], 'zzz', 'up'), null)

    await db.accounts.clear()
    const mkAcc = (id: string, sortOrder: number, archived = false, openingBalance = 0) =>
      ({ id, name: id, kind: 'bank', openingBalance, color: '#000', sortOrder, archived, createdAt: '2026-01-01T00:00:00.000Z' }) as Account
    await db.accounts.bulkAdd([mkAcc('o-a', 1), mkAcc('o-arsip', 2, true), mkAcc('o-b', 3), mkAcc('o-c', 4)])
    assert.equal(await moveAccount('o-c', 'up'), true)
    let order = (await db.accounts.orderBy('sortOrder').toArray()).map((x) => x.id)
    // Aktif berurutan dulu (a, c, b), arsip selalu di bawah
    assert.deepEqual(order, ['o-a', 'o-c', 'o-b', 'o-arsip'])
    assert.equal(await moveAccount('o-a', 'up'), false)
    assert.equal(await moveAccount('o-arsip', 'up'), false)
    assert.equal(await moveAccount('o-b', 'down'), false)
    assert.equal(await moveAccount('o-b', 'up'), true)
    order = (await db.accounts.orderBy('sortOrder').toArray()).map((x) => x.id)
    assert.deepEqual(order, ['o-a', 'o-b', 'o-c', 'o-arsip'])

    // Kekayaan bersih hanya menghitung rekening yang diberikan; transfer ke arsip mengurangi kas aktif
    const act = [mkAcc('n-a', 1, false, 1000)]
    const trf = [
      { id: 't1', fromAccountId: 'n-a', toAccountId: 'n-arsip', amount: 300, occurredAt: '2026-11-05', createdAt: '', updatedAt: '' },
    ] as import('../src/types').Transfer[]
    const nwPoint = netWorthSeries(act, [], [], [], '2026-11-16', 2, trf)
    assert.equal(nwPoint[0].cash, 1000)
    assert.equal(nwPoint[1].cash, 700)
    await db.accounts.clear()
  }


  // --- AI memahami transfer ---
  {
    const mk = (id: string, name: string, archived = false) =>
      ({ id, name, kind: 'bank', openingBalance: 0, color: '#000', sortOrder: 1, archived, createdAt: '' }) as Account
    const accs = [mk('a-tunai', 'Tunai'), mk('a-bca', 'BCA'), mk('a-gopay', 'Gopay'), mk('a-lama', 'Mandiri', true)]

    const t = readAiEntry(
      { type: 'transfer', amount: 50000.4, fromAccountName: 'BCA', toAccountName: 'Gopay', occurredAt: '2026-11-17', note: 'Top up Gopay' },
      '2026-11-16',
    )
    assert.equal(t?.kind, 'transfer')
    if (t?.kind === 'transfer') {
      assert.equal(t.transfer.amount, 50000)
      const resolved = resolveAiTransfer(t.transfer, accs)
      assert.ok(resolved)
      assert.equal(resolved?.fromAccountId, 'a-bca')
      assert.equal(resolved?.toAccountId, 'a-gopay')
    }
    // tanggal tidak valid -> hari ini; jenis biasa tetap terbaca
    const e = readAiEntry({ type: 'pengeluaran', amount: 25000, categoryName: 'Makan', accountName: 'Gopay', occurredAt: 'kemarin' }, '2026-11-16')
    assert.equal(e?.kind, 'transaction')
    if (e?.kind === 'transaction') {
      assert.equal(e.draft.type, 'expense')
      assert.equal(e.draft.occurredAt, '2026-11-16')
    }
    assert.equal(readAiEntry({ type: 'transfer', amount: 0 }, '2026-11-16'), null)
    assert.equal(readAiEntry({ type: 'lainnya', amount: 100 }, '2026-11-16'), null)

    // pencocokan nama: huruf besar/kecil, saling mengandung, arsip diabaikan
    assert.equal(matchAccountName('bca', accs)?.id, 'a-bca')
    assert.equal(matchAccountName('GoPay wallet', accs)?.id, 'a-gopay')
    assert.equal(matchAccountName('Mandiri', accs), null)
    assert.equal(matchAccountName('', accs), null)
    // asal = tujuan atau rekening tak dikenal -> null
    assert.equal(resolveAiTransfer({ amount: 1, fromAccountName: 'BCA', toAccountName: 'bca', occurredAt: '2026-11-16', note: '' }, accs), null)
    assert.equal(resolveAiTransfer({ amount: 1, fromAccountName: 'BCA', toAccountName: 'OVO', occurredAt: '2026-11-16', note: '' }, accs), null)
  }


  // --- Biaya admin, transfer berulang, tabungan menggerakkan saldo ---
  {
    await db.accounts.clear()
    await db.transactions.clear()
    await db.transfers.clear()
    await db.recurringTransactions.clear()
    await db.goalContributions.clear()
    await db.goals.clear()
    const mkAcc = (id: string, openingBalance: number, archived = false) =>
      ({ id, name: id, kind: 'bank', openingBalance, color: '#000', sortOrder: 1, archived, createdAt: '2026-01-01T00:00:00.000Z' }) as Account
    await db.accounts.bulkAdd([mkAcc('f-a', 1000000), mkAcc('f-b', 0), mkAcc('f-arsip', 0, true)])
    const balanceOf = async (id: string, extraFlows: import('../src/types').AccountFlow[] = []) => {
      const account = (await db.accounts.get(id)) as Account
      return accountBalance(account, await db.transactions.toArray(), await db.transfers.toArray(), extraFlows)
    }

    // Transfer dengan biaya admin: asal berkurang amount+fee, tujuan bertambah amount
    const trf = await createTransfer({ fromAccountId: 'f-a', toAccountId: 'f-b', amount: 50000, fee: 1500, occurredAt: '2026-11-10', note: 'Top up' })
    assert.equal(trf.fee, 1500)
    assert.ok(trf.feeTransactionId)
    assert.equal(await balanceOf('f-a'), 1000000 - 50000 - 1500)
    assert.equal(await balanceOf('f-b'), 50000)
    const feeTx = await db.transactions.get(trf.feeTransactionId as string)
    assert.equal(feeTx?.type, 'expense')
    assert.equal(feeTx?.amount, 1500)
    const feeCat = await db.categories.get(feeTx?.categoryId as string)
    assert.equal(feeCat?.name, 'Biaya Admin')

    // Transfer kedua memakai kategori yang sama (tidak membuat duplikat)
    await createTransfer({ fromAccountId: 'f-a', toAccountId: 'f-b', amount: 10000, fee: 500, occurredAt: '2026-11-11' })
    assert.equal(await db.categories.filter((c) => c.name === 'Biaya Admin').count(), 1)

    // Ubah biaya -> transaksi biaya ikut berubah; hapus biaya -> transaksi dihapus
    await updateTransfer(trf.id, { fromAccountId: 'f-a', toAccountId: 'f-b', amount: 50000, fee: 2500, occurredAt: '2026-11-10', note: 'Top up' })
    assert.equal((await db.transactions.get(trf.feeTransactionId as string))?.amount, 2500)
    await updateTransfer(trf.id, { fromAccountId: 'f-a', toAccountId: 'f-b', amount: 50000, occurredAt: '2026-11-10', note: 'Top up' })
    assert.equal(await db.transactions.get(trf.feeTransactionId as string), undefined)
    assert.equal((await db.transfers.get(trf.id))?.fee, undefined)
    // Tambah biaya lagi pada transfer tanpa biaya
    await updateTransfer(trf.id, { fromAccountId: 'f-a', toAccountId: 'f-b', amount: 50000, fee: 700, occurredAt: '2026-11-10' })
    const refreshed = await db.transfers.get(trf.id)
    assert.equal(refreshed?.fee, 700)
    assert.ok(await db.transactions.get(refreshed?.feeTransactionId as string))
    // Hapus transfer -> biaya ikut terhapus
    await deleteTransfer(trf.id)
    assert.equal(await db.transactions.get(refreshed?.feeTransactionId as string), undefined)
    assert.equal(await db.transfers.get(trf.id), undefined)
    await assert.rejects(() => createTransfer({ fromAccountId: 'f-a', toAccountId: 'f-b', amount: 100, fee: -5, occurredAt: '2026-11-10' }))

    // Transfer berulang
    await db.transfers.clear()
    await db.transactions.clear()
    const rule = await createRecurring({
      type: 'expense', amount: 200000, accountId: 'f-a', categoryId: '', toAccountId: 'f-b', fee: 1000,
      note: 'Nabung bulanan', frequency: 'monthly', interval: 1, startDate: '2026-09-05',
    })
    const rrun = await processDueRecurring('2026-11-16')
    assert.equal(rrun.created, 3)
    assert.equal(rrun.transfers, 3)
    assert.equal(await db.transfers.count(), 3)
    assert.equal(await db.transactions.count(), 3) // tiga biaya admin
    assert.ok((await db.transfers.toArray()).every((t) => t.recurringId === rule.id && t.fee === 1000))
    assert.equal((await db.recurringTransactions.get(rule.id))?.nextRunAt, '2026-12-05')
    assert.equal(await balanceOf('f-b'), 600000)
    assert.equal(await balanceOf('f-a'), 1000000 - 600000 - 3000)
    // Dijalankan lagi hari yang sama: tidak ada duplikat
    assert.equal((await processDueRecurring('2026-11-16')).created, 0)
    // Tujuan diarsipkan -> aturan dijeda, tidak membuat transfer
    await db.accounts.update('f-b', { archived: true })
    const rrun2 = await processDueRecurring('2026-12-06')
    assert.equal(rrun2.created, 0)
    assert.equal(rrun2.paused, 1)
    assert.equal((await db.recurringTransactions.get(rule.id))?.active, false)
    await db.accounts.update('f-b', { archived: false })
    // Aturan transfer tidak muncul sebagai pengingat tagihan
    const { upcomingBills } = await import('../src/lib/billReminders')
    assert.equal(upcomingBills([{ ...rule, active: true, nextRunAt: '2026-11-18' }], '2026-11-16').length, 0)

    // Tabungan tujuan menggerakkan saldo
    const goalX = await createGoal({ name: 'Dana darurat', targetAmount: 1000000, color: '#10b981' })
    await db.transfers.clear()
    await db.transactions.clear()
    const dep = await addGoalContribution({ goalId: goalX.id, kind: 'deposit', amount: 300000, occurredAt: '2026-11-10', accountId: 'f-a' })
    await addGoalContribution({ goalId: goalX.id, kind: 'deposit', amount: 50000, occurredAt: '2026-11-11' }) // tanpa rekening
    const contribs = await db.goalContributions.toArray()
    const gflows = goalAccountFlows(contribs)
    assert.equal(gflows.length, 1)
    assert.equal(await balanceOf('f-a', gflows), 1000000 - 300000)
    await assert.rejects(() => addGoalContribution({ goalId: goalX.id, kind: 'deposit', amount: 1, occurredAt: '2026-11-10', accountId: 'tidak-ada' }))
    await addGoalContribution({ goalId: goalX.id, kind: 'withdrawal', amount: 100000, occurredAt: '2026-11-12', accountId: 'f-a' })
    const gflows2 = goalAccountFlows(await db.goalContributions.toArray())
    assert.equal(await balanceOf('f-a', gflows2), 1000000 - 300000 + 100000)
    assert.equal(goalSaved(await db.goalContributions.toArray(), goalX.id), 250000)

    // Kekayaan bersih tidak berubah oleh setoran tabungan dari rekening
    const accsNow = (await db.accounts.toArray()).filter((a) => !a.archived)
    const base = netWorthSeries(accsNow, [], [], [], '2026-11-16', 1, [], [])
    const withGoal = netWorthSeries(accsNow, [], [], [], '2026-11-16', 1, [], await db.goalContributions.toArray())
    assert.equal(base[0].netWorth, withGoal[0].netWorth + 0 - 0 + (withGoal[0].savings - withGoal[0].savings))
    assert.equal(withGoal[0].savings, 200000)
    assert.equal(withGoal[0].cash, base[0].cash - 200000)
    assert.equal(withGoal[0].netWorth, base[0].netWorth)
    void dep

    // Backup memuat dan memvalidasi kolom baru
    await createTransfer({ fromAccountId: 'f-a', toAccountId: 'f-b', amount: 1000, fee: 100, occurredAt: '2026-11-12' })
    const backupNew = await buildBackup()
    validateBackup(backupNew)
    assert.ok(backupNew.recurringTransactions?.some((r) => r.toAccountId === 'f-b'))
    assert.ok(backupNew.goalContributions?.some((c) => c.accountId === 'f-a'))
    assert.throws(() =>
      validateBackup({ ...backupNew, goalContributions: backupNew.goalContributions?.map((c) => ({ ...c, accountId: c.accountId ? 'hilang' : undefined })) }),
    )

    await db.accounts.clear()
    await db.transactions.clear()
    await db.transfers.clear()
    await db.recurringTransactions.clear()
    await db.goalContributions.clear()
    await db.goals.clear()
  }


  // --- Pengingat harian, urutan kategori, baca struk ---
  {
    const base = { enabled: true, time: '20:00', nowMinutes: 21 * 60, today: '2026-11-17', hasEntryToday: false } as const
    assert.equal(shouldRemindToday(base), true)
    assert.equal(shouldRemindToday({ ...base, enabled: false }), false)
    assert.equal(shouldRemindToday({ ...base, nowMinutes: 19 * 60 + 59 }), false)
    assert.equal(shouldRemindToday({ ...base, nowMinutes: 20 * 60 }), true)
    assert.equal(shouldRemindToday({ ...base, hasEntryToday: true }), false)
    assert.equal(shouldRemindToday({ ...base, lastReminded: '2026-11-17' }), false)
    assert.equal(shouldRemindToday({ ...base, lastReminded: '2026-11-16' }), true)
    assert.equal(shouldRemindToday({ ...base, time: 'rusak', nowMinutes: 20 * 60 }), true) // jatuh ke 20:00

    const widget = widgetTexts(
      {
        balance: 1500000, income: 200000, expense: 50000,
        budget: { limit: 400000, spent: 100000 },
        accounts: [{ name: 'BCA', balance: 1000000 }, { name: 'Dompet', balance: 500000 }],
        trends: {},
      },
      new Date(2026, 10, 18, 9, 5),
    )
    assert.ok(widget.balance.includes('1.500.000'))
    assert.ok(widget.expense.includes('50.000') && widget.income.includes('200.000'))
    assert.equal(widget.budget, 'Budget 25% terpakai')
    assert.equal(widget.updated, 'Diperbarui 09.05')
    assert.equal(JSON.parse(widget.accounts).length, 2)
    assert.equal(JSON.parse(widget.accounts)[0].n, 'BCA')
    assert.equal(
      widgetTexts({ balance: 0, income: 0, expense: 0, budget: { limit: 0, spent: 0 }, accounts: [], trends: {} }, new Date()).budget,
      '',
    )
    assert.ok(trendSummary([{ key: 'a', label: 'a', income: 100, expense: 40, net: 60 }, { key: 'b', label: 'b', income: 50, expense: 10, net: 40 }]).includes('150'))
    assert.equal(extractNativeUrl({ a: { url: 'rfuangku://new' } }, 'rfuangku://new'), 'rfuangku://new')
    assert.equal(extractNativeUrl('{"url":"rfuangku://auth#x"}', 'rfuangku://new'), undefined)

    // Parser notifikasi bank/e-wallet
    const raw = (text: string, pkg = 'id.co.bri.brimo', title = 'Info', time = new Date(2026, 10, 18, 10, 0).getTime()) =>
      ({ id: `${pkg}:${time}:${text.length}`, pkg, title, text, time })
    assert.equal(parseIdrAmount('1.250.000'), 1250000)
    assert.equal(parseIdrAmount('1.250.000,50'), 1250000)
    assert.equal(parseIdrAmount('50,000'), 50000)
    assert.equal(parseIdrAmount('75000'), 75000)
    assert.equal(parseIdrAmount('15.000,5'), 15000)
    const out = parseBankNotification(raw('Transfer ke BUDI berhasil sebesar Rp 250.000. Saldo Rp 1.000.000'))
    assert.equal(out?.type, 'expense')
    assert.equal(out?.amount, 250000)
    assert.equal(out?.source, 'BRImo')
    assert.equal(out?.occurredAt, '2026-11-18')
    const inc = parseBankNotification(raw('Anda menerima Rp1.500.000 dari ANI', 'id.dana', 'DANA'))
    assert.equal(inc?.type, 'income')
    assert.equal(inc?.amount, 1500000)
    assert.equal(inc?.source, 'DANA')
    assert.equal(parseBankNotification(raw('Kode OTP Anda 123456, jangan bagikan. Rp 50.000')), null)
    assert.equal(parseBankNotification(raw('Top up GoPay Rp 100.000 berhasil', 'com.gojek.app')), null)
    assert.equal(parseBankNotification(raw('Saldo Anda saat ini Rp 2.000.000')), null)
    assert.equal(parseBankNotification(raw('Pembayaran QRIS di KOPI KENANGAN Rp 28.000', 'ovo.id'))?.type, 'expense')
    const first = parseBankNotification(raw('Pembayaran Rp 28.000 berhasil'))!
    const twin = { ...first, id: 'lain', time: first.time + 30_000 }
    const later = { ...first, id: 'nanti', time: first.time + 10 * 60_000 }
    assert.equal(mergePending([first], [twin]).length, 1)
    assert.equal(mergePending([first], [first]).length, 1)
    assert.equal(mergePending([first], [later]).length, 2)

    assert.equal(releaseBuild('native-v1.1.0-36'), 236)
    assert.equal(releaseBuild('v1.0'), null)
    const rel = { tag_name: 'native-v1.2.0-40', body: 'fix: sesuatu\n\ncatatan', assets: [{ name: 'rf-uangku-native.apk', browser_download_url: 'https://x/y.apk' }] }
    assert.equal(pickUpdate(rel, 236)?.build, 240)
    assert.equal(pickUpdate(rel, 236)?.version, '1.2.0')
    assert.equal(pickUpdate(rel, 236)?.notes, 'fix: sesuatu')
    assert.equal(pickUpdate(rel, 240), null)
    assert.equal(pickUpdate({ ...rel, assets: [] }, 100), null)

    const now = new Date(2026, 10, 18, 15, 0)
    const plan = (over: Partial<Parameters<typeof planReminderTimes>[0]> = {}) =>
      planReminderTimes({ enabled: true, time: '20:00', now, hasEntryToday: false, ...over })
    assert.equal(plan().length, 7)
    assert.equal(plan()[0].getDate(), 18)
    assert.equal(plan()[0].getHours(), 20)
    assert.equal(plan({ enabled: false }).length, 0)
    assert.equal(plan({ hasEntryToday: true }).length, 6) // hari ini dilewati
    assert.equal(plan({ hasEntryToday: true })[0].getDate(), 19)
    assert.equal(plan({ now: new Date(2026, 10, 18, 21, 0) })[0].getDate(), 19) // jam sudah lewat
    assert.equal(plan({ time: 'rusak' })[0].getHours(), 20)
    assert.equal(plan({ days: 3 }).length, 3)

    await db.categories.clear()
    const mkCat = (id: string, type: 'income' | 'expense', sortOrder: number, archived = false) =>
      ({ id, name: id, type, color: '#000', sortOrder, archived, createdAt: '' }) as import('../src/types').Category
    await db.categories.bulkAdd([
      mkCat('e1', 'expense', 1), mkCat('i1', 'income', 2), mkCat('e2', 'expense', 3),
      mkCat('e-arsip', 'expense', 4, true), mkCat('e3', 'expense', 5), mkCat('i2', 'income', 6),
    ])
    assert.equal(await moveCategory('e3', 'up'), true)
    const order = async (type: string) =>
      (await db.categories.orderBy('sortOrder').toArray()).filter((c) => c.type === type).map((c) => c.id)
    assert.deepEqual(await order('expense'), ['e1', 'e3', 'e2', 'e-arsip'])
    assert.deepEqual(await order('income'), ['i1', 'i2']) // jenis lain tidak terganggu
    assert.equal(await moveCategory('e1', 'up'), false)
    assert.equal(await moveCategory('e-arsip', 'up'), false)
    assert.equal(await moveCategory('i1', 'down'), true)
    assert.deepEqual(await order('income'), ['i2', 'i1'])
    const catList = await db.categories.toArray()
    assert.equal(matchExpenseCategory('E2', catList)?.id, 'e2')
    assert.equal(matchExpenseCategory('tidak ada', catList)?.type, 'expense')
    assert.equal(matchExpenseCategory('e-arsip', catList)?.archived, false)
    await db.categories.clear()

    const r = readReceiptResult({ total: '125000.4', date: '2026-11-10', merchant: ' Toko Maju ', categoryName: 'Belanja', note: 'Beras, minyak' }, '2026-11-17')
    assert.equal(r?.amount, 125000)
    assert.equal(r?.occurredAt, '2026-11-10')
    assert.equal(r?.merchant, 'Toko Maju')
    assert.equal(readReceiptResult({ total: 0 }, '2026-11-17'), null)
    assert.equal(readReceiptResult({ total: 'abc' }, '2026-11-17'), null)
    assert.equal(readReceiptResult({ total: 5000, date: '2030-01-01' }, '2026-11-17')?.occurredAt, '2026-11-17')
    assert.equal(readReceiptResult({ total: 5000, date: 'kemarin' }, '2026-11-17')?.occurredAt, '2026-11-17')
  }

  await db.delete()
  console.log('Semua verifikasi data lulus.')
}

main().catch((error) => {
  console.error('Verifikasi gagal:', error)
  process.exitCode = 1
})
