import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div className="fixed bottom-24 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 shadow-lg dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200 lg:bottom-6">
      <WifiOff className="h-4 w-4" />
      Offline — data tetap tersimpan di perangkat
    </div>
  )
}
