import type { TransactionWithRefs } from '../../types'
import { formatDate } from '../../lib/dates'
import { formatSignedRupiah } from '../../lib/format'
import { Badge } from '../ui/Badge'

interface ReportTableProps {
  transactions: TransactionWithRefs[]
}

export function ReportTable({ transactions }: ReportTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:text-slate-500">
              <th className="px-4 py-3 font-semibold">Tanggal</th>
              <th className="px-4 py-3 font-semibold">Jenis</th>
              <th className="px-4 py-3 font-semibold">Kategori</th>
              <th className="px-4 py-3 font-semibold">Rekening</th>
              <th className="px-4 py-3 font-semibold">Catatan</th>
              <th className="px-4 py-3 text-right font-semibold">Nominal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {formatDate(transaction.occurredAt, 'dd MMM yyyy')}
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant={transaction.type === 'income' ? 'income' : 'expense'}>
                    {transaction.type === 'income' ? 'Masuk' : 'Keluar'}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: transaction.categoryColor }}
                    />
                    <span className="max-w-[200px] truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                      {transaction.categoryName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                  {transaction.accountName}
                </td>
                <td className="px-4 py-2.5">
                  <p className="max-w-[220px] truncate text-xs text-slate-500 dark:text-slate-400">
                    {transaction.note || '-'}
                  </p>
                </td>
                <td
                  className={`whitespace-nowrap px-4 py-2.5 text-right text-sm font-bold ${
                    transaction.type === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatSignedRupiah(transaction.amount, transaction.type)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
        {transactions.map((transaction) => (
          <div key={transaction.id} className="flex items-start gap-3 px-4 py-3">
            <span
              className="mt-1 h-8 w-8 shrink-0 rounded-lg"
              style={{ backgroundColor: transaction.categoryColor }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {transaction.note || transaction.categoryName}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {transaction.categoryName} · {transaction.accountName}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-xs font-bold ${
                    transaction.type === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatSignedRupiah(transaction.amount, transaction.type)}
                </p>
              </div>
              <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                {formatDate(transaction.occurredAt, 'dd MMM yyyy')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
