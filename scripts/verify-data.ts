import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { db } from '../src/db/db'
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, seedIfEmpty } from '../src/db/seed'
import { createTransaction, deleteTransaction, updateTransaction } from '../src/db/transactions'
import { upsertBudget } from '../src/db/budgets'
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
import { buildTrend, monthRange, presetRange, todayISO } from '../src/lib/dates'
import { formatNumberInput, formatRupiah, parseNumberInput } from '../src/lib/format'
import { budgetProgress, budgetSummary } from '../src/lib/budget'
import {
  advanceOccurrence,
  frequencyLabel,
  nextOccurrenceAfter,
  nextOccurrenceOnOrAfter,
} from '../src/lib/recurrence'
import { profileInitials } from '../src/lib/profile'
import { isValidPin, savePin, verifyPin, hasPin } from '../src/lib/pin'

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

  const backup = await buildBackup()
  validateBackup(backup)
  assert.equal(backup.app, 'rf-uangku')
  assert.equal(backup.version, 2)
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
    ...legacyV1
  } = backup
  const v1Backup = { ...legacyV1, version: 1 as const }
  validateBackup(v1Backup)
  await restoreBackup(v1Backup)
  assert.equal(await db.budgets.count(), 0)
  assert.equal(await db.recurringTransactions.count(), 0)
  assert.equal(await db.transactions.count(), 2)

  await db.delete()
  console.log('Semua verifikasi data lulus.')
}

main().catch((error) => {
  console.error('Verifikasi gagal:', error)
  process.exitCode = 1
})
