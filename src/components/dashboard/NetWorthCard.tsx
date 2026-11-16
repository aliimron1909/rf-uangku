import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import type { Account, DebtPayment, Debt, GoalContribution, Transaction, Transfer } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'
import { CHART_COLORS } from '../../lib/constants'
import { todayISO } from '../../lib/dates'
import { formatCompactRupiah, formatRupiah } from '../../lib/format'
import { netWorthSeries, trimLeadingEmpty } from '../../lib/networth'
import { cn } from '../../lib/utils'

interface NetWorthCardProps {
  accounts: Account[]
  transactions: Transaction[]
  debts: Debt[]
  payments: DebtPayment[]
  transfers: Transfer[]
  goalContributions: GoalContribution[]
}

export function NetWorthCard({
  accounts,
  transactions,
  debts,
  payments,
  transfers,
  goalContributions,
}: NetWorthCardProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const today = todayISO()
  const data = useMemo(
    () => trimLeadingEmpty(netWorthSeries(accounts, transactions, debts, payments, today, 12, transfers, goalContributions)),
    [accounts, transactions, debts, payments, transfers, goalContributions, today],
  )

  if (data.length < 2) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        Grafik kekayaan bersih muncul setelah ada data minimal dua bulan.
      </div>
    )
  }
  const last = data[data.length - 1]
  const prev = data[data.length - 2]
  const change = last.netWorth - prev.netWorth

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
            <TrendingUp className="h-4 w-4 text-sky-500" />
            Kekayaan Bersih
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Saldo rekening + tabungan tujuan + piutang − hutang, akhir tiap bulan
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
            {formatRupiah(last.netWorth)}
          </p>
          <p
            className={cn(
              'text-[11px] font-semibold',
              change >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400',
            )}
          >
            {change >= 0 ? '+' : '−'}
            {formatRupiah(Math.abs(change))} vs bulan lalu
          </p>
        </div>
      </div>

      <div className="mt-4 h-[200px] w-full sm:h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="networthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.net} stopOpacity={0.35} />
                <stop offset="100%" stopColor={CHART_COLORS.net} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={isDark ? CHART_COLORS.gridDark : CHART_COLORS.gridLight}
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: isDark ? CHART_COLORS.textDark : CHART_COLORS.textLight }}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={64}
              tick={{ fontSize: 10, fill: isDark ? CHART_COLORS.textDark : CHART_COLORS.textLight }}
              tickFormatter={(value) => formatCompactRupiah(Number(value))}
            />
            <Tooltip
              formatter={(value) => [formatRupiah(Number(value)), 'Kekayaan bersih']}
              contentStyle={{
                borderRadius: 12,
                border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                background: isDark ? '#0f172a' : '#ffffff',
                color: isDark ? '#f1f5f9' : '#0f172a',
                fontSize: 12,
              }}
              labelStyle={{ fontWeight: 700, marginBottom: 4 }}
            />
            <Area
              type="monotone"
              dataKey="netWorth"
              stroke={CHART_COLORS.net}
              strokeWidth={2}
              fill="url(#networthFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
