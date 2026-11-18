import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, ChevronRight, Search, X } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface SettingsSectionMeta {
  id: string
  title: string
  description: string
  /** Kata kunci tambahan agar pencarian menemukan bagian ini. */
  keywords: string
}

export interface SettingsGroup {
  id: string
  title: string
  icon: ReactNode
  /** Ringkasan status satu baris, tampil di daftar grup. */
  summary: string
  sections: SettingsSectionMeta[]
  content: ReactNode
}

interface SettingsShellProps {
  groups: SettingsGroup[]
  /** Id bagian/grup dari hash URL (tanpa '#'); membuka grup yang memuatnya. */
  targetId: string
  top?: ReactNode
}

const LAST_GROUP_KEY = 'rf-uangku:settings-group'

function readLastGroup(): string | null {
  try {
    return window.localStorage.getItem(LAST_GROUP_KEY)
  } catch {
    return null
  }
}

function writeLastGroup(id: string): void {
  try {
    window.localStorage.setItem(LAST_GROUP_KEY, id)
  } catch {
    // opsional
  }
}

/**
 * Tata letak pengaturan: di layar lebar menu grup di kiri dan isi di kanan;
 * di HP daftar grup lalu halaman detail dengan tombol kembali.
 * Semua grup tetap terpasang (hanya disembunyikan) agar isian yang belum disimpan tidak hilang.
 */
export function SettingsShell({ groups, targetId, top }: SettingsShellProps) {
  const [activeId, setActiveId] = useState<string>(() => {
    const saved = readLastGroup()
    return groups.some((group) => group.id === saved) ? (saved as string) : groups[0].id
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [scrollTo, setScrollTo] = useState('')

  function openGroup(groupId: string, sectionId = '') {
    setActiveId(groupId)
    setMobileOpen(true)
    setScrollTo(sectionId)
    setQuery('')
    writeLastGroup(groupId)
  }

  // Tautan seperti /settings#backup membuka grup yang memuat bagian itu.
  useEffect(() => {
    if (!targetId) return
    const group = groups.find(
      (item) => item.id === targetId || item.sections.some((section) => section.id === targetId),
    )
    if (!group) return
    setActiveId(group.id)
    setMobileOpen(true)
    setScrollTo(group.id === targetId ? '' : targetId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId])

  useEffect(() => {
    if (!scrollTo) return
    const timer = window.setTimeout(() => {
      document.getElementById(scrollTo)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setScrollTo('')
    }, 120)
    return () => window.clearTimeout(timer)
  }, [scrollTo, activeId])

  const trimmed = query.trim().toLowerCase()
  const results = useMemo(() => {
    if (!trimmed) return []
    return groups.flatMap((group) =>
      group.sections
        .filter((section) =>
          `${section.title} ${section.description} ${section.keywords}`
            .toLowerCase()
            .includes(trimmed),
        )
        .map((section) => ({ group, section })),
    )
  }, [groups, trimmed])

  const active = groups.find((group) => group.id === activeId) ?? groups[0]

  return (
    <div className="space-y-4">
      <div className={cn(mobileOpen && 'hidden md:block')}>{top}</div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari pengaturan (mis. PIN, backup, notifikasi)"
          aria-label="Cari pengaturan"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Hapus pencarian"
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {trimmed ? (
        <div className="rounded-3xl glass">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Tidak ada pengaturan yang cocok dengan “{query.trim()}”.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {results.map(({ group, section }) => (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => openGroup(group.id, section.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {section.title}
                      </span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        {group.title} · {section.description}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="md:grid md:grid-cols-[250px_minmax(0,1fr)] md:items-start md:gap-5">
          <nav
            aria-label="Grup pengaturan"
            className={cn(
              'rounded-3xl glass p-1.5 md:sticky md:top-20',
              mobileOpen && 'hidden md:block',
            )}
          >
            {groups.map((group) => {
              const isActive = group.id === active.id
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => openGroup(group.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition',
                    isActive
                      ? 'md:bg-emerald-50 md:dark:bg-emerald-950/50'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                      isActive
                        ? 'bg-emerald-600 text-white md:bg-emerald-600'
                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300',
                    )}
                  >
                    {group.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-900 dark:text-slate-100">
                      {group.title}
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {group.summary}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 md:hidden" />
                </button>
              )
            })}
          </nav>

          <div className={cn('min-w-0', !mobileOpen && 'hidden md:block')}>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="mb-3 inline-flex items-center gap-1.5 rounded-lg py-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400 md:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
              Pengaturan
            </button>
            {groups.map((group) => (
              <div
                key={group.id}
                className={cn('space-y-4', group.id !== active.id && 'hidden')}
              >
                {group.content}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
