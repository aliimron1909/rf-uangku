import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { TrashItem } from '../types'

export function useTrash(): TrashItem[] {
  const value = useLiveQuery<TrashItem[]>(
    async () => (await db.trash.toArray()).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)),
    [],
  )
  return value ?? []
}
