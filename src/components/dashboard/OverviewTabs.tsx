import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface OverviewTab {
  id: string
  label: string
  content: ReactNode
}

const STORAGE_KEY = 'rf-uangku:dashboard-tab'

function readTab(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** Tab untuk grafik dashboard agar tidak ditumpuk; tab terakhir diingat di perangkat. */
export function OverviewTabs({ tabs }: { tabs: OverviewTab[] }) {
  const [activeId, setActiveId] = useState(() => {
    const saved = readTab()
    return tabs.some((tab) => tab.id === saved) ? (saved as string) : tabs[0].id
  })
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0]

  function select(id: string) {
    setActiveId(id)
    try {
      window.localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // opsional
    }
  }

  return (
    <div className="space-y-3">
      <div role="tablist" className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === active.id}
            onClick={() => select(tab.id)}
            className={cn(
              'flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition',
              tab.id === active.id
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {active.content}
    </div>
  )
}
