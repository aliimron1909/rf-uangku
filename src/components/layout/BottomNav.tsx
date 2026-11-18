import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './nav'
import { cn } from '../../lib/utils'

/** Bilah navigasi mengambang berbentuk kapsul dengan efek kaca. */
export function BottomNav() {
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
      <div className="glass-strong pointer-events-auto mx-auto grid max-w-lg grid-cols-5 gap-1 rounded-full p-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 rounded-full px-1 py-2 text-[10px] font-semibold transition',
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-700 shadow-[inset_0_1px_0_rgb(255_255_255/0.5)] dark:bg-emerald-400/20 dark:text-emerald-300'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                )
              }
            >
              <Icon className="h-5 w-5" />
              {item.shortLabel}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
