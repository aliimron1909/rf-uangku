import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Category } from '../types'

export function useCategories(): Category[] {
  const value = useLiveQuery<Category[]>(
    async () =>
      (await db.categories.orderBy('sortOrder').toArray()).filter(
        (category) => !category.archived,
      ),
    [],
  )
  return value ?? []
}

export function useAllCategories(): Category[] {
  const value = useLiveQuery<Category[]>(
    () => db.categories.orderBy('sortOrder').toArray(),
    [],
  )
  return value ?? []
}
