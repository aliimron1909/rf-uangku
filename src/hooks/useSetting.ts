import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

export function useSetting<T>(key: string, fallback: T): T {
  const value = useLiveQuery<T | undefined>(async () => {
    const row = await db.settings.get(key)
    return row ? (row.value as T) : undefined
  }, [key])

  return value === undefined ? fallback : value
}
