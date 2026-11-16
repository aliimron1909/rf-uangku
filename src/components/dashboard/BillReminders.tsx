import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { billDueLabel, upcomingBills } from '../../lib/billReminders'
import { formatDate, todayISO } from '../../lib/dates'
import { formatRupiah } from '../../lib/format'

const MAX_ROWS = 4

/** Tagihan berulang yang jatuh tempo dalam 7 hari ke depan. */
export function BillReminders() {
  const rules = useLiveQuery(() => db.recurringTransactions.toArray(), [])
  const today = todayISO()
  const bills = useMemo(() => upcomingBills(rules ?? [], today), [rules, today])

  if (bills.length === 0) return null
  const total = bills.reduce((sum, bill) => sum + bill.rule.amount, 0)

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/40">
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Tagihan 7 hari ke depan · {formatRupiah(total)}
          </p>
          <ul className="mt-1.5 space-y-1">
            {bills.slice(0, MAX_ROWS).map((bill) => (
              <li key={bill.key} className="text-xs text-slate-700 dark:text-slate-300">
                <span className="font-semibold">{bill.rule.note?.trim() || 'Tagihan berulang'}</span>
                {' · '}
                {formatRupiah(bill.rule.amount)}
                {' · '}
                {formatDate(bill.date)} ({billDueLabel(bill.daysUntil)})
              </li>
            ))}
          </ul>
          {bills.length > MAX_ROWS && (
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              +{bills.length - MAX_ROWS} tagihan lainnya
            </p>
          )}
        </div>
        <Link
          to="/planning"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300"
        >
          Lihat
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
