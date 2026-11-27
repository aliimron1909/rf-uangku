import type { RecurringTransaction, Transaction } from '../types'
import { daysBetween } from './dateMath'
import { formatRupiah } from './format'

export const BILL_REMINDERS_ENABLED_KEY = 'billRemindersEnabled'
export const BILL_REMINDERS_SEEN_KEY = 'billRemindersSeen'
export const BILL_REMINDER_DAYS = 7

export interface UpcomingBill {
  rule: RecurringTransaction
  /** Tanggal jatuh tempo berikutnya (YYYY-MM-DD). */
  date: string
  daysUntil: number
  key: string
}

/** Pembayaran yang dicatat sampai sekian hari sebelum jatuh tempo dianggap melunasi tagihan itu. */
export const BILL_PAID_WINDOW_DAYS = 15

/**
 * Tagihan bulanan/tahunan dianggap sudah dibayar bila ada pengeluaran manual (bukan hasil aturan ini)
 * dengan akun, kategori, dan nominal yang sama, tercatat dalam 15 hari sampai tanggal jatuh tempo.
 * Aturan harian/mingguan tidak dicocokkan karena nominalnya sering sama tanpa berarti lunas.
 */
export function isBillPaid(rule: RecurringTransaction, date: string, transactions: Transaction[]): boolean {
  if (rule.type !== 'expense' || rule.toAccountId) return false
  if (rule.frequency !== 'monthly' && rule.frequency !== 'yearly') return false
  return transactions.some((item) => {
    if (item.type !== 'expense' || item.recurringId === rule.id) return false
    if (item.accountId !== rule.accountId || item.categoryId !== rule.categoryId) return false
    if (item.amount !== rule.amount) return false
    const ago = daysBetween(item.occurredAt, date)
    return ago >= 0 && ago <= BILL_PAID_WINDOW_DAYS
  })
}

export function billReminderKey(ruleId: string, date: string): string {
  return `bill|${ruleId}|${date}`
}

/**
 * Aturan transaksi berulang bertipe pengeluaran yang akan jatuh tempo dalam
 * `days` hari ke depan (hari ini termasuk). Yang sudah lewat otomatis dicatat
 * oleh pemrosesan transaksi berulang, jadi tidak muncul di sini.
 */
export function upcomingBills(
  rules: RecurringTransaction[],
  today: string,
  days = BILL_REMINDER_DAYS,
  transactions: Transaction[] = [],
): UpcomingBill[] {
  return rules
    .filter((rule) => rule.active && rule.type === 'expense' && !rule.toAccountId)
    .filter((rule) => !rule.endDate || rule.nextRunAt <= rule.endDate)
    .map((rule): UpcomingBill => {
      const daysUntil = daysBetween(today, rule.nextRunAt)
      return {
        rule,
        date: rule.nextRunAt,
        daysUntil,
        key: billReminderKey(rule.id, rule.nextRunAt),
      }
    })
    .filter((bill) => bill.daysUntil >= 0 && bill.daysUntil <= days)
    .filter((bill) => !isBillPaid(bill.rule, bill.date, transactions))
    .sort((a, b) => a.date.localeCompare(b.date) || a.rule.id.localeCompare(b.rule.id))
}

export interface BillReminderEvaluation {
  events: UpcomingBill[]
  /** Kunci yang sudah diberi tahu dan masih relevan (yang lama dibuang). */
  nextSeen: string[]
}

export function evaluateBillReminders(
  bills: UpcomingBill[],
  seen: string[] | undefined,
  notify: boolean,
): BillReminderEvaluation {
  const seenSet = new Set(seen ?? [])
  const events = notify ? bills.filter((bill) => !seenSet.has(bill.key)) : []
  // Saat notifikasi mati, semua tagihan dianggap sudah dilihat agar tidak banjir saat diaktifkan.
  const nextSeen = bills
    .filter((bill) => seenSet.has(bill.key) || events.includes(bill) || !notify)
    .map((bill) => bill.key)
  return { events, nextSeen }
}

export function billDueLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'hari ini'
  if (daysUntil === 1) return 'besok'
  return `${daysUntil} hari lagi`
}

export function billReminderMessage(bill: UpcomingBill): { title: string; body: string } {
  const name = bill.rule.note?.trim() || 'Tagihan berulang'
  return {
    title: 'Tagihan segera jatuh tempo',
    body: `${name} ${formatRupiah(bill.rule.amount)} jatuh tempo ${billDueLabel(bill.daysUntil)}.`,
  }
}
