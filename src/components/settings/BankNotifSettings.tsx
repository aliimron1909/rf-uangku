import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellRing, Check, Trash2 } from 'lucide-react'
import { useSetting } from '../../hooks/useSetting'
import { BANK_NOTIF_ENABLED_KEY, type PendingNotifTx } from '../../lib/bankNotif'
import {
  bankNotifStatus,
  clearPendingNotifs,
  getPendingNotifs,
  openAppInfoSettings,
  openNotifAccessSettings,
  removePendingNotif,
  setBankNotifEnabled,
  syncBankNotifications,
} from '../../lib/nativeBankNotif'
import { formatRupiah } from '../../lib/format'
import { errorMessage } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../ui/Button'

/** Baca notifikasi bank/e-wallet di HP ini untuk menyarankan transaksi; semua diproses lokal. */
export function BankNotifSettings() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const enabled = useSetting<boolean>(BANK_NOTIF_ENABLED_KEY, false)
  const [access, setAccess] = useState(false)
  const [pending, setPending] = useState<PendingNotifTx[]>([])

  const refresh = useCallback(async () => {
    setAccess((await bankNotifStatus()).access)
    try {
      await syncBankNotifications()
    } catch {
      // Antrean kosong atau plugin belum siap.
    }
    setPending(await getPendingNotifs())
  }, [])

  useEffect(() => {
    void refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh, enabled])

  async function toggle(next: boolean) {
    try {
      await setBankNotifEnabled(next)
      if (next && !access) await openNotifAccessSettings()
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    }
  }

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Deteksi transaksi dari notifikasi bank dan e-wallet
        </span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => void toggle(event.target.checked)}
          className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
      </label>

      <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        <p>
          Aplikasi hanya membaca notifikasi dari aplikasi bank dan e-wallet yang dikenal (BCA, BRImo, Livin Mandiri, BNI,
          Jago, Jenius, blu, SeaBank, DANA, OVO, GoPay, ShopeePay, LinkAja, dan sejenisnya). Isinya diproses di HP ini
          saja dan tidak dikirim ke server. Setiap transaksi yang terdeteksi tetap kamu tinjau dulu sebelum disimpan.
        </p>
        <p>
          Status akses notifikasi: <b>{access ? 'diizinkan' : 'belum diizinkan'}</b>.
        </p>
        {!access && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void openNotifAccessSettings()}>
              <BellRing className="h-4 w-4" />
              Buka pengaturan akses notifikasi
            </Button>
            <Button variant="outline" onClick={() => void openAppInfoSettings()}>
              Info aplikasi
            </Button>
          </div>
        )}
        {!access && (
          <p>
            Bila RF Uangku tidak bisa dicentang di sana (Android 13+ untuk aplikasi di luar Play Store): buka Info
            aplikasi, tekan menu tiga titik di pojok kanan atas, pilih <b>Izinkan pengaturan terbatas</b>, lalu ulangi.
          </p>
        )}
      </div>

      {pending.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Menunggu ditinjau ({pending.length})
            </p>
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-rose-600"
              onClick={() => void clearPendingNotifs().then(refresh)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Hapus semua
            </button>
          </div>
          {pending.map((item) => (
            <div key={item.id} className="glass flex items-center justify-between gap-3 rounded-2xl p-3">
              <div className="min-w-0">
                <p
                  className={`text-sm font-bold ${item.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                >
                  {item.type === 'income' ? '+' : '−'}
                  {formatRupiah(item.amount)}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.note}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button onClick={() => navigate(`/transactions?notif=${encodeURIComponent(item.id)}`)}>
                  <Check className="h-4 w-4" />
                  Catat
                </Button>
                <Button variant="outline" onClick={() => void removePendingNotif(item.id).then(refresh)}>
                  Abaikan
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
