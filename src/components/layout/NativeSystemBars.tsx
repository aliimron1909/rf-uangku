import { useEffect } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { isNativeApp } from '../../lib/native'
import { applySystemBarsTheme, refreshInsets } from '../../lib/nativeSystemBars'

/** Aplikasi native: menyelaraskan status bar/navigation bar dengan tema dan memberi selimut di belakang ikon status bar. */
export function NativeSystemBars() {
  const { resolvedTheme } = useTheme()
  const native = isNativeApp()

  useEffect(() => {
    if (!native) return
    void applySystemBarsTheme(resolvedTheme === 'dark')
  }, [native, resolvedTheme])

  useEffect(() => {
    if (!native) return
    const update = () => void refreshInsets()
    update()
    // Ukuran bar baru diketahui setelah jendela selesai ditata.
    const timers = [250, 1000, 2500].map((delay) => window.setTimeout(update, delay))
    window.addEventListener('resize', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      window.removeEventListener('resize', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [native])

  return native ? <div className="status-scrim" aria-hidden="true" /> : null
}
