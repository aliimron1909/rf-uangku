import type { TrendPoint } from '../types'
import { formatRupiah } from './format'
import { isNativeApp, nativePlugin } from './native'
import { renderTrendChart } from './widgetChart'

interface RfWidgetPlugin {
  update(data: Record<string, unknown>): Promise<unknown>
  setHidden(data: { hidden: boolean }): Promise<unknown>
  getHidden(): Promise<{ hidden?: boolean }>
}

export type WidgetPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly'
export const WIDGET_PERIODS: WidgetPeriod[] = ['daily', 'weekly', 'monthly', 'yearly']

export interface WidgetSummary {
  balance: number
  income: number
  expense: number
  /** Total batas budget bulan ini dan terpakai; limit 0 = belum ada budget. */
  budget: { limit: number; spent: number }
  accounts: { name: string; balance: number }[]
  trends: Partial<Record<WidgetPeriod, TrendPoint[]>>
}

/** Teks yang tampil di widget. Dipisah agar mudah diuji. */
export function widgetTexts(summary: WidgetSummary, now: Date) {
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const { limit, spent } = summary.budget
  return {
    balance: formatRupiah(summary.balance),
    income: formatRupiah(summary.income),
    expense: formatRupiah(summary.expense),
    budget: limit > 0 ? `Budget ${Math.round((spent / limit) * 100)}% terpakai` : '',
    updated: `Diperbarui ${hh}.${mm}`,
    accounts: JSON.stringify(
      summary.accounts.slice(0, 6).map((account) => ({ n: account.name, b: formatRupiah(account.balance) })),
    ),
  }
}

/** Ringkasan satu periode tren: total pemasukan dan pengeluaran. */
export function trendSummary(points: TrendPoint[]): string {
  const income = points.reduce((sum, point) => sum + point.income, 0)
  const expense = points.reduce((sum, point) => sum + point.expense, 0)
  return `+${formatRupiah(income)}  −${formatRupiah(expense)}`
}

function widget(): RfWidgetPlugin | null {
  return isNativeApp() ? nativePlugin<RfWidgetPlugin>('RfWidget') : null
}

/** Mengirim data ke widget Android; diabaikan di web. */
export async function pushWidgetData(summary: WidgetSummary): Promise<void> {
  const plugin = widget()
  if (!plugin) return
  const charts: Record<string, string> = {}
  const summaries: Record<string, string> = {}
  for (const period of WIDGET_PERIODS) {
    const points = summary.trends[period]
    if (!points) continue
    summaries[period] = trendSummary(points)
    const png = renderTrendChart(points)
    if (png) charts[period] = png
  }
  await plugin.update({ ...widgetTexts(summary, new Date()), charts, summaries })
}

export async function getWidgetHidden(): Promise<boolean> {
  try {
    return Boolean((await widget()?.getHidden())?.hidden)
  } catch {
    return false
  }
}

export async function setWidgetHidden(hidden: boolean): Promise<void> {
  await widget()?.setHidden({ hidden })
}
