import { useState } from 'react'
import { Download } from 'lucide-react'
import { runInAppUpdate, type NativeUpdateInfo } from '../../lib/nativeUpdate'
import { errorMessage } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface UpdateModalProps {
  update: NativeUpdateInfo | null
  onClose: () => void
}

/** Dialog pembaruan: Perbarui = unduh di dalam aplikasi lalu buka pemasang Android. */
export function UpdateModal({ update, onClose }: UpdateModalProps) {
  const [percent, setPercent] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function start() {
    if (!update) return
    setBusy(true)
    setMessage('')
    try {
      const result = await runInAppUpdate(update, setPercent)
      setMessage(
        result === 'need-permission'
          ? 'Izinkan RF Uangku memasang aplikasi di layar yang terbuka, lalu kembali ke sini dan tekan Perbarui lagi.'
          : 'Unduhan selesai. Ikuti layar pemasangan Android, lalu buka kembali RF Uangku.',
      )
    } catch (caught) {
      setMessage(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={update !== null}
      onClose={() => (busy ? undefined : onClose())}
      title="Versi baru tersedia"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Nanti
          </Button>
          <Button onClick={() => void start()} loading={busy}>
            <Download className="h-4 w-4" />
            Perbarui
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
        <p>
          RF Uangku <b>v{update?.version}</b> (build {update?.build}) siap dipasang. Data kamu tetap aman.
        </p>
        {update && update.changelog.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Yang baru:</p>
            <ul className="mt-1 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-4 text-xs text-slate-600 dark:text-slate-300">
              {update.changelog.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        {busy && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mengunduh… {percent}%</p>
          </div>
        )}
        {message && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{message}</p>}
      </div>
    </Modal>
  )
}
