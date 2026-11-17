import { Link } from 'react-router-dom'
import { AlertCircle, Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { useSyncState } from '../../lib/sync/controller'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { formatDateTime } from '../../lib/dates'
import { cn } from '../../lib/utils'

type Tone = 'muted' | 'ok' | 'busy' | 'warn' | 'error'

const toneClass: Record<Tone, string> = {
  muted: 'text-slate-400 dark:text-slate-500',
  ok: 'text-emerald-600 dark:text-emerald-400',
  busy: 'text-sky-600 dark:text-sky-400',
  warn: 'text-amber-600 dark:text-amber-400',
  error: 'text-rose-600 dark:text-rose-400',
}

/** Ikon kecil status sinkronisasi cloud; ketuk untuk membuka pengaturannya. */
export function SyncIndicator() {
  const sync = useSyncState()
  const online = useOnlineStatus()

  if (!sync.configured) return null

  let tone: Tone = 'ok'
  let label = ''
  let icon = <Cloud className="h-5 w-5" />

  if (!sync.email) {
    tone = 'muted'
    label = 'Belum tersambung ke cloud'
    icon = <CloudOff className="h-5 w-5" />
  } else if (sync.status === 'error') {
    tone = 'error'
    label = `Sinkronisasi gagal: ${sync.error ?? 'terjadi kesalahan'}`
    icon = <AlertCircle className="h-5 w-5" />
  } else if (!online) {
    tone = 'warn'
    label = 'Offline. Perubahan dikirim saat kembali online'
    icon = <CloudOff className="h-5 w-5" />
  } else if (sync.status === 'syncing') {
    tone = 'busy'
    label = 'Menyinkronkan...'
    icon = <RefreshCw className="h-5 w-5 animate-spin" />
  } else {
    label = sync.lastSyncAt
      ? `Tersinkron ${formatDateTime(new Date(sync.lastSyncAt))}`
      : 'Tersambung, belum pernah sinkron'
  }

  return (
    <Link
      to="/settings#sinkronisasi"
      aria-label={label}
      title={label}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-slate-100 dark:hover:bg-slate-800',
        toneClass[tone],
      )}
    >
      {icon}
    </Link>
  )
}
