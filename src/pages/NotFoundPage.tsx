import { Link } from 'react-router-dom'
import { Home, SearchX } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <SearchX className="h-8 w-8" />
      </div>
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
          Halaman tidak ditemukan
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Tautan yang Anda buka tidak tersedia di RF Uangku.
        </p>
      </div>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        <Home className="h-4 w-4" />
        Kembali ke dashboard
      </Link>
    </div>
  )
}
