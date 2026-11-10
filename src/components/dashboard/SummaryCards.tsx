import { ArrowDownLeft, ArrowUpRight, Scale, Wallet } from 'lucide-react'
import { formatRupiah } from '../../lib/format'
import { cn } from '../../lib/utils'

interface SummaryCardsProps {
  balance: number
  income: number
  expense: number
  net: number
  monthLabel: string
}

export function SummaryCards({ balance, income, expense, net, monthLabel }: SummaryCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-4 text-white shadow-sm sm:p-5">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
        <div className="absolute -bottom-8 -left-4 h-28 w-28 rounded-full bg-black/10" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">
              Total Saldo
            </p>
            <Wallet className="h-5 w-5 text-emerald-200" />
          </div>
          <p className="mt-3 text-2xl font-extrabold tracking-tight sm:text-[26px]">
            {formatRupiah(balance)}
          </p>
          <p className="mt-1 text-[11px] font-medium text-emerald-100/80">
            Semua rekening · saldo saat ini
          </p>
        </div>
      </div>

      <SummaryCard
        label="Pemasukan"
        value={income}
        hint={monthLabel}
        icon={<ArrowDownLeft className="h-5 w-5" />}
        iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300"
        valueClass="text-emerald-600 dark:text-emerald-400"
      />
      <SummaryCard
        label="Pengeluaran"
        value={expense}
        hint={monthLabel}
        icon={<ArrowUpRight className="h-5 w-5" />}
        iconClass="bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300"
        valueClass="text-rose-600 dark:text-rose-400"
      />
      <SummaryCard
        label="Selisih"
        value={net}
        hint={monthLabel}
        icon={<Scale className="h-5 w-5" />}
        iconClass="bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300"
        valueClass={net >= 0 ? 'text-sky-600 dark:text-sky-400' : 'text-rose-600 dark:text-rose-400'}
        prefix={net >= 0 ? '+' : ''}
      />
    </div>
  )
}

interface SummaryCardProps {
  label: string
  value: number
  hint: string
  icon: React.ReactNode
  iconClass: string
  valueClass: string
  prefix?: string
}

function SummaryCard({
  label,
  value,
  hint,
  icon,
  iconClass,
  valueClass,
  prefix = '',
}: SummaryCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', iconClass)}>
          {icon}
        </span>
      </div>
      <p className={cn('mt-3 text-2xl font-extrabold tracking-tight', valueClass)}>
        {prefix}
        {formatRupiah(value)}
      </p>
      <p className="mt-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">{hint}</p>
    </div>
  )
}
