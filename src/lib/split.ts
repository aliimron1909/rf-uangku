import type { Transaction } from '../types'

export interface SplitPart {
  categoryId: string
  amount: number
}

export const SPLIT_MIN_PARTS = 2
export const SPLIT_MAX_PARTS = 12

/** Pesan kesalahan untuk pecahan struk, atau null bila valid. */
export function splitIssue(total: number, parts: readonly SplitPart[]): string | null {
  if (parts.length < SPLIT_MIN_PARTS) return 'Pecahan minimal dua kategori.'
  if (parts.length > SPLIT_MAX_PARTS) return `Pecahan maksimal ${SPLIT_MAX_PARTS} kategori.`
  if (parts.some((part) => !part.categoryId)) return 'Pilih kategori untuk setiap pecahan.'
  if (parts.some((part) => !Number.isFinite(part.amount) || part.amount <= 0)) {
    return 'Nominal setiap pecahan harus lebih dari 0.'
  }
  if (new Set(parts.map((part) => part.categoryId)).size !== parts.length) {
    return 'Setiap kategori hanya boleh dipakai sekali. Gabungkan nominalnya bila sama.'
  }
  const sum = parts.reduce((acc, part) => acc + part.amount, 0)
  if (sum !== total) {
    const diff = total - sum
    return diff > 0
      ? `Total pecahan kurang Rp ${diff.toLocaleString('id-ID')} dari total struk.`
      : `Total pecahan lebih Rp ${Math.abs(diff).toLocaleString('id-ID')} dari total struk.`
  }
  return null
}

/** Semua anggota grup split yang sama dengan `transaction` (termasuk dirinya), atau hanya dirinya. */
export function splitMembers(
  transaction: Transaction,
  all: readonly Transaction[],
): Transaction[] {
  if (!transaction.splitGroupId) return [transaction]
  return all
    .filter((item) => item.splitGroupId === transaction.splitGroupId)
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id))
}
