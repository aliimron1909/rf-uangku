import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import { assetUrl } from '../../lib/utils'
import { STORAGE_KEYS } from '../../lib/constants'

interface InstallPromptProps {
  /** Keep listening for the install event while the app is locked, but hide the banner. */
  enabled?: boolean
}

export function InstallPrompt({ enabled = true }: InstallPromptProps) {
  const { canInstall, installed, promptInstall } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.installDismissed) === '1'
    } catch {
      return false
    }
  })
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!enabled || !canInstall || installed || dismissed) return
    const timer = window.setTimeout(() => setVisible(true), 2500)
    return () => window.clearTimeout(timer)
  }, [enabled, canInstall, installed, dismissed])

  if (!enabled || !visible || !canInstall || installed || dismissed) return null

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEYS.installDismissed, '1')
    } catch {
      // ignore blocked storage
    }
    setDismissed(true)
  }

  async function install() {
    const accepted = await promptInstall()
    if (!accepted) dismiss()
  }

  return (
    <div className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900 lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0">
      <div className="flex items-start gap-3">
        <img src={assetUrl('logo.svg')} alt="" className="h-11 w-11 rounded-xl shadow-sm" />
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Pasang RF Uangku di HP
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Akses lebih cepat, layar penuh, dan tetap bisa dipakai offline.
          </p>
          <button
            type="button"
            onClick={() => void install()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
          >
            <Download className="h-3.5 w-3.5" />
            Pasang aplikasi
          </button>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
