import { Link, useLocation } from 'react-router-dom'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { Lock, Moon, Sun } from 'lucide-react'
import { pageTitle } from './nav'
import { useTheme } from '../../contexts/ThemeContext'
import { useLock } from '../../contexts/LockContext'
import { useProfile } from '../../hooks/useProfile'
import { profileInitials } from '../../lib/profile'
import { assetUrl } from '../../lib/utils'

export function Topbar() {
  const location = useLocation()
  const { resolvedTheme, toggleTheme } = useTheme()
  const { lock, hasPinConfigured } = useLock()
  const { name: profileName, photo: profilePhoto } = useProfile()
  const title = pageTitle(location.pathname)
  const today = format(new Date(), 'EEEE, d MMMM yyyy', { locale: localeId })

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/85">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={assetUrl('logo.svg')}
            alt=""
            className="h-9 w-9 shrink-0 rounded-xl shadow-sm lg:hidden"
          />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {title}
            </h1>
            <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {today}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label={resolvedTheme === 'dark' ? 'Gunakan tema terang' : 'Gunakan tema gelap'}
            title={resolvedTheme === 'dark' ? 'Tema terang' : 'Tema gelap'}
          >
            {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          {hasPinConfigured && (
            <button
              type="button"
              onClick={lock}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label="Kunci aplikasi"
              title="Kunci aplikasi"
            >
              <Lock className="h-5 w-5" />
            </button>
          )}
          <Link
            to="/settings#profil"
            className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-600 text-xs font-extrabold text-white shadow-sm ring-2 ring-white transition hover:ring-emerald-200 dark:ring-slate-950 dark:hover:ring-emerald-900"
            aria-label={`Buka profil ${profileName}`}
            title={profileName}
          >
            {profilePhoto ? (
              <img src={profilePhoto} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{profileInitials(profileName)}</span>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}
