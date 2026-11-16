import type { BudgetProgress } from '../types'

export type BudgetThreshold = 80 | 100

export interface BudgetAlertEvent {
  key: string
  categoryId: string
  categoryName: string
  threshold: BudgetThreshold
  percentage: number
}

export const BUDGET_ALERTS_ENABLED_KEY = 'budgetAlertsEnabled'
export const BUDGET_ALERTS_SEEN_KEY = 'budgetAlertsSeen'

export function budgetAlertKey(
  monthKey: string,
  categoryId: string,
  threshold: BudgetThreshold,
): string {
  return `${monthKey}|${categoryId}|${threshold}`
}

export interface BudgetAlertEvaluation {
  /** Peringatan baru yang perlu ditampilkan (maksimal satu per kategori: yang tertinggi). */
  events: BudgetAlertEvent[]
  /** Daftar kunci yang harus disimpan: ambang yang saat ini sedang terlampaui. */
  nextSeen: string[]
}

/**
 * Membandingkan pemakaian budget bulan ini dengan ambang yang sudah pernah
 * diberitahukan. `seen === undefined` berarti pengecekan pertama: kondisi saat ini
 * dicatat tanpa memunculkan peringatan agar data lama tidak membanjiri pengguna.
 * Kunci yang pemakaiannya turun di bawah ambang dibuang, sehingga peringatan
 * muncul lagi jika ambang itu terlampaui kembali.
 */
export function evaluateBudgetAlerts(
  progress: BudgetProgress[],
  monthKey: string,
  seen: string[] | undefined,
): BudgetAlertEvaluation {
  const current: BudgetAlertEvent[] = []
  for (const row of progress) {
    const thresholds: BudgetThreshold[] = []
    if (row.percentage >= 80) thresholds.push(80)
    if (row.percentage >= 100) thresholds.push(100)
    for (const threshold of thresholds) {
      current.push({
        key: budgetAlertKey(monthKey, row.categoryId, threshold),
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        threshold,
        percentage: row.percentage,
      })
    }
  }

  const nextSeen = current.map((item) => item.key)
  if (seen === undefined) return { events: [], nextSeen }

  const seenSet = new Set(seen)
  const fresh = current.filter((item) => !seenSet.has(item.key))
  const highest = new Map<string, BudgetAlertEvent>()
  for (const item of fresh) {
    const existing = highest.get(item.categoryId)
    if (!existing || item.threshold > existing.threshold) highest.set(item.categoryId, item)
  }
  return { events: Array.from(highest.values()), nextSeen }
}

export function budgetAlertMessage(event: BudgetAlertEvent): { title: string; body: string } {
  const percent = Math.round(event.percentage)
  if (event.threshold === 100) {
    return {
      title: 'Budget terlampaui',
      body: `Budget ${event.categoryName} sudah terpakai ${percent}%.`,
    }
  }
  return {
    title: 'Budget hampir habis',
    body: `Budget ${event.categoryName} sudah terpakai ${percent}%.`,
  }
}
