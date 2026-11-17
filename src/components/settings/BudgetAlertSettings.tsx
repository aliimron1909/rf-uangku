import { useState } from 'react'
import { BellRing } from 'lucide-react'
import { setSetting } from '../../db/db'
import { useSetting } from '../../hooks/useSetting'
import { BUDGET_ALERTS_ENABLED_KEY } from '../../lib/budgetAlerts'
import { BILL_REMINDERS_ENABLED_KEY } from '../../lib/billReminders'
import {
  DAILY_REMINDER_ENABLED_KEY,
  DAILY_REMINDER_TIME_KEY,
  DEFAULT_REMINDER_TIME,
  isValidReminderTime,
} from '../../lib/dailyReminder'
import { errorMessage } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../ui/Button'

export function BudgetAlertSettings() {
  const { toast } = useToast()
  const enabled = useSetting<boolean>(BUDGET_ALERTS_ENABLED_KEY, true)
  const billsEnabled = useSetting<boolean>(BILL_REMINDERS_ENABLED_KEY, true)
  const dailyEnabled = useSetting<boolean>(DAILY_REMINDER_ENABLED_KEY, false)
  const dailyTime = useSetting<string>(DAILY_REMINDER_TIME_KEY, DEFAULT_REMINDER_TIME)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )

  async function toggle(next: boolean, key = BUDGET_ALERTS_ENABLED_KEY) {
    try {
      await setSetting(key, next)
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    }
  }

  async function requestPermission() {
    if (typeof Notification === 'undefined') return
    try {
      setPermission(await Notification.requestPermission())
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    }
  }

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Beri tahu saat budget mencapai 80% dan 100%
        </span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => void toggle(event.target.checked)}
          className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
      </label>

      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Ingatkan tagihan berulang 7 hari sebelum jatuh tempo
        </span>
        <input
          type="checkbox"
          checked={billsEnabled}
          onChange={(event) => void toggle(event.target.checked, BILL_REMINDERS_ENABLED_KEY)}
          className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
      </label>

      <div className="space-y-2">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Ingatkan jika belum mencatat hari ini
          </span>
          <input
            type="checkbox"
            checked={dailyEnabled}
            onChange={(event) => void toggle(event.target.checked, DAILY_REMINDER_ENABLED_KEY)}
            className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
        </label>
        {dailyEnabled && (
          <label className="flex items-center justify-between gap-3 pl-0.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">Ingatkan setelah jam</span>
            <input
              type="time"
              value={isValidReminderTime(dailyTime) ? dailyTime : DEFAULT_REMINDER_TIME}
              onChange={(event) => {
                if (isValidReminderTime(event.target.value)) {
                  void setSetting(DAILY_REMINDER_TIME_KEY, event.target.value).catch((caught) =>
                    toast(errorMessage(caught), 'error'),
                  )
                }
              }}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        )}
      </div>

      <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        {permission === 'unsupported' && 'Browser ini tidak mendukung notifikasi sistem. Peringatan tetap muncul di dalam aplikasi.'}
        {permission === 'granted' && 'Notifikasi sistem aktif.'}
        {permission === 'denied' && 'Notifikasi sistem diblokir di pengaturan browser. Peringatan tetap muncul di dalam aplikasi.'}
        {permission === 'default' && 'Aktifkan izin agar peringatan juga tampil sebagai notifikasi sistem.'}
        {' '}Karena data disimpan lokal tanpa server, peringatan hanya muncul saat aplikasi sedang dibuka atau kembali dibuka.
      </div>

      {permission === 'default' && (
        <Button variant="outline" onClick={() => void requestPermission()}>
          <BellRing className="h-4 w-4" />
          Izinkan notifikasi sistem
        </Button>
      )}
    </div>
  )
}
