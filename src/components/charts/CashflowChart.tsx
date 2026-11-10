import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import type { Granularity, TrendPoint } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'
import { CHART_COLORS } from '../../lib/constants'
import { formatCompactRupiah, formatRupiah } from '../../lib/format'
import { cn } from '../../lib/utils'
import { EmptyState } from '../ui/EmptyState'

interface CashflowChartProps {
  data: TrendPoint[]
  granularity: Granularity
  onGranularityChange: (granularity: Granularity) => void
  rangeLabel: string
}

const tabs: Array<{ value: Granularity; label: string }> = [
  { value: 'daily', label: 'Harian' },
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'yearly', label: 'Tahunan' },
]

const seriesNames: Record<string, string> = {
  income: 'Pemasukan',
  expense: 'Pengeluaran',
  net: 'Selisih',
}

export function CashflowChart({
  data,
  granularity,
  onGranularityChange,
  rangeLabel,
}: CashflowChartProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const hasData = data.some((point) => point.income > 0 || point.expense > 0)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Tren Pemasukan vs Pengeluaran
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{rangeLabel}</p>
        </div>
        <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => onGranularityChange(tab.value)}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition sm:px-3 sm:text-xs',
                granularity === tab.value
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <EmptyState
          icon={<BarChart3 className="h-7 w-7" />}
          title="Belum ada data grafik"
          description="Catat pemasukan atau pengeluaran pertama untuk melihat tren keuangan."
          className="py-10"
        />
      ) : (
        <>
          <div className="mt-4 h-[260px] w-full sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
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
                  cursor={{ fill: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(100,116,139,0.06)' }}
                  formatter={(value, name) => [
                    formatRupiah(Number(value)),
                    seriesNames[String(name)] ?? String(name),
                  ]}
                  contentStyle={{
                    borderRadius: 12,
                    border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                    background: isDark ? '#0f172a' : '#ffffff',
                    color: isDark ? '#f1f5f9' : '#0f172a',
                    fontSize: 12,
                    boxShadow: '0 10px 25px rgba(15,23,42,0.12)',
                  }}
                  labelStyle={{ fontWeight: 700, marginBottom: 4 }}
                />
                <Bar
                  dataKey="income"
                  name="income"
                  fill={CHART_COLORS.income}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={18}
                />
                <Bar
                  dataKey="expense"
                  name="expense"
                  fill={CHART_COLORS.expense}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={18}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  name="net"
                  stroke={CHART_COLORS.net}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              Pemasukan
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
              Pengeluaran
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" />
              Selisih
            </span>
          </div>
        </>
      )}
    </div>
  )
}
