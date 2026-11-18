import { Suspense, useEffect } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { Topbar } from './Topbar'
import { PageLoader } from '../ui/PageLoader'
import { OfflineBanner } from '../pwa/OfflineBanner'
import { useRecurringRunner } from '../../hooks/useRecurringRunner'
import { useBudgetAlerts } from '../../hooks/useBudgetAlerts'
import { useBillReminders } from '../../hooks/useBillReminders'
import { useDailyReminder } from '../../hooks/useDailyReminder'
import { NativeWidgetSync } from './NativeWidgetSync'
import { isNativeApp } from '../../lib/native'
import { startAutoSync } from '../../lib/sync/controller'
import { purgeExpiredTrash } from '../../db/transactions'

export function AppShell() {
  useRecurringRunner()
  useBudgetAlerts()
  useBillReminders()
  useDailyReminder()
  useEffect(() => {
    void startAutoSync()
    void purgeExpiredTrash().catch(() => undefined)
  }, [])

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <div className="lg:pl-64">
        <Topbar />
        <main className="mx-auto w-full max-w-6xl px-4 pb-36 pt-4 sm:px-6 lg:pb-10 lg:pt-6">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <Link
        to="/transactions?new=1"
        className="fixed bottom-[calc(6.25rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-1 ring-white/50 transition hover:from-emerald-500 hover:to-emerald-700 active:scale-95 lg:hidden"
        aria-label="Tambah transaksi"
      >
        <Plus className="h-7 w-7" />
      </Link>

      {isNativeApp() && <NativeWidgetSync />}
      <BottomNav />
      <OfflineBanner />
    </div>
  )
}
