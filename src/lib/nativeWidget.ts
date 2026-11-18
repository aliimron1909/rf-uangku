import { formatRupiah } from './format'
import { isNativeApp, nativePlugin } from './native'

interface RfWidgetPlugin {
  update(data: { balance: string; month: string; updated: string }): Promise<unknown>
}

export interface WidgetSummary {
  balance: number
  income: number
  expense: number
}

/** Teks yang tampil di widget layar utama. Dipisah agar mudah diuji. */
export function widgetTexts(summary: WidgetSummary, now: Date): { balance: string; month: string; updated: string } {
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return {
    balance: formatRupiah(summary.balance),
    month: `Bulan ini  −${formatRupiah(summary.expense)}  +${formatRupiah(summary.income)}`,
    updated: `Diperbarui ${hh}.${mm}`,
  }
}

/** Mengirim ringkasan ke widget Android; diabaikan di web. */
export async function pushWidgetData(summary: WidgetSummary): Promise<void> {
  if (!isNativeApp()) return
  const widget = nativePlugin<RfWidgetPlugin>('RfWidget')
  if (!widget) return
  await widget.update(widgetTexts(summary, new Date()))
}
