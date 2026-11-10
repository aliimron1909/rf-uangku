import { useCallback, useEffect, useRef } from 'react'
import { processDueRecurring } from '../db/recurring'
import { errorMessage } from '../lib/utils'
import { useToast } from '../contexts/ToastContext'

export function useRecurringRunner(): void {
  const { toast } = useToast()
  const running = useRef(false)

  const run = useCallback(async () => {
    if (running.current) return
    running.current = true
    try {
      const result = await processDueRecurring()
      if (result.created > 0) {
        toast(
          `${result.created} transaksi berulang dibuat otomatis.`,
          'success',
        )
      }
      if (result.paused > 0) {
        toast(
          `${result.paused} aturan berulang dijeda karena rekening/kategori diarsipkan atau sudah selesai.`,
          'info',
        )
      }
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      running.current = false
    }
  }, [toast])

  useEffect(() => {
    void run()

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void run()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [run])
}
