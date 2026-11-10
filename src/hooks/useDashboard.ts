import { useMemo, useState } from 'react'
import type { Granularity } from '../types'
import { useAllAccounts } from './useAccounts'
import { useAllCategories } from './useCategories'
import { useBudgets } from './useBudgets'
import { useTransactions } from './useTransactions'
import {
  accountsWithBalance,
  categoryBreakdown,
  computeTotals,
  totalBalance,
  withRefs,
} from '../lib/analytics'
import { buildTrend, monthRange } from '../lib/dates'
import { budgetProgress, budgetSummary } from '../lib/budget'

export function useDashboardData() {
  const transactions = useTransactions()
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
  const balance = useMemo(() => totalBalance(accounts, transactions), [accounts, transactions])
  const trend = useMemo(() => buildTrend(transactions, granularity), [transactions, granularity])
  const breakdown = useMemo(
    () => categoryBreakdown(monthTransactions, categories),
    [monthTransactions, categories],
  )
  const recent = useMemo(
    () => withRefs(transactions.slice(0, 5), accounts, categories),
    [transactions, accounts, categories],
  )
  const balances = useMemo(() => {
    const rows = accountsWithBalance(accounts, transactions)
    // Keep active accounts first; archived accounts stay visible (and counted)
    // so historical transactions and total balance remain consistent.
    return [...rows].sort((a, b) => Number(a.archived) - Number(b.archived))
  }, [accounts, transactions])
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
    accounts,
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
