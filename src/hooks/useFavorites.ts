import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { sortFavorites } from '../lib/favorites'
import type { Favorite } from '../types'

export function useFavorites(): Favorite[] {
  const value = useLiveQuery<Favorite[]>(
    async () => sortFavorites(await db.favorites.toArray()),
    [],
  )
  return value ?? []
}
