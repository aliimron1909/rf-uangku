import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

interface CollapsibleProps {
  title: string
  description?: string
  defaultOpen?: boolean
  danger?: boolean
  children: ReactNode
}

/** Lipatan untuk opsi yang jarang dipakai. Isi tetap terpasang agar isian tidak hilang saat ditutup. */
export function Collapsible({
  title,
  description,
  defaultOpen = false,
  danger = false,
  children,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      className={cn(
        'rounded-xl border',
        danger
          ? 'border-rose-200 dark:border-rose-900/60'
          : 'border-slate-200 dark:border-slate-700',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block text-sm font-semibold',
              danger ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-200',
            )}
          >
            {title}
          </span>
          {description && (
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">
              {description}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-slate-400 transition', open && 'rotate-180')}
        />
      </button>
      <div className={cn('space-y-3 border-t border-inherit px-3 py-3', !open && 'hidden')}>
        {children}
      </div>
    </div>
  )
}
