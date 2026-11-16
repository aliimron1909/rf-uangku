import type { Account, Category, Favorite } from '../types'

export const FAVORITE_NAME_MAX_LENGTH = 40

/** Yang paling sering dipakai di depan; seri dibedakan pemakaian terakhir lalu nama. */
export function sortFavorites(favorites: Favorite[]): Favorite[] {
  return [...favorites].sort(
    (a, b) =>
      b.useCount - a.useCount ||
      (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '') ||
      a.name.localeCompare(b.name),
  )
}

/**
 * Alasan favorit tidak bisa dipakai saat ini (rekening/kategori hilang,
 * diarsipkan, atau jenisnya berubah). null berarti siap dipakai.
 */
export function favoriteIssue(
  favorite: Pick<Favorite, 'type' | 'accountId' | 'categoryId'>,
  account: Account | undefined,
  category: Category | undefined,
): string | null {
  if (!account) return 'Rekening favorit ini sudah tidak ada. Ubah favoritnya.'
  if (account.archived) return `Rekening ${account.name} diarsipkan. Ubah favoritnya.`
  if (!category) return 'Kategori favorit ini sudah tidak ada. Ubah favoritnya.'
  if (category.archived) return `Kategori ${category.name} diarsipkan. Ubah favoritnya.`
  if (category.type !== favorite.type) {
    return `Jenis kategori ${category.name} sudah berubah. Ubah favoritnya.`
  }
  return null
}

/** Nama favorit yang disarankan dari catatan, atau nama kategori bila catatan kosong. */
export function suggestFavoriteName(note: string | undefined, categoryName: string): string {
  const base = (note ?? '').trim() || categoryName.trim()
  return base.slice(0, FAVORITE_NAME_MAX_LENGTH)
}
