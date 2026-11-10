import { Suspense } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { Topbar } from './Topbar'
import { PageLoader } from '../ui/PageLoader'
import { OfflineBanner } from '../pwa/OfflineBanner'
import { useRecurringRunner } from '../../hooks/useRecurringRunner'

export function AppShell() {
  useRecurringRunner()

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <div className="lg:pl-64">
        <Topbar />
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 sm:px-6 lg:pb-10 lg:pt-6">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <Link
        to="/transactions?new=1"
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-95 lg:hidden"
        aria-label="Tambah transaksi"
      >
        <Plus className="h-7 w-7" />
      </Link>

      <BottomNav />
      <OfflineBanner />
    </div>
  )
}
