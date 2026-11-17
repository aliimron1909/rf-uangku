import { useState } from 'react'
import { BellRing, BellOff, Send } from 'lucide-react'
import { useSetting } from '../../hooks/useSetting'
import {
  PUSH_ENABLED_KEY,
  disablePush,
  enablePush,
  getVapidPublicKey,
  pushSupported,
  sendTestPush,
} from '../../lib/push'
import { useSyncState } from '../../lib/sync/controller'
import { errorMessage } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../ui/Button'

/** Pengingat harian lewat server (Supabase) agar tetap muncul walau aplikasi tertutup. */
export function PushReminderSettings() {
  const { toast } = useToast()
  const sync = useSyncState()
  const active = useSetting<boolean>(PUSH_ENABLED_KEY, false)
  const [busy, setBusy] = useState(false)

  if (!sync.configured || !getVapidPublicKey()) return null

  async function run(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setBusy(false)
    }
  }

  const note = !pushSupported()
    ? 'Browser ini tidak mendukung notifikasi push. Di iPhone, pasang aplikasi ke Layar Utama dulu (iOS 16.4+).'
    : !sync.email
      ? 'Masuk dengan Google di Sinkronisasi cloud untuk memakai pengingat dari server.'
      : active
        ? 'Aktif di perangkat ini: pengingat dikirim server walau aplikasi tertutup, hanya bila belum ada catatan hari ini.'
        : 'Aktifkan agar pengingat tetap muncul walau aplikasi tertutup. Server hanya memeriksa ada-tidaknya catatan bertanggal hari ini.'

  return (
    <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{note}</p>
      {pushSupported() && sync.email && (
        <div className="flex flex-wrap gap-2">
          {active ? (
            <>
              <Button
                variant="outline"
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    const sent = await sendTestPush()
                    toast(sent > 0 ? 'Tes terkirim. Cek notifikasimu.' : 'Tidak ada perangkat terdaftar.', sent > 0 ? 'success' : 'error')
                  })
                }
              >
                <Send className="h-4 w-4" />
                Kirim tes
              </Button>
              <Button
                variant="outline"
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    await disablePush()
                    toast('Push dimatikan di perangkat ini.')
                  })
                }
              >
                <BellOff className="h-4 w-4" />
                Matikan
              </Button>
            </>
          ) : (
            <Button
              loading={busy}
              onClick={() =>
                void run(async () => {
                  await enablePush()
                  toast('Pengingat push aktif di perangkat ini.', 'success')
                })
              }
            >
              <BellRing className="h-4 w-4" />
              Aktifkan pengingat push
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
