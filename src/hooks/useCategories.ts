import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { sortCategoryTree } from '../lib/categoryTree'
import type { Category } from '../types'

export function useCategories(): Category[] {
  const value = useLiveQuery<Category[]>(
    async () =>
      sortCategoryTree((await db.categories.toArray()).filter((category) => !category.archived)),
    [],
  )
  return value ?? []
}

export function useAllCategories(): Category[] {
  const value = useLiveQuery<Category[]>(
    async () => sortCategoryTree(await db.categories.toArray()),
    [],
  )
  return value ?? []
}
