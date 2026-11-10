import { Link, NavLink } from 'react-router-dom'
import { MessageCircle, Plus } from 'lucide-react'
import { NAV_ITEMS } from './nav'
import { assetUrl, cn } from '../../lib/utils'
import { APP_TAGLINE } from '../../lib/constants'

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-900 lg:flex">
      <Link to="/dashboard" className="flex items-center gap-3 px-2">
        <img src={assetUrl('logo.svg')} alt="RF Uangku" className="h-11 w-11 rounded-2xl shadow-sm" />
        <div>
          <p className="text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            RF Uangku
          </p>
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{APP_TAGLINE}</p>
        </div>
      </Link>

      <Link
        to="/transactions?new=1"
        className="mt-6 flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
      >
        <Plus className="h-4 w-4" />
        Tambah Transaksi
      </Link>

      <Link
        to="/transactions?chat=1"
        className="mt-2 flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <MessageCircle className="h-4 w-4" />
        Chat AI
      </Link>

      <nav className="mt-4 flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                )
              }
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      <div className="rounded-2xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
        Data tersimpan di perangkat ini. Lakukan backup rutin dari menu Pengaturan.
      </div>
    </aside>
  )
}
