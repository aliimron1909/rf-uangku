import { useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting } from '../db/db'
import { budgetProgress } from '../lib/budget'
import {
  BUDGET_ALERTS_ENABLED_KEY,
  BUDGET_ALERTS_SEEN_KEY,
  budgetAlertMessage,
  evaluateBudgetAlerts,
} from '../lib/budgetAlerts'
import { monthKey, monthRange } from '../lib/dates'
import { errorMessage } from '../lib/utils'
import { useToast } from '../contexts/ToastContext'

async function showSystemNotification(title: string, body: string, tag: string): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) {
      await registration.showNotification(title, { body, tag, icon: '/icons/icon-192.png' })
      return
    }
    new Notification(title, { body, tag })
  } catch {
    // Notifikasi sistem opsional; toast di dalam aplikasi tetap tampil.
  }
}

/**
 * Memantau pemakaian budget bulan berjalan dan memberi tahu saat mencapai 80% dan 100%.
 * Pemeriksaan berjalan saat data berubah atau aplikasi dibuka kembali; tanpa server,
 * notifikasi tidak bisa muncul ketika aplikasi benar-benar tertutup.
 */
export function useBudgetAlerts(): void {
  const { toast } = useToast()
  const chain = useRef<Promise<void>>(Promise.resolve())
  const month = monthKey()

  const snapshot = useLiveQuery(async () => {
    const range = monthRange()
    const [budgets, categories, transactions] = await Promise.all([
      db.budgets.toArray(),
      db.categories.toArray(),
      db.transactions.where('occurredAt').between(range.start, range.end, true, true).toArray(),
    ])
    return { budgets, categories, transactions, range }
  }, [month])

  useEffect(() => {
    if (!snapshot) return
    const run = async () => {
      try {
        const enabled = await getSetting<boolean>(BUDGET_ALERTS_ENABLED_KEY, true)
        const seen = await getSetting<string[] | undefined>(BUDGET_ALERTS_SEEN_KEY, undefined)
        const progress = budgetProgress(
          snapshot.budgets,
          snapshot.transactions,
          snapshot.categories,
          snapshot.range,
        )
        // Saat dimatikan, kondisi tetap dicatat agar tidak ada banjir peringatan ketika diaktifkan lagi.
        const result = evaluateBudgetAlerts(progress, month, enabled ? seen : undefined)
        await setSetting(BUDGET_ALERTS_SEEN_KEY, result.nextSeen)
        if (!enabled) return
        for (const event of result.events) {
          const message = budgetAlertMessage(event)
          toast(message.body, event.threshold === 100 ? 'error' : 'info')
          void showSystemNotification(message.title, message.body, event.key)
        }
      } catch (caught) {
        toast(errorMessage(caught), 'error')
      }
    }
    // Diproses berurutan agar dua perubahan data beruntun tidak saling menimpa catatan "sudah diberi tahu".
    chain.current = chain.current.then(run)
  }, [snapshot, month, toast])
}
