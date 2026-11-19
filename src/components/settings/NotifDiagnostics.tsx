import { useCallback, useEffect, useState } from 'react'
import { BellRing, CheckCircle2, RefreshCw, XCircle } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import {
  type NativeDiagStatus,
  needsAutostart,
  nativeDiagStatus,
  openAutostartSettings,
  openBatterySettings,
  openExactAlarmSettings,
  openNotificationSettings,
} from '../../lib/nativeDiag'
import { pendingReminders, scheduleTestNotification, syncNativeReminders } from '../../lib/nativeReminder'
import { Button } from '../ui/Button'

function Row({ ok, label, action }: { ok: boolean; label: string; action?: { text: string; run: () => void } }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
        {ok ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
        )}
        {label}
      </span>
      {!ok && action && (
        <button type="button" onClick={action.run} className="shrink-0 font-semibold text-emerald-700 dark:text-emerald-400">
          {action.text}
        </button>
      )}
    </div>
  )
}

/** Diagnosis pengingat native: izin, alarm tepat waktu, hemat baterai, jadwal, dan tombol tes. */
export function NotifDiagnostics() {
  const { toast } = useToast()
  const [status, setStatus] = useState<NativeDiagStatus | null>(null)
  const [pending, setPending] = useState<{ count: number; next: Date | null }>({ count: 0, next: null })

  const refresh = useCallback(async () => {
    setStatus(await nativeDiagStatus())
    setPending(await pendingReminders())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function test() {
    const ok = await scheduleTestNotification(60)
    toast(
      ok
        ? 'Tes dijadwalkan 1 menit lagi. Tutup aplikasi (geser dari recent apps) lalu tunggu.'
        : 'Gagal menjadwalkan. Izinkan notifikasi dulu.',
      ok ? 'success' : 'error',
    )
  }

  async function resync() {
    await syncNativeReminders()
    await refresh()
    toast('Jadwal pengingat dibuat ulang.', 'success')
  }

  if (!status) return null
  return (
    <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Diagnosis pengingat</p>
      <Row
        ok={status.notificationsEnabled}
        label="Notifikasi diizinkan"
        action={{ text: 'Buka', run: () => void openNotificationSettings() }}
      />
      <Row
        ok={status.exactAlarm}
        label="Alarm tepat waktu diizinkan"
        action={{ text: 'Izinkan', run: () => void openExactAlarmSettings() }}
      />
      <Row
        ok={status.batteryUnrestricted}
        label="Tanpa pembatasan baterai"
        action={{ text: 'Atur', run: () => void openBatterySettings() }}
      />
      {needsAutostart(status.manufacturer) && (
        <div className="flex items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-200">
          <span>HP {status.manufacturer}: aktifkan "Mulai otomatis" untuk RF Uangku.</span>
          <button
            type="button"
            onClick={() => void openAutostartSettings()}
            className="shrink-0 font-semibold text-emerald-700 dark:text-emerald-400"
          >
            Buka
          </button>
        </div>
      )}
      <p className="text-xs text-slate-600 dark:text-slate-300">
        Terjadwal: {pending.count} pengingat
        {pending.next ? `, berikutnya ${pending.next.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}.
        {pending.count === 0 && ' Tidak tampil bila hari ini sudah ada catatan atau jam sudah lewat.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void test()}>
          <BellRing className="h-4 w-4" />
          Tes notifikasi
        </Button>
        <Button variant="outline" onClick={() => void resync()}>
          <RefreshCw className="h-4 w-4" />
          Jadwalkan ulang
        </Button>
      </div>
    </div>
  )
}
