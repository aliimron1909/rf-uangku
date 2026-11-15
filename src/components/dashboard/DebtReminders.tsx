import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BellRing } from 'lucide-react'
import { useDebts } from '../../hooks/useDebts'
import { debtProgress, debtReminders } from '../../lib/debts'
import { formatDate, todayISO } from '../../lib/dates'
import { formatRupiah } from '../../lib/format'
import { cn } from '../../lib/utils'

const MAX_ROWS = 3

/** Pengingat hutang/piutang yang sudah lewat atau segera jatuh tempo. */
export function DebtReminders() {
  const { debts, payments } = useDebts()
  const today = todayISO()
  const reminders = useMemo(
    () => debtReminders(debtProgress(debts, payments, today)),
    [debts, payments, today],
  )

  if (reminders.length === 0) return null
  const hasOverdue = reminders.some((item) => item.status === 'overdue')

  return (
    <div
      className={cn(
        'rounded-2xl border p-4',
        hasOverdue
          ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
          : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
      )}
    >
      <div className="flex items-start gap-3">
        <BellRing
          className={cn(
            'mt-0.5 h-5 w-5 shrink-0',
            hasOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400',
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Hutang &amp; piutang perlu perhatian
          </p>
          <ul className="mt-1.5 space-y-1">
            {reminders.slice(0, MAX_ROWS).map((item) => (
              <li key={item.debt.id} className="text-xs text-slate-700 dark:text-slate-300">
                <span className="font-semibold">{item.debt.person}</span>
                {' · '}
                {item.debt.direction === 'owe' ? 'bayar' : 'tagih'} {formatRupiah(item.remaining)}
                {' · '}
                {item.status === 'overdue'
                  ? `terlambat ${Math.abs(item.daysUntilDue ?? 0)} hari`
                  : item.daysUntilDue === 0
                    ? 'jatuh tempo hari ini'
                    : `${formatDate(item.debt.dueDate ?? today)} (${item.daysUntilDue} hari lagi)`}
              </li>
            ))}
          </ul>
          {reminders.length > MAX_ROWS && (
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              dan {reminders.length - MAX_ROWS} lainnya
            </p>
          )}
        </div>
        <Link
          to="/planning?tab=debts"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-700 transition hover:text-slate-900 dark:text-slate-200"
        >
          Buka
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
