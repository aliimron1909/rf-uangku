import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCategories } from '../../hooks/useCategories'
import { useDashboardData } from '../../hooks/useDashboard'
import { useDebts } from '../../hooks/useDebts'
import { useRecurringTransactions } from '../../hooks/useRecurringTransactions'
import { NATIVE_NEW_LINK, extractNativeUrl, nativePlugin } from '../../lib/native'
import { pushWidgetData, WIDGET_PERIODS, type WidgetPeriod } from '../../lib/nativeWidget'
import { buildTrend, monthKey, todayISO } from '../../lib/dates'
import { debtProgress } from '../../lib/debts'
import { monthlyInsights } from '../../lib/insights'
import { widgetDues } from '../../lib/widgetDue'
import type { Granularity, TrendPoint } from '../../types'

interface AppPlugin {
  addListener(eventName: string, handler: (event: unknown) => void): unknown
  getLaunchUrl?(): Promise<unknown>
}

/** Aplikasi native: menyegarkan widget saldo dan membuka form transaksi saat tombol "+" widget diketuk. */
export function NativeWidgetSync() {
  const { balance, totals, balances, budget, transactions } = useDashboardData()
  const navigate = useNavigate()
  const rules = useRecurringTransactions()
  const { debts, payments } = useDebts()
  const categories = useCategories()
  const duesJson = useMemo(() => {
    const today = todayISO()
    return JSON.stringify(
      widgetDues(rules, debtProgress(debts, payments, today), categories, today, 6, transactions),
    )
  }, [rules, debts, payments, categories, transactions])
  const insightsJson = useMemo(
    () =>
      JSON.stringify(
        monthlyInsights(transactions, categories, monthKey(), todayISO())
          .insights.slice(0, 3)
          .map((item) => item.text),
      ),
    [transactions, categories],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const granularity: Record<WidgetPeriod, Granularity> = {
        daily: 'daily',
        weekly: 'weekly',
        monthly: 'monthly',
        yearly: 'yearly',
      }
      const trends: Partial<Record<WidgetPeriod, TrendPoint[]>> = {}
      for (const period of WIDGET_PERIODS) trends[period] = buildTrend(transactions, granularity[period]).data
      void pushWidgetData({
        balance,
        income: totals.income,
        expense: totals.expense,
        budget: { limit: budget.limit, spent: budget.spent },
        accounts: balances.map((account) => ({ name: account.name, balance: account.balance })),
        trends,
        dues: JSON.parse(duesJson),
        insights: JSON.parse(insightsJson),
      }).catch(() => undefined)
    }, 800)
    return () => window.clearTimeout(timer)
  }, [balance, totals.income, totals.expense, balances, budget.limit, budget.spent, transactions, duesJson, insightsJson])

  useEffect(() => {
    const app = nativePlugin<AppPlugin>('App')
    if (!app) return
    const open = (value: unknown) => {
      if (extractNativeUrl(value, NATIVE_NEW_LINK)) navigate('/transactions?new=1')
    }
    try {
      app.addListener('appUrlOpen', open)
      void app.getLaunchUrl?.().then(open).catch(() => undefined)
    } catch {
      // Tanpa listener, widget tetap membuka aplikasi.
    }
  }, [navigate])

  return null
}
