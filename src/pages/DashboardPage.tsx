import { Link } from 'react-router-dom'
import { MessageCircle, Plus } from 'lucide-react'
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
import { AttentionCard } from '../components/dashboard/AttentionCard'
import { OverviewTabs } from '../components/dashboard/OverviewTabs'
import { NetWorthCard } from '../components/dashboard/NetWorthCard'
import { InsightsCard } from '../components/dashboard/InsightsCard'
import { useAllCategories } from '../hooks/useCategories'

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
    activeAccounts,
    archivedCount,
    transfers,
    debts,
    debtPayments,
  } = useDashboardData()
  const { name: profileName } = useProfile()
  const allCategories = useAllCategories()
  const lastBackupAt = useSetting<string>('lastBackupAt', '')
  const lastBackupDate = lastBackupAt ? new Date(lastBackupAt) : null
  const lastBackupValid = Boolean(lastBackupDate && !Number.isNaN(lastBackupDate.getTime()))
  const backupAge =
    lastBackupValid && lastBackupDate ? Date.now() - lastBackupDate.getTime() : Infinity

  const backupOld = transactions.length > 0 && backupAge > 7 * 24 * 60 * 60 * 1000
  const lastBackupLabel =
    lastBackupValid && lastBackupDate
      ? `terakhir ${formatDateTime(lastBackupDate)}`
      : 'belum pernah dibackup'

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            {month.label}
          </p>
          <h2 className="mt-0.5 truncate text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
            Halo, {profileName} 👋
          </h2>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            to="/transactions?chat=1"
            aria-label="Chat AI"
            title="Chat AI"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Chat AI</span>
          </Link>
          <Link
            to="/transactions?new=1"
            className="hidden h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 sm:inline-flex"
          >
            <Plus className="h-4 w-4" />
            Tambah Transaksi
          </Link>
        </div>
      </div>

      <AttentionCard backupOld={backupOld} lastBackupLabel={lastBackupLabel} />

      <SummaryCards
        balance={balance}
        income={totals.income}
        expense={totals.expense}
        net={totals.net}
        monthLabel={month.label}
        archivedCount={archivedCount}
      />

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2 lg:items-start">
        <BudgetOverview progress={budgetItems} summary={budget} />
        <InsightsCard
          transactions={transactions}
          categories={allCategories}
          monthLabel={month.label}
        />
      </div>

      <OverviewTabs
        tabs={[
          {
            id: 'cashflow',
            label: 'Arus kas',
            content: (
              <CashflowChart
                data={trend.data}
                granularity={granularity}
                onGranularityChange={setGranularity}
                rangeLabel={`${formatDate(trend.start)} – ${formatDate(trend.end)}`}
              />
            ),
          },
          {
            id: 'category',
            label: 'Kategori',
            content: (
              <CategoryDonut
                data={breakdown}
                totalExpense={totals.expense}
                periodLabel={`Bulan ${month.label}`}
              />
            ),
          },
          {
            id: 'networth',
            label: 'Kekayaan',
            content: (
              <NetWorthCard
                accounts={activeAccounts}
                transactions={transactions}
                debts={debts}
                payments={debtPayments}
                transfers={transfers}
              />
            ),
          },
        ]}
      />

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2 lg:items-start">
        <AccountBalances accounts={balances} />
        <RecentTransactions transactions={recent} />
      </div>
    </div>
  )
}
