import { useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting } from '../db/db'
import {
  BILL_REMINDERS_ENABLED_KEY,
  BILL_REMINDERS_SEEN_KEY,
  billReminderMessage,
  evaluateBillReminders,
  upcomingBills,
} from '../lib/billReminders'
import { todayISO } from '../lib/dates'
import { shiftDateISO } from '../lib/dateMath'
import { BILL_PAID_WINDOW_DAYS } from '../lib/billReminders'
import { showSystemNotification } from '../lib/notify'
import { errorMessage } from '../lib/utils'
import { useToast } from '../contexts/ToastContext'

/** Memberi tahu tagihan berulang yang jatuh tempo dalam 7 hari, sekali per tagihan per tanggal. */
export function useBillReminders(): void {
  const { toast } = useToast()
  const chain = useRef<Promise<void>>(Promise.resolve())
  const today = todayISO()

  const rules = useLiveQuery(() => db.recurringTransactions.toArray(), [])
  const recent = useLiveQuery(
    () =>
      db.transactions
        .where('occurredAt')
        .between(shiftDateISO(today, -BILL_PAID_WINDOW_DAYS), today, true, true)
        .toArray(),
    [today],
  )

  useEffect(() => {
    if (!rules || !recent) return
    const run = async () => {
      try {
        const enabled = await getSetting<boolean>(BILL_REMINDERS_ENABLED_KEY, true)
        const seen = await getSetting<string[] | undefined>(BILL_REMINDERS_SEEN_KEY, undefined)
        const result = evaluateBillReminders(upcomingBills(rules, today, undefined, recent), seen, enabled)
        await setSetting(BILL_REMINDERS_SEEN_KEY, result.nextSeen)
        for (const bill of result.events) {
          const message = billReminderMessage(bill)
          toast(message.body, 'info')
          void showSystemNotification(message.title, message.body, bill.key)
        }
      } catch (caught) {
        toast(errorMessage(caught), 'error')
      }
    }
    chain.current = chain.current.then(run)
  }, [rules, recent, today, toast])
}
