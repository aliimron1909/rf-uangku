import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { AccountWithBalance } from '../../types'
import { formatRupiah } from '../../lib/format'
import { cn } from '../../lib/utils'
import { EntityIcon } from '../ui/EntityIcon'
import { defaultAccountIconKey } from '../../lib/icons'

interface AccountBalancesProps {
  /** Hanya rekening aktif, sudah berurutan seperti di Pengaturan. */
  accounts: AccountWithBalance[]
}

const VISIBLE = 4

const kindLabel = {
  cash: 'Tunai',
  bank: 'Bank',
  ewallet: 'E-wallet',
}

export function AccountBalances({ accounts }: AccountBalancesProps) {
  const [showAll, setShowAll] = useState(false)
  const rows = showAll ? accounts : accounts.slice(0, VISIBLE)

  return (
    <div className="rounded-3xl glass">
      <div className="border-b border-slate-100 px-4 py-3.5 dark:border-slate-800 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Saldo Rekening</h2>
          <Link
            to="/settings#master"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            Atur urutan
          </Link>
        </div>
      </div>
      <div className="grid gap-2 p-4 sm:p-5">
        {rows.map((account) => (
          <div
            key={account.id}
            className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60"
          >
            <EntityIcon
              icon={account.icon}
              fallback={defaultAccountIconKey(account.kind)}
              color={account.color}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {account.name}
                </p>
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
        {accounts.length > VISIBLE && (
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="rounded-xl py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
          >
            {showAll ? 'Tampilkan lebih sedikit' : `Lihat semua (${accounts.length})`}
          </button>
        )}
        {accounts.length === 0 && (
          <p className="py-2 text-center text-xs text-slate-500 dark:text-slate-400">
            Belum ada rekening aktif.
          </p>
        )}
      </div>
    </div>
  )
}
