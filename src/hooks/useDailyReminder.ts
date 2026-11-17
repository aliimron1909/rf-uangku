import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, getSetting, setSetting } from '../db/db'
import {
  DAILY_REMINDER_ENABLED_KEY,
  DAILY_REMINDER_LAST_KEY,
  DAILY_REMINDER_TIME_KEY,
  DEFAULT_REMINDER_TIME,
  shouldRemindToday,
} from '../lib/dailyReminder'
import { todayISO } from '../lib/dates'
import { showSystemNotification } from '../lib/notify'
import { errorMessage } from '../lib/utils'
import { useToast } from '../contexts/ToastContext'

const CHECK_INTERVAL_MS = 60_000

/**
 * Pengingat harian: bila setelah jam pilihan belum ada catatan hari ini, tampilkan sekali per hari.
 * Tanpa server, pengingat hanya berjalan saat aplikasi sedang dibuka atau kembali dibuka.
 */
export function useDailyReminder(): void {
  const { toast } = useToast()
  const navigate = useNavigate()
  const running = useRef(false)

  useEffect(() => {
    async function check() {
      if (running.current) return
      running.current = true
      try {
        const enabled = await getSetting<boolean>(DAILY_REMINDER_ENABLED_KEY, false)
        if (!enabled) return
        const time = await getSetting<string>(DAILY_REMINDER_TIME_KEY, DEFAULT_REMINDER_TIME)
        const lastReminded = await getSetting<string | undefined>(DAILY_REMINDER_LAST_KEY, undefined)
        const today = todayISO()
        const now = new Date()
        const entries =
          (await db.transactions.where('occurredAt').equals(today).count()) +
          (await db.transfers.where('occurredAt').equals(today).count())
        const remind = shouldRemindToday({
          enabled,
          time,
          nowMinutes: now.getHours() * 60 + now.getMinutes(),
          today,
          lastReminded,
          hasEntryToday: entries > 0,
        })
        if (!remind) return
        await setSetting(DAILY_REMINDER_LAST_KEY, today)
        const body = 'Belum ada catatan hari ini. Yuk catat pemasukan dan pengeluaranmu.'
        toast(body, 'info', {
          action: { label: 'Catat', onClick: () => navigate('/transactions?new=1') },
        })
        void showSystemNotification('Pengingat catat uang', body, `daily-${today}`)
      } catch (caught) {
        toast(errorMessage(caught), 'error')
      } finally {
        running.current = false
      }
    }

    void check()
    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [toast, navigate])
}
