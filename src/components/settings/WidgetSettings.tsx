import { useEffect, useState } from 'react'
import { EyeOff } from 'lucide-react'
import { getWidgetHidden, setWidgetHidden } from '../../lib/nativeWidget'
import { errorMessage } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'

/** Pengaturan widget layar utama (hanya di aplikasi native). */
export function WidgetSettings() {
  const { toast } = useToast()
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const refresh = () => void getWidgetHidden().then(setHidden)
    refresh()
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])

  async function toggle(next: boolean) {
    setHidden(next)
    try {
      await setWidgetHidden(next)
    } catch (caught) {
      setHidden(!next)
      toast(errorMessage(caught), 'error')
    }
  }

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <EyeOff className="h-4 w-4" />
          Sembunyikan saldo di widget
        </span>
        <input
          type="checkbox"
          checked={hidden}
          onChange={(event) => void toggle(event.target.checked)}
          className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
      </label>
      <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        Tekan lama layar utama, pilih Widget, lalu cari RF Uangku. Ada tiga widget: <b>Saldo</b> (total, bulan ini,
        budget, tombol tambah), <b>Saldo per rekening</b>, dan <b>Tren</b> (grafik pemasukan vs pengeluaran; ketuk
        labelnya untuk ganti harian, mingguan, bulanan, tahunan). Tombol Sembunyikan di widget Saldo juga bisa dipakai
        langsung tanpa membuka aplikasi.
      </div>
    </div>
  )
}
