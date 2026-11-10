import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react'
import type { TransactionWithRefs } from '../../types'
import { formatDate } from '../../lib/dates'
import { formatSignedRupiah } from '../../lib/format'
import { cn } from '../../lib/utils'
import { EmptyState } from '../ui/EmptyState'

interface RecentTransactionsProps {
  transactions: TransactionWithRefs[]
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 dark:border-slate-800 sm:px-5">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Transaksi Terbaru
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            5 transaksi terakhir
          </p>
        </div>
        <Link
          to="/transactions"
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400"
        >
          Lihat semua
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          title="Belum ada transaksi"
          description="Mulai catat pemasukan atau pengeluaran pertama Anda."
          action={
            <Link
              to="/transactions?new=1"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              Tambah transaksi
            </Link>
          }
        />
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {transactions.map((transaction) => {
            const isIncome = transaction.type === 'income'
            return (
              <div key={transaction.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    isIncome
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300',
                  )}
                >
                  {isIncome ? (
                    <ArrowDownLeft className="h-5 w-5" />
                  ) : (
                    <ArrowUpRight className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {transaction.note || transaction.categoryName}
                  </p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {transaction.categoryName} · {transaction.accountName} ·{' '}
                    {formatDate(transaction.occurredAt, 'dd MMM')}
                  </p>
                </div>
                <p
                  className={cn(
                    'shrink-0 text-sm font-bold',
                    isIncome
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400',
                  )}
                >
                  {formatSignedRupiah(transaction.amount, transaction.type)}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
