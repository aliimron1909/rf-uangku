import { useEffect, useState } from 'react'
import { Download, History, RefreshCw } from 'lucide-react'
import { checkNativeUpdate, installedAppInfo, type NativeUpdateInfo, type UpdateCheck } from '../../lib/nativeUpdate'
import { ChangelogModal } from './ChangelogModal'
import { UpdateModal } from './UpdateModal'
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
  useEffect(() => {
    void installedAppInfo().then((info) => setBuild(info?.build ?? 0))
  }, [])

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
  )
}
