import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, BellRing, CalendarClock, HandCoins, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { db } from '../../db/db'
import { useDebts } from '../../hooks/useDebts'
import { shiftDateISO } from '../../lib/dateMath'
import { BILL_PAID_WINDOW_DAYS, billDueLabel, upcomingBills } from '../../lib/billReminders'
import { debtProgress, debtReminders } from '../../lib/debts'
import { formatDate, todayISO } from '../../lib/dates'
import { formatRupiah } from '../../lib/format'
import { cn } from '../../lib/utils'

interface AttentionCardProps {
  backupOld: boolean
  lastBackupLabel: string
}

interface Row {
  key: string
  icon: ReactNode
  text: ReactNode
  to: string
  tone: 'danger' | 'warn' | 'info'
}

const toneClass = {
  danger: 'text-rose-600 dark:text-rose-400',
  warn: 'text-amber-600 dark:text-amber-400',
  info: 'text-sky-600 dark:text-sky-400',
}

/** Satu kartu untuk semua yang perlu perhatian: backup, hutang/piutang, tagihan. Hilang bila kosong. */
export function AttentionCard({ backupOld, lastBackupLabel }: AttentionCardProps) {
  const { debts, payments } = useDebts()
  const rules = useLiveQuery(() => db.recurringTransactions.toArray(), [])
  const today = todayISO()
  const recent = useLiveQuery(
    () =>
      db.transactions
        .where('occurredAt')
        .between(shiftDateISO(today, -BILL_PAID_WINDOW_DAYS), today, true, true)
        .toArray(),
    [today],
  )

  const debtRows = useMemo(
    () => debtReminders(debtProgress(debts, payments, today)),
    [debts, payments, today],
  )
  const bills = useMemo(() => upcomingBills(rules ?? [], today, undefined, recent ?? []), [rules, recent, today])

  const rows: Row[] = []
  if (backupOld) {
    rows.push({
      key: 'backup',
      icon: <ShieldAlert className="h-4 w-4" />,
      text: (
        <>
          <b>Backup data</b> · {lastBackupLabel}
        </>
      ),
      to: '/settings#backup',
      tone: 'warn',
    })
  }
  for (const item of debtRows.slice(0, 2)) {
    rows.push({
      key: `debt-${item.debt.id}`,
      icon: <HandCoins className="h-4 w-4" />,
      text: (
        <>
          <b>{item.debt.person}</b> · {item.debt.direction === 'owe' ? 'bayar' : 'tagih'}{' '}
          {formatRupiah(item.remaining)} ·{' '}
          {item.status === 'overdue'
            ? `terlambat ${Math.abs(item.daysUntilDue ?? 0)} hari`
            : item.daysUntilDue === 0
              ? 'jatuh tempo hari ini'
              : `${item.daysUntilDue} hari lagi`}
        </>
      ),
      to: '/planning?tab=debts',
      tone: item.status === 'overdue' ? 'danger' : 'warn',
    })
  }
  if (debtRows.length > 2) {
    rows.push({
      key: 'debt-more',
      icon: <BellRing className="h-4 w-4" />,
      text: <>+{debtRows.length - 2} hutang/piutang lainnya</>,
      to: '/planning?tab=debts',
      tone: 'warn',
    })
  }
  for (const bill of bills.slice(0, 2)) {
    rows.push({
      key: bill.key,
      icon: <CalendarClock className="h-4 w-4" />,
      text: (
        <>
          <b>{bill.rule.note?.trim() || 'Tagihan berulang'}</b> · {formatRupiah(bill.rule.amount)} ·{' '}
          {formatDate(bill.date)} ({billDueLabel(bill.daysUntil)})
        </>
      ),
      to: '/planning',
      tone: 'info',
    })
  }
  if (bills.length > 2) {
    rows.push({
      key: 'bill-more',
      icon: <CalendarClock className="h-4 w-4" />,
      text: <>+{bills.length - 2} tagihan lainnya</>,
      to: '/planning',
      tone: 'info',
    })
  }

  if (rows.length === 0) return null

  return (
    <section className="rounded-3xl glass">
      <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Perlu perhatian
      </p>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((row) => (
          <li key={row.key}>
            <Link
              to={row.to}
              className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
            >
              <span className={cn('shrink-0', toneClass[row.tone])}>{row.icon}</span>
              <span className="min-w-0 flex-1 truncate">{row.text}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
