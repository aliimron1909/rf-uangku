import { useSearchParams } from 'react-router-dom'
import { Calculator, HandCoins, PiggyBank, Repeat, Target, type LucideIcon } from 'lucide-react'
import { BudgetSection } from '../components/planning/BudgetSection'
import { DebtSection } from '../components/planning/DebtSection'
import { GoalSection } from '../components/planning/GoalSection'
import { KprSection } from '../components/planning/KprSection'
import { RecurringSection } from '../components/planning/RecurringSection'
import { cn } from '../lib/utils'

type PlanningTab = 'budget' | 'recurring' | 'goals' | 'debts' | 'kpr'

const TABS: { id: PlanningTab; label: string; icon: LucideIcon }[] = [
  { id: 'budget', label: 'Budget', icon: Target },
  { id: 'recurring', label: 'Berulang', icon: Repeat },
  { id: 'goals', label: 'Tabungan', icon: PiggyBank },
  { id: 'debts', label: 'Hutang', icon: HandCoins },
  { id: 'kpr', label: 'KPR', icon: Calculator },
]

function parseTab(value: string | null): PlanningTab {
  return TABS.some((tab) => tab.id === value) ? (value as PlanningTab) : 'budget'
}

export function PlanningPage() {
  const [params, setParams] = useSearchParams()
  const tab = parseTab(params.get('tab'))

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
          Atur budget, transaksi rutin, target tabungan, hutang dan piutang, serta simulasi KPR.
        </p>
      </div>

      <div className="grid grid-cols-5 gap-1 rounded-3xl glass p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => selectTab(id)}
            aria-pressed={tab === id}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold transition sm:flex-row sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm',
              tab === id
                ? 'bg-emerald-50 text-emerald-700 shadow-sm dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'budget' && <BudgetSection />}
      {tab === 'recurring' && <RecurringSection />}
      {tab === 'goals' && <GoalSection />}
      {tab === 'debts' && <DebtSection />}
      {tab === 'kpr' && <KprSection />}
    </div>
  )
}
