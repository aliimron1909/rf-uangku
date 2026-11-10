import { Pencil, RefreshCw, Trash2 } from 'lucide-react'
import type { TransactionWithRefs } from '../../types'
import { formatDate } from '../../lib/dates'
import { formatSignedRupiah } from '../../lib/format'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/Badge'

interface TransactionCardProps {
  transaction: TransactionWithRefs
  onEdit: (transaction: TransactionWithRefs) => void
  onDelete: (transaction: TransactionWithRefs) => void
}

export function TransactionCard({ transaction, onEdit, onDelete }: TransactionCardProps) {
  const isIncome = transaction.type === 'income'

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 h-9 w-9 shrink-0 rounded-xl"
          style={{ backgroundColor: transaction.categoryColor }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                {transaction.note || transaction.categoryName}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                {transaction.categoryName} · {transaction.accountName}
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
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                {formatDate(transaction.occurredAt, 'dd MMM yyyy')}
              </span>
              <Badge variant={isIncome ? 'income' : 'expense'}>
                {isIncome ? 'Masuk' : 'Keluar'}
              </Badge>
              {transaction.recurringId && (
                <Badge variant="neutral">
                  <RefreshCw className="h-3 w-3" />
                  Otomatis
                </Badge>
              )}
            </div>
            <div className="flex gap-0.5">
              <button
                type="button"
                onClick={() => onEdit(transaction)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Edit transaksi"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(transaction)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                aria-label="Hapus transaksi"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
