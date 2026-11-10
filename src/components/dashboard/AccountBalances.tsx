import type { AccountWithBalance } from '../../types'
import { formatRupiah } from '../../lib/format'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/Badge'

interface AccountBalancesProps {
  accounts: AccountWithBalance[]
}

const kindLabel = {
  cash: 'Tunai',
  bank: 'Bank',
  ewallet: 'E-wallet',
}

export function AccountBalances({ accounts }: AccountBalancesProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-4 py-3.5 dark:border-slate-800 sm:px-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Saldo Rekening</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Saldo awal + seluruh transaksi
        </p>
      </div>
      <div className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60"
          >
            <span
              className="h-8 w-8 shrink-0 rounded-lg"
              style={{ backgroundColor: account.color }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {account.name}
                </p>
                {account.archived && <Badge variant="warning">Arsip</Badge>}
              </div>
              <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                {kindLabel[account.kind]}
              </p>
            </div>
            <p
              className={cn(
                'shrink-0 text-xs font-bold',
                account.balance < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-700 dark:text-slate-200',
              )}
            >
              {formatRupiah(account.balance)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
