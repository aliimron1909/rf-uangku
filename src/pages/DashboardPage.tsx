import { Link } from 'react-router-dom'
import { ArrowRight, MessageCircle, Plus, ShieldAlert } from 'lucide-react'
import { useDashboardData } from '../hooks/useDashboard'
import { useProfile } from '../hooks/useProfile'
import { useSetting } from '../hooks/useSetting'
import { formatDate, formatDateTime } from '../lib/dates'
import { SummaryCards } from '../components/dashboard/SummaryCards'
import { CashflowChart } from '../components/charts/CashflowChart'
import { CategoryDonut } from '../components/charts/CategoryDonut'
import { RecentTransactions } from '../components/dashboard/RecentTransactions'
import { AccountBalances } from '../components/dashboard/AccountBalances'
import { BudgetOverview } from '../components/dashboard/BudgetOverview'

export function DashboardPage() {
  const {
    transactions,
    granularity,
    setGranularity,
    month,
    totals,
    balance,
    trend,
    breakdown,
    recent,
    balances,
    budgetItems,
    budget,
  } = useDashboardData()
  const { name: profileName } = useProfile()
  const lastBackupAt = useSetting<string>('lastBackupAt', '')
  const lastBackupDate = lastBackupAt ? new Date(lastBackupAt) : null
  const lastBackupValid = Boolean(lastBackupDate && !Number.isNaN(lastBackupDate.getTime()))
  const backupAge =
    lastBackupValid && lastBackupDate ? Date.now() - lastBackupDate.getTime() : Infinity

  const backupOld = transactions.length > 0 && backupAge > 7 * 24 * 60 * 60 * 1000

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Ringkasan Keuangan
          </p>
          <h2 className="mt-1 break-words text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
            Halo, {profileName} 👋
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Berikut kondisi keuanganmu di {month.label}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/transactions?chat=1"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <MessageCircle className="h-4 w-4" />
            Chat AI
          </Link>
          <Link
            to="/transactions?new=1"
            className="hidden h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 sm:inline-flex"
          >
            <Plus className="h-4 w-4" />
            Tambah Transaksi
          </Link>
        </div>
      </div>

      {backupOld && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
                Jangan lupa backup data
              </p>
              <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-200/80">
                {lastBackupValid && lastBackupDate
                  ? `Backup terakhir: ${formatDateTime(lastBackupDate)}.`
                  : 'Data hanya tersimpan di perangkat ini.'}{' '}
                Unduh backup JSON secara rutin.
              </p>
            </div>
          </div>
          <Link
            to="/settings#backup"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-amber-700"
          >
            Buka backup
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      <SummaryCards
        balance={balance}
        income={totals.income}
        expense={totals.expense}
        net={totals.net}
        monthLabel={month.label}
      />

      <BudgetOverview progress={budgetItems} summary={budget} />

      <CashflowChart
        data={trend.data}
        granularity={granularity}
        onGranularityChange={setGranularity}
        rangeLabel={`${formatDate(trend.start)} – ${formatDate(trend.end)}`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryDonut
          data={breakdown}
          totalExpense={totals.expense}
          periodLabel={`Bulan ${month.label}`}
        />
        <RecentTransactions transactions={recent} />
      </div>

      <AccountBalances accounts={balances} />

      <p className="pb-2 text-center text-[10px] text-slate-400 dark:text-slate-600">
        RF Uangku · data lokal · dibuat untuk pemakaian pribadi
      </p>
    </div>
  )
}
