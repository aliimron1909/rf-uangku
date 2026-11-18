import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboardData } from '../../hooks/useDashboard'
import { NATIVE_NEW_LINK, extractNativeUrl, nativePlugin } from '../../lib/native'
import { pushWidgetData } from '../../lib/nativeWidget'

interface AppPlugin {
  addListener(eventName: string, handler: (event: unknown) => void): unknown
  getLaunchUrl?(): Promise<unknown>
}

/** Aplikasi native: menyegarkan widget saldo dan membuka form transaksi saat tombol "+" widget diketuk. */
export function NativeWidgetSync() {
  const { balance, totals } = useDashboardData()
  const navigate = useNavigate()

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void pushWidgetData({ balance, income: totals.income, expense: totals.expense }).catch(() => undefined)
    }, 800)
    return () => window.clearTimeout(timer)
  }, [balance, totals.income, totals.expense])

  useEffect(() => {
    const app = nativePlugin<AppPlugin>('App')
    if (!app) return
    const open = (value: unknown) => {
      if (extractNativeUrl(value, NATIVE_NEW_LINK)) navigate('/transactions?new=1')
    }
    try {
      app.addListener('appUrlOpen', open)
      void app.getLaunchUrl?.().then(open).catch(() => undefined)
    } catch {
      // Tanpa listener, widget tetap membuka aplikasi.
    }
  }, [navigate])

  return null
}
