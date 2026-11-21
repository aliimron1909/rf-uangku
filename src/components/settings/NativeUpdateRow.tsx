import { useEffect, useState } from 'react'
import { Download, History, RefreshCw } from 'lucide-react'
import { checkNativeUpdate, getUpdateNotify, installedAppInfo, setUpdateNotify, type NativeUpdateInfo, type UpdateCheck } from '../../lib/nativeUpdate'
import { ChangelogModal } from './ChangelogModal'
import { UpdateModal } from './UpdateModal'
import { requestNativeNotifPermission } from '../../lib/nativeReminder'
import { errorMessage } from '../../lib/utils'
import { Button } from '../ui/Button'

/** Tombol cek pembaruan aplikasi native (hanya tampil di aplikasi native). */
export function NativeUpdateRow() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<UpdateCheck | null>(null)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<NativeUpdateInfo | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [build, setBuild] = useState(0)
  const [notify, setNotify] = useState<boolean | null>(null)
  useEffect(() => {
    void installedAppInfo().then((info) => setBuild(info?.build ?? 0))
    void getUpdateNotify().then(setNotify)
  }, [])

  async function toggleNotify(next: boolean) {
    setNotify(next)
    try {
      await setUpdateNotify(next)
      if (next) await requestNativeNotifPermission()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function check() {
    setBusy(true)
    setError('')
    try {
      setResult(await checkNativeUpdate())
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {error ||
          (result?.status === 'latest'
            ? `Sudah versi terbaru (build ${result.build}).`
            : result?.status === 'available'
              ? `Tersedia v${result.update.version}, build ${result.update.build}.`
              : 'Cek apakah ada versi baru.')}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" loading={busy} onClick={() => void check()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Cek pembaruan
        </Button>
        <Button variant="outline" size="sm" onClick={() => setLogOpen(true)}>
          <History className="h-3.5 w-3.5" />
          Changelog
        </Button>
        {result?.status === 'available' && (
          <Button size="sm" onClick={() => setDialog(result.update)}>
            <Download className="h-3.5 w-3.5" />
            Perbarui
          </Button>
        )}
      </div>
      <UpdateModal update={dialog} onClose={() => setDialog(null)} />
      <ChangelogModal open={logOpen} installedBuild={build} onClose={() => setLogOpen(false)} />
    </div>
    {notify !== null && (
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="text-xs text-slate-600 dark:text-slate-300">Beri tahu saat ada versi baru</span>
        <input
          type="checkbox"
          checked={notify}
          onChange={(event) => void toggleNotify(event.target.checked)}
          className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
      </label>
    )}
    </div>
  )
}
