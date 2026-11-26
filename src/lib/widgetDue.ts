import type { Category, RecurringTransaction } from '../types'
import { categoryLabel } from './categoryTree'
import { daysBetween } from './dateMath'
import { debtDirectionLabel, type DebtProgress } from './debts'
import { formatRupiah } from './format'

/** Satu baris pengingat di widget: nama, nominal, kapan, dan jenisnya (tagihan / hutang saya / piutang). */
export interface WidgetDue {
  n: string
  a: string
  w: string
  /** r = transaksi berulang, o = hutang saya, p = piutang. */
  k: 'r' | 'o' | 'p'
  /** Sudah lewat atau hari ini: widget menandainya merah. */
  hot: boolean
  days: number
}

export const WIDGET_DUE_DAYS = 7

export function dueWhen(days: number): string {
  if (days < 0) return `Terlambat ${-days} hari`
  if (days === 0) return 'Hari ini'
  if (days === 1) return 'Besok'
  return `${days} hari lagi`
}

/** Tagihan berulang (pengeluaran) dan hutang/piutang yang jatuh tempo dalam 7 hari atau sudah lewat, terdekat dulu. */
export function widgetDues(
  rules: RecurringTransaction[],
  progress: DebtProgress[],
  categories: Category[],
  today: string,
  limit = 6,
): WidgetDue[] {
  const items: WidgetDue[] = []
  for (const rule of rules) {
    if (!rule.active || rule.toAccountId || rule.type !== 'expense') continue
    if (rule.endDate && rule.nextRunAt > rule.endDate) continue
    const days = daysBetween(today, rule.nextRunAt)
    if (days < 0 || days > WIDGET_DUE_DAYS) continue
    const category = categories.find((item) => item.id === rule.categoryId)
    items.push({
      n: rule.note?.trim() || (category ? categoryLabel(category, categories) : 'Transaksi berulang'),
      a: formatRupiah(rule.amount),
      w: dueWhen(days),
      k: 'r',
      hot: days <= 0,
      days,
    })
  }
  for (const item of progress) {
    if (item.status !== 'overdue' && item.status !== 'dueSoon') continue
    const days = item.daysUntilDue ?? 0
    items.push({
      n: `${debtDirectionLabel(item.debt.direction)}: ${item.debt.person}`,
      a: formatRupiah(item.remaining),
      w: dueWhen(days),
      k: item.debt.direction === 'owe' ? 'o' : 'p',
      hot: days <= 0,
      days,
    })
  }
  return items.sort((a, b) => a.days - b.days || a.n.localeCompare(b.n)).slice(0, limit)
}
