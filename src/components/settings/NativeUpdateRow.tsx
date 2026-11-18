import { useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { checkNativeUpdate, downloadUpdate, type UpdateCheck } from '../../lib/nativeUpdate'
import { errorMessage } from '../../lib/utils'
import { Button } from '../ui/Button'

/** Tombol cek pembaruan aplikasi native (hanya tampil di aplikasi native). */
export function NativeUpdateRow() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<UpdateCheck | null>(null)
  const [error, setError] = useState('')

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
              : 'Pembaruan diunduh dari Releases GitHub.')}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" loading={busy} onClick={() => void check()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Cek pembaruan
        </Button>
        {result?.status === 'available' && (
          <Button size="sm" onClick={() => void downloadUpdate(result.update)}>
            <Download className="h-3.5 w-3.5" />
            Unduh
          </Button>
        )}
      </div>
    </div>
  )
}
