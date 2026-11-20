import type { Category, TxType } from '../types'

export const PATH_SEPARATOR = ' › '

/** Id kategori yang punya subkategori (grup). Grup tidak dipakai langsung pada transaksi. */
export function groupIdSet(categories: Category[]): Set<string> {
  const ids = new Set<string>()
  for (const category of categories) if (category.parentId) ids.add(category.parentId)
  return ids
}

/** Kategori yang bisa dipilih pada transaksi: semua kecuali grup. */
export function selectableCategories(categories: Category[]): Category[] {
  const groups = groupIdSet(categories)
  return categories.filter((category) => !groups.has(category.id))
}

/** "Grup › Subkategori" bila punya induk, selain itu nama kategori saja. */
export function categoryLabel(category: Category, categories: Category[]): string {
  const parent = category.parentId ? categories.find((item) => item.id === category.parentId) : undefined
  return parent ? `${parent.name}${PATH_SEPARATOR}${category.name}` : category.name
}

/** Urutan pohon: grup/kategori tingkat atas menurut sortOrder, subkategorinya langsung di bawahnya. */
export function sortCategoryTree(categories: Category[]): Category[] {
  const ids = new Set(categories.map((category) => category.id))
  const bySort = (a: Category, b: Category) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
  const top = categories.filter((category) => !category.parentId || !ids.has(category.parentId)).sort(bySort)
  const result: Category[] = []
  for (const category of top) {
    result.push(category)
    result.push(...categories.filter((item) => item.parentId === category.id).sort(bySort))
  }
  return result
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s*[>›→»]\s*/g, '›')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Id yang tidak boleh jadi induk kategori ini: dirinya sendiri dan turunannya. */
export function invalidParentIds(categoryId: string, categories: Category[]): Set<string> {
  const blocked = new Set<string>([categoryId])
  let grew = true
  while (grew) {
    grew = false
    for (const category of categories) {
      if (category.parentId && blocked.has(category.parentId) && !blocked.has(category.id)) {
        blocked.add(category.id)
        grew = true
      }
    }
  }
  return blocked
}

/**
 * Mencocokkan nama kategori hasil AI ("Grup › Subkategori", nama subkategori saja, atau nama grup)
 * ke subkategori aktif yang bisa dipilih. Jatuh ke "Lainnya"/"Lain-lain" bila tidak cocok.
 */
export function findCategoryByAiName(name: string, type: TxType, categories: Category[]): Category | null {
  const active = categories.filter((item) => item.type === type && !item.archived)
  const choices = selectableCategories(active)
  const wanted = normalize(name)
  const label = (item: Category) => normalize(categoryLabel(item, active))
  const isOther = (item: Category) => /^(lainnya|lain-lain)$/.test(item.name.toLowerCase())

  if (wanted) {
    const exact = choices.find((item) => label(item) === wanted)
    if (exact) return exact
    const lastPart = wanted.split('›').pop() ?? wanted
    const byLeaf = choices.filter((item) => normalize(item.name) === lastPart)
    if (byLeaf.length === 1) return byLeaf[0]
    if (byLeaf.length > 1) {
      const groupPart = wanted.includes('›') ? wanted.split('›')[0] : ''
      const inGroup = byLeaf.find((item) => normalize(categoryLabel(item, active)).startsWith(groupPart))
      return inGroup ?? byLeaf[0]
    }
    const group = active.find(
      (item) => normalize(item.name) === wanted.split('›')[0] && groupIdSet(active).has(item.id),
    )
    if (group) {
      const children = choices.filter((item) => item.parentId === group.id)
      return children.find(isOther) ?? children[0] ?? null
    }
    const fuzzy = choices.find((item) => {
      const candidate = label(item)
      return candidate.includes(wanted) || wanted.includes(candidate)
    })
    if (fuzzy) return fuzzy
  }
  return (
    choices.find((item) => !item.parentId && isOther(item)) ??
    choices.find(isOther) ??
    choices[0] ??
    null
  )
}

/** Daftar kategori untuk prompt AI: satu baris per subkategori ("Grup › Subkategori"). */
export function aiCategoryList(type: TxType, categories: Category[]): string {
  const active = categories.filter((item) => item.type === type && !item.archived)
  const choiceIds = new Set(selectableCategories(active).map((item) => item.id))
  return sortCategoryTree(active)
    .filter((item) => choiceIds.has(item.id))
    .map((item) => `- ${categoryLabel(item, active)}`)
    .join('\n')
}
