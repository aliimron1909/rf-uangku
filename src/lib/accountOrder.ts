/**
 * Menggeser satu id satu langkah ke atas/bawah dalam urutan. Mengembalikan urutan baru,
 * atau null bila sudah di ujung atau id tidak ditemukan.
 */
export function moveInOrder(ids: string[], id: string, direction: 'up' | 'down'): string[] | null {
  const index = ids.indexOf(id)
  if (index < 0) return null
  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= ids.length) return null
  const next = [...ids]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
