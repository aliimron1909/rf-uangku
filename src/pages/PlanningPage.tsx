import { useSearchParams } from 'react-router-dom'
import { Repeat, Target } from 'lucide-react'
import { BudgetSection } from '../components/planning/BudgetSection'
import { RecurringSection } from '../components/planning/RecurringSection'
import { cn } from '../lib/utils'

type PlanningTab = 'budget' | 'recurring'

export function PlanningPage() {
  const [params, setParams] = useSearchParams()
  const tab: PlanningTab = params.get('tab') === 'recurring' ? 'recurring' : 'budget'

  function selectTab(nextTab: PlanningTab) {
    const next = new URLSearchParams(params)
    next.set('tab', nextTab)
    setParams(next, { replace: true })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          Perencanaan
        </p>
        <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
          Rencana
        </h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Atur batas pengeluaran dan transaksi rutin yang berjalan otomatis.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => selectTab('budget')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
            tab === 'budget'
              ? 'bg-emerald-50 text-emerald-700 shadow-sm dark:bg-emerald-950/60 dark:text-emerald-300'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
          )}
        >
          <Target className="h-4 w-4" />
          Budget
        </button>
        <button
          type="button"
          onClick={() => selectTab('recurring')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
            tab === 'recurring'
              ? 'bg-emerald-50 text-emerald-700 shadow-sm dark:bg-emerald-950/60 dark:text-emerald-300'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
          )}
        >
          <Repeat className="h-4 w-4" />
          Berulang
        </button>
      </div>

      {tab === 'budget' ? <BudgetSection /> : <RecurringSection />}
    </div>
  )
}
