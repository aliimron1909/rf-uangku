import { useMemo, useState } from 'react'
import type { Granularity } from '../types'
import { useAllAccounts } from './useAccounts'
import { useAllCategories } from './useCategories'
import { useBudgets } from './useBudgets'
import { useTransactions } from './useTransactions'
import { useTransfers } from './useTransfers'
import { useDebts } from './useDebts'
import {
  accountsWithBalance,
  categoryBreakdown,
  computeTotals,
  withRefs,
} from '../lib/analytics'
import { buildTrend, monthRange } from '../lib/dates'
import { budgetProgress, budgetSummary } from '../lib/budget'
import { debtAccountFlows } from '../lib/debts'

export function useDashboardData() {
  const transactions = useTransactions()
  const transfers = useTransfers()
  const { debts, payments: debtPayments } = useDebts()
  // Use all accounts/categories so archived master data still resolves
  // correctly on historical transactions.
  const accounts = useAllAccounts()
  const categories = useAllCategories()
  const budgets = useBudgets()
  const [granularity, setGranularity] = useState<Granularity>('monthly')

  const month = useMemo(() => monthRange(), [])
  const monthTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.occurredAt >= month.start && transaction.occurredAt <= month.end,
      ),
    [transactions, month],
  )

  const totals = useMemo(() => computeTotals(monthTransactions), [monthTransactions])
  const debtFlows = useMemo(() => debtAccountFlows(debts, debtPayments), [debts, debtPayments])
  const trend = useMemo(() => buildTrend(transactions, granularity), [transactions, granularity])
  const breakdown = useMemo(
    () => categoryBreakdown(monthTransactions, categories),
    [monthTransactions, categories],
  )
  const recent = useMemo(
    () => withRefs(transactions.slice(0, 4), accounts, categories),
    [transactions, accounts, categories],
  )
  // Rekening arsip tidak tampil di dashboard dan tidak dihitung dalam saldo total,
  // supaya total selalu sama dengan jumlah daftar rekening. Urutan mengikuti Pengaturan.
  const activeAccounts = useMemo(
    () => accounts.filter((account) => !account.archived),
    [accounts],
  )
  const archivedCount = accounts.length - activeAccounts.length
  const balances = useMemo(
    () => accountsWithBalance(activeAccounts, transactions, transfers, debtFlows),
    [activeAccounts, transactions, transfers, debtFlows],
  )
  const balance = useMemo(
    () => balances.reduce((sum, account) => sum + account.balance, 0),
    [balances],
  )
  const budgetItems = useMemo(
    () => budgetProgress(budgets, monthTransactions, categories, month),
    [budgets, monthTransactions, categories, month],
  )
  const budget = useMemo(
    () => budgetSummary(budgetItems, monthTransactions, categories, month),
    [budgetItems, monthTransactions, categories, month],
  )

  return {
    transactions,
    debts,
    debtPayments,
    accounts,
    activeAccounts,
    archivedCount,
    transfers,
    categories,
    granularity,
    setGranularity,
    month,
    monthTransactions,
    totals,
    balance,
    trend,
    breakdown,
    recent,
    balances,
    budgetItems,
    budget,
  }
}
