import { useEffect } from 'react'
import { useToast } from '../../contexts/ToastContext'
import { checkNativeUpdate, downloadUpdate, shouldAutoCheck } from '../../lib/nativeUpdate'

/** Aplikasi native: memberi tahu bila ada versi baru di Releases GitHub. */
export function NativeUpdateCheck() {
  const { toast } = useToast()

  useEffect(() => {
    if (!shouldAutoCheck()) return
    void checkNativeUpdate()
      .then((result) => {
        if (result?.status !== 'available') return
        const { update } = result
        toast(`Versi baru tersedia (v${update.version}, build ${update.build}).`, 'info', {
          action: { label: 'Unduh', onClick: () => void downloadUpdate(update) },
        })
      })
      .catch(() => undefined)
  }, [toast])

  return null
}
