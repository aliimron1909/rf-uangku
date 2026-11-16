import type { Category, Transaction } from '../types'
import { shiftMonthKey } from './dates'
import { formatCompactRupiah } from './format'

export type InsightTone = 'up' | 'down' | 'info' | 'good'

export interface Insight {
  id: string
  tone: InsightTone
  text: string
}

export interface InsightFacts {
  month: string
  /** Hari ke-berapa dalam bulan yang dibandingkan (pembanding memakai rentang hari yang sama). */
  dayOfMonth: number
  income: number
  expense: number
  previousExpenseSamePeriod: number
  topCategories: Array<{ name: string; spent: number; previousSpent: number }>
}

export interface InsightResult {
  insights: Insight[]
  facts: InsightFacts
}

/** Perubahan minimum agar layak disebut (menghindari "naik 300%" dari Rp 1.000). */
const MIN_CHANGE_PERCENT = 20
const MIN_CHANGE_AMOUNT = 50_000
const NEW_CATEGORY_MIN = 100_000
const MAX_INSIGHTS = 5

function daysInMonth(key: string): number {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}

function sumByCategory(
  transactions: Transaction[],
  monthKeyValue: string,
  lastDay: number,
  type: Transaction['type'],
): Map<string, number> {
  const result = new Map<string, number>()
  for (const item of transactions) {
    if (item.type !== type) continue
    if (item.occurredAt.slice(0, 7) !== monthKeyValue) continue
    if (Number(item.occurredAt.slice(8, 10)) > lastDay) continue
    result.set(item.categoryId, (result.get(item.categoryId) ?? 0) + item.amount)
  }
  return result
}

function total(map: Map<string, number>): number {
  let sum = 0
  for (const value of map.values()) sum += value
  return sum
}

/**
 * Insight deterministik: membandingkan bulan berjalan dengan bulan sebelumnya pada
 * rentang hari yang sama (tanggal 1 s.d. hari ini), sehingga bulan yang belum selesai
 * tidak otomatis tampak "lebih hemat".
 */
export function monthlyInsights(
  transactions: Transaction[],
  categories: Category[],
  monthKey: string,
  today: string,
  monthLabel = monthKey,
): InsightResult {
  const previousKey = shiftMonthKey(monthKey, -1)
  const day = today.slice(0, 7) === monthKey ? Number(today.slice(8, 10)) : daysInMonth(monthKey)
  const previousDay = Math.min(day, daysInMonth(previousKey))
  const names = new Map(categories.map((category) => [category.id, category.name]))
  const nameOf = (id: string) => names.get(id) ?? 'Tanpa kategori'

  const current = sumByCategory(transactions, monthKey, 31, 'expense')
  const previous = sumByCategory(transactions, previousKey, previousDay, 'expense')
  const income = total(sumByCategory(transactions, monthKey, 31, 'income'))
  const expense = total(current)
  const previousExpense = total(previous)

  const facts: InsightFacts = {
    month: monthLabel,
    dayOfMonth: day,
    income,
    expense,
    previousExpenseSamePeriod: previousExpense,
    topCategories: Array.from(current.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, spent]) => ({
        name: nameOf(id),
        spent,
        previousSpent: previous.get(id) ?? 0,
      })),
  }

  const insights: Insight[] = []
  if (expense === 0 && previousExpense === 0) return { insights, facts }

  // Kategori yang naik / turun terbesar (berdasarkan selisih rupiah).
  const changes = Array.from(new Set([...current.keys(), ...previous.keys()]))
    .map((id) => {
      const now = current.get(id) ?? 0
      const before = previous.get(id) ?? 0
      return { id, now, before, delta: now - before }
    })
    .filter((item) => item.before > 0 && item.now > 0)
    .map((item) => ({ ...item, percent: (item.delta / item.before) * 100 }))
    .filter(
      (item) =>
        Math.abs(item.percent) >= MIN_CHANGE_PERCENT && Math.abs(item.delta) >= MIN_CHANGE_AMOUNT,
    )

  const biggestUp = changes.filter((item) => item.delta > 0).sort((a, b) => b.delta - a.delta)[0]
  if (biggestUp) {
    insights.push({
      id: `up-${biggestUp.id}`,
      tone: 'up',
      text: `Pengeluaran ${nameOf(biggestUp.id)} naik ${Math.round(biggestUp.percent)}% dibanding periode yang sama bulan lalu (${formatCompactRupiah(biggestUp.before)} → ${formatCompactRupiah(biggestUp.now)}).`,
    })
  }

  const biggestDown = changes.filter((item) => item.delta < 0).sort((a, b) => a.delta - b.delta)[0]
  if (biggestDown) {
    insights.push({
      id: `down-${biggestDown.id}`,
      tone: 'good',
      text: `Pengeluaran ${nameOf(biggestDown.id)} turun ${Math.round(Math.abs(biggestDown.percent))}% (${formatCompactRupiah(biggestDown.before)} → ${formatCompactRupiah(biggestDown.now)}).`,
    })
  }

  const fresh = Array.from(current.entries())
    .filter(([id, spent]) => !previous.has(id) && spent >= NEW_CATEGORY_MIN)
    .sort((a, b) => b[1] - a[1])[0]
  if (fresh) {
    insights.push({
      id: `new-${fresh[0]}`,
      tone: 'info',
      text: `Ada pengeluaran baru di ${nameOf(fresh[0])}: ${formatCompactRupiah(fresh[1])} bulan ini, belum ada di periode yang sama bulan lalu.`,
    })
  }

  if (previousExpense > 0 && expense > 0) {
    const percent = ((expense - previousExpense) / previousExpense) * 100
    if (Math.abs(percent) >= 10) {
      insights.push({
        id: 'total',
        tone: percent > 0 ? 'up' : 'good',
        text: `Total pengeluaran ${percent > 0 ? 'naik' : 'turun'} ${Math.round(Math.abs(percent))}% dibanding periode yang sama bulan lalu (${formatCompactRupiah(previousExpense)} → ${formatCompactRupiah(expense)}).`,
      })
    }
  }

  const top = facts.topCategories[0]
  if (top && expense > 0 && top.spent / expense >= 0.4 && facts.topCategories.length > 1) {
    insights.push({
      id: 'dominant',
      tone: 'info',
      text: `${Math.round((top.spent / expense) * 100)}% pengeluaranmu bulan ini ada di ${top.name}.`,
    })
  }

  if (income > 0 && expense > 0) {
    const rate = ((income - expense) / income) * 100
    insights.push({
      id: 'saving-rate',
      tone: rate >= 20 ? 'good' : rate < 0 ? 'up' : 'info',
      text:
        rate < 0
          ? `Pengeluaran bulan ini sudah melebihi pemasukan sebesar ${formatCompactRupiah(expense - income)}.`
          : `Kamu menyisihkan ${Math.round(rate)}% dari pemasukan bulan ini.`,
    })
  }

  return { insights: insights.slice(0, MAX_INSIGHTS), facts }
}

/** Hash ringan untuk mendeteksi apakah ringkasan AI tersimpan masih sesuai data. */
export function factsSignature(facts: InsightFacts): string {
  const text = JSON.stringify(facts)
  let hash = 5381
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0
  }
  return String(hash)
}
