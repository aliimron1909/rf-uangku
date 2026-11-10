import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { PieChart as PieIcon } from 'lucide-react'
import type { CategoryBreakdown } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'
import { formatPercent, formatRupiah } from '../../lib/format'
import { EmptyState } from '../ui/EmptyState'

interface CategoryDonutProps {
  data: CategoryBreakdown[]
  totalExpense: number
  periodLabel: string
}

export function CategoryDonut({ data, totalExpense, periodLabel }: CategoryDonutProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
          Pengeluaran per Kategori
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{periodLabel}</p>
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={<PieIcon className="h-7 w-7" />}
          title="Belum ada pengeluaran"
          description="Rincian kategori akan muncul setelah ada transaksi pengeluaran."
          className="py-10"
        />
      ) : (
        <div className="mt-2 grid gap-4 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-center">
          <div className="relative mx-auto h-[230px] w-full max-w-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="total"
                  nameKey="name"
                  innerRadius={64}
                  outerRadius={92}
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatRupiah(Number(value))}
                  contentStyle={{
                    borderRadius: 12,
                    border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                    background: isDark ? '#0f172a' : '#ffffff',
                    color: isDark ? '#f1f5f9' : '#0f172a',
                    fontSize: 12,
                    boxShadow: '0 10px 25px rgba(15,23,42,0.12)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Total
              </p>
              <p className="mt-0.5 max-w-[130px] text-center text-sm font-extrabold leading-tight text-slate-900 dark:text-slate-100">
                {formatRupiah(totalExpense)}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {data.map((item) => (
              <div key={item.id} className="flex items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {item.name}
                    </p>
                    <p className="shrink-0 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {formatPercent(item.percentage)}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {formatRupiah(item.total)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
