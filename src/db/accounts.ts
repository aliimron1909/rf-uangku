import { db } from './db'
import { moveInOrder } from '../lib/accountOrder'

/**
 * Menggeser rekening aktif satu posisi. Rekening arsip tidak ikut diurutkan dan
 * selalu ditampilkan di bawah. Nomor urut rekening aktif dinomori ulang 1..n.
 */
export async function moveAccount(id: string, direction: 'up' | 'down'): Promise<boolean> {
  return db.transaction('rw', db.accounts, async () => {
    const all = await db.accounts.orderBy('sortOrder').toArray()
    const active = all.filter((account) => !account.archived)
    const nextIds = moveInOrder(
      active.map((account) => account.id),
      id,
      direction,
    )
    if (!nextIds) return false
    const archived = all.filter((account) => account.archived)
    const order = [...nextIds, ...archived.map((account) => account.id)]
    const byId = new Map(all.map((account) => [account.id, account]))
    for (let index = 0; index < order.length; index++) {
      const account = byId.get(order[index])
      if (account && account.sortOrder !== index + 1) {
        await db.accounts.update(account.id, { sortOrder: index + 1 })
      }
    }
    return true
  })
}
