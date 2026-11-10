import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Target } from 'lucide-react'
import type { BudgetProgress, BudgetSummary } from '../../types'
import { budgetBarClass, budgetStatusLabel, budgetTextClass } from '../../lib/budget'
import { formatPercent, formatRupiah } from '../../lib/format'
import { Badge } from '../ui/Badge'

interface BudgetOverviewProps {
  progress: BudgetProgress[]
  summary: BudgetSummary
}

export function BudgetOverview({ progress, summary }: BudgetOverviewProps) {
  if (progress.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300">
            <Target className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Atur budget bulanan
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Tetapkan batas pengeluaran per kategori agar lebih mudah mengontrol uang bulan ini.
            </p>
          </div>
          <Link
            to="/planning?tab=budget"
            className="flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            Buat
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Budget bulan ini
          </p>
          <p className="mt-1 text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            {formatRupiah(summary.spent)}{' '}
            <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">
              / {formatRupiah(summary.limit)}
            </span>
          </p>
        </div>
        <Link
          to="/planning?tab=budget"
          className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
        >
          Kelola
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${
            summary.percentage >= 100
              ? 'bg-rose-500'
              : summary.percentage >= 80
                ? 'bg-amber-500'
                : 'bg-emerald-500'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, summary.percentage))}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="font-semibold text-slate-500 dark:text-slate-400">
          {formatPercent(summary.percentage)} terpakai
        </span>
        <span
          className={
            summary.remaining < 0
              ? 'font-semibold text-rose-600 dark:text-rose-400'
              : 'font-semibold text-slate-500 dark:text-slate-400'
          }
        >
          {summary.remaining < 0
            ? `Lebih ${formatRupiah(Math.abs(summary.remaining))}`
            : `Sisa ${formatRupiah(summary.remaining)}`}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {progress.slice(0, 3).map((item) => (
          <div key={item.budgetId} className="flex items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.categoryColor }}
            />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-600 dark:text-slate-300">
              {item.categoryName}
            </span>
            <span className={`text-[11px] font-semibold ${budgetTextClass(item.status)}`}>
              {formatPercent(item.percentage)}
            </span>
            <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 sm:block">
              <div
                className={`h-full rounded-full ${budgetBarClass(item.status)}`}
                style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }}
              />
            </div>
            <Badge
              variant={
                item.status === 'over'
                  ? 'expense'
                  : item.status === 'warning'
                    ? 'warning'
                    : 'success'
              }
            >
              {budgetStatusLabel(item.status)}
            </Badge>
          </div>
        ))}
      </div>

      {summary.overCount > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-[11px] leading-relaxed text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {summary.overCount} kategori melewati budget bulan ini.
        </p>
      )}
    </section>
  )
}
