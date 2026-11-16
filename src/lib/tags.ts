import type { Transaction } from '../types'

export const TAG_MAX_LENGTH = 24
export const TAGS_MAX_PER_TRANSACTION = 8

/** Huruf kecil, tanpa "#", spasi menjadi "-", dibatasi panjangnya. */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, TAG_MAX_LENGTH)
}

export function normalizeTags(raw: readonly string[] | undefined): string[] {
  if (!raw) return []
  const result: string[] = []
  for (const item of raw) {
    const tag = normalizeTag(item)
    if (tag && !result.includes(tag)) result.push(tag)
    if (result.length >= TAGS_MAX_PER_TRANSACTION) break
  }
  return result
}

/** Memecah teks isian ("liburan, bali") menjadi daftar tag. Pemisah: koma, titik koma, atau baris baru. */
export function parseTagInput(text: string): string[] {
  return normalizeTags(text.split(/[,;\n]+/))
}

export interface TagCount {
  tag: string
  count: number
}

export function collectTags(transactions: readonly Transaction[]): TagCount[] {
  const counts = new Map<string, number>()
  for (const transaction of transactions) {
    for (const tag of transaction.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return Array.from(counts, ([tag, count]) => ({ tag, count })).sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag),
  )
}

export function isValidTagList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= TAGS_MAX_PER_TRANSACTION &&
    value.every((item) => typeof item === 'string' && item.length > 0 && item.length <= TAG_MAX_LENGTH)
  )
}

export interface TagSummary {
  tag: string
  income: number
  expense: number
  count: number
}

/**
 * Ringkasan per tag. Transaksi dengan beberapa tag dihitung di setiap tagnya, jadi jumlah
 * antar tag boleh lebih besar dari total laporan. Pecahan split dihitung per bagiannya.
 */
export function tagSummary(transactions: readonly Transaction[]): TagSummary[] {
  const map = new Map<string, TagSummary>()
  for (const transaction of transactions) {
    for (const tag of transaction.tags ?? []) {
      const row = map.get(tag) ?? { tag, income: 0, expense: 0, count: 0 }
      if (transaction.type === 'income') row.income += transaction.amount
      else row.expense += transaction.amount
      row.count += 1
      map.set(tag, row)
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => b.expense - a.expense || b.income - a.income || a.tag.localeCompare(b.tag),
  )
}

export function tagsLabel(tags: readonly string[] | undefined): string {
  return (tags ?? []).map((tag) => `#${tag}`).join(' ')
}
