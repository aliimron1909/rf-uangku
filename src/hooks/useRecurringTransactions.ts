import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { RecurringTransaction } from '../types'

export function useRecurringTransactions(): RecurringTransaction[] {
  const value = useLiveQuery<RecurringTransaction[]>(
    async () => {
      const rules = await db.recurringTransactions.toArray()
      return rules.sort(
        (a, b) =>
          Number(b.active) - Number(a.active) ||
          a.nextRunAt.localeCompare(b.nextRunAt) ||
          a.createdAt.localeCompare(b.createdAt),
      )
    },
    [],
  )
  return value ?? []
}
