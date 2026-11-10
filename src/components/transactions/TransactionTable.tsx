import { Pencil, RefreshCw, Trash2 } from 'lucide-react'
import type { TransactionWithRefs } from '../../types'
import { formatDate } from '../../lib/dates'
import { formatSignedRupiah } from '../../lib/format'
import { Badge } from '../ui/Badge'

interface TransactionTableProps {
  transactions: TransactionWithRefs[]
  onEdit: (transaction: TransactionWithRefs) => void
  onDelete: (transaction: TransactionWithRefs) => void
}

export function TransactionTable({ transactions, onEdit, onDelete }: TransactionTableProps) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:text-slate-500">
            <th className="px-4 py-3 font-semibold">Tanggal</th>
            <th className="px-4 py-3 font-semibold">Kategori</th>
            <th className="px-4 py-3 font-semibold">Rekening</th>
            <th className="px-4 py-3 font-semibold">Catatan</th>
            <th className="px-4 py-3 text-right font-semibold">Nominal</th>
            <th className="px-4 py-3 text-right font-semibold">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {transactions.map((transaction) => (
            <tr
              key={transaction.id}
              className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
            >
              <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                {formatDate(transaction.occurredAt, 'dd MMM yyyy')}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: transaction.categoryColor }}
                  />
                  <div>
                    <p className="max-w-[220px] truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {transaction.categoryName}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <Badge variant={transaction.type === 'income' ? 'income' : 'expense'}>
                        {transaction.type === 'income' ? 'Masuk' : 'Keluar'}
                      </Badge>
                      {transaction.recurringId && (
                        <Badge variant="neutral">
                          <RefreshCw className="h-3 w-3" />
                          Otomatis
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-300">
                {transaction.accountName}
              </td>
              <td className="px-4 py-3">
                <p className="max-w-[240px] truncate text-xs text-slate-500 dark:text-slate-400">
                  {transaction.note || '-'}
                </p>
              </td>
              <td
                className={`whitespace-nowrap px-4 py-3 text-right text-sm font-bold ${
                  transaction.type === 'income'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatSignedRupiah(transaction.amount, transaction.type)}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(transaction)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label="Edit transaksi"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(transaction)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                    aria-label="Hapus transaksi"
                    title="Hapus"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
