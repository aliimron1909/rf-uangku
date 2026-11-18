import { useEffect, useState } from 'react'
import { UpdateModal } from '../settings/UpdateModal'
import {
  checkNativeUpdate,
  dismissUpdate,
  isUpdateDismissed,
  shouldAutoCheck,
  type NativeUpdateInfo,
} from '../../lib/nativeUpdate'

/** Aplikasi native: menampilkan dialog bila ada versi baru di Releases GitHub (paling sering sekali per 6 jam). */
export function NativeUpdateCheck() {
  const [update, setUpdate] = useState<NativeUpdateInfo | null>(null)

  useEffect(() => {
    if (!shouldAutoCheck()) return
    void checkNativeUpdate()
      .then((result) => {
        if (result?.status === 'available' && !isUpdateDismissed(result.update.build)) {
          setUpdate(result.update)
        }
      })
      .catch(() => undefined)
  }, [])

  return (
    <UpdateModal
      update={update}
      onClose={() => {
        if (update) dismissUpdate(update.build)
        setUpdate(null)
      }}
    />
  )
}
