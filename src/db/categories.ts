import { db } from './db'
import { moveInOrder } from '../lib/accountOrder'

/**
 * Menggeser kategori aktif satu posisi di antara saudaranya (jenis dan induk yang sama).
 * Kategori arsip tidak ikut diurutkan dan selalu ditampilkan di bawah.
 */
export async function moveCategory(id: string, direction: 'up' | 'down'): Promise<boolean> {
  return db.transaction('rw', db.categories, async () => {
    const target = await db.categories.get(id)
    if (!target || target.archived) return false
    const sameType = (await db.categories.orderBy('sortOrder').toArray()).filter(
      (category) =>
        category.type === target.type && (category.parentId ?? '') === (target.parentId ?? ''),
    )
    const active = sameType.filter((category) => !category.archived)
    const nextIds = moveInOrder(
      active.map((category) => category.id),
      id,
      direction,
    )
    if (!nextIds) return false
    const order = [...nextIds, ...sameType.filter((category) => category.archived).map((c) => c.id)]
    const byId = new Map(sameType.map((category) => [category.id, category]))
    for (let index = 0; index < order.length; index++) {
      const category = byId.get(order[index])
      if (category && category.sortOrder !== index + 1) {
        await db.categories.update(category.id, { sortOrder: index + 1 })
      }
    }
    return true
  })
}
