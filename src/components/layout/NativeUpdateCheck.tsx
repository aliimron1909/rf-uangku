import { useEffect, useState } from 'react'
import { NATIVE_UPDATE_LINK, extractNativeUrl, nativePlugin } from '../../lib/native'
import { UpdateModal } from '../settings/UpdateModal'
import {
  checkNativeUpdate,
  dismissUpdate,
  isUpdateDismissed,
  shouldAutoCheck,
  type NativeUpdateInfo,
} from '../../lib/nativeUpdate'

interface AppPlugin {
  addListener(eventName: string, handler: (event: unknown) => void): unknown
  getLaunchUrl?(): Promise<unknown>
}

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

  // Mengetuk notifikasi "versi baru tersedia" langsung membuka dialog (mengabaikan jeda cek dan tombol "Nanti").
  useEffect(() => {
    const app = nativePlugin<AppPlugin>('App')
    if (!app) return
    const open = (value: unknown) => {
      if (!extractNativeUrl(value, NATIVE_UPDATE_LINK)) return
      void checkNativeUpdate()
        .then((result) => {
          if (result?.status === 'available') setUpdate(result.update)
        })
        .catch(() => undefined)
    }
    try {
      app.addListener('appUrlOpen', open)
      void app.getLaunchUrl?.().then(open).catch(() => undefined)
    } catch {
      // Tanpa listener, notifikasi tetap membuka aplikasi dan cek otomatis berjalan.
    }
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
