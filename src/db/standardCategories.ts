import { db, getSetting, setSetting } from './db'
import { planStandardCategories } from '../lib/standardCategories'

const INSTALLED_KEY = 'standardCategoriesV1'

/** Memasang kategori standar dan memindahkan kategori bawaan lama ke grup barunya. Aman diulang. */
export async function installStandardCategories(): Promise<{ added: number; moved: number }> {
  const result = await db.transaction('rw', db.categories, async () => {
    const plan = planStandardCategories(await db.categories.toArray(), new Date().toISOString())
    if (plan.add.length > 0) await db.categories.bulkAdd(plan.add)
    for (const item of plan.update) await db.categories.update(item.id, item.changes)
    return { added: plan.add.length, moved: plan.update.length }
  })
  await setSetting(INSTALLED_KEY, true)
  return result
}

/** Sekali saja setelah pembaruan: pasang otomatis agar data lama langsung tertata. */
export async function ensureStandardCategories(): Promise<void> {
  if (await getSetting<boolean>(INSTALLED_KEY, false)) return
  await installStandardCategories()
}
