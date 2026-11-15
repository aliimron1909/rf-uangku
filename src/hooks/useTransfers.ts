import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Transfer } from '../types'

export function sortTransfers(transfers: Transfer[]): Transfer[] {
  return [...transfers].sort(
    (a, b) =>
      b.occurredAt.localeCompare(a.occurredAt) || b.createdAt.localeCompare(a.createdAt),
  )
}

export function useTransfers(): Transfer[] {
  const value = useLiveQuery<Transfer[]>(
    async () => sortTransfers(await db.transfers.toArray()),
    [],
  )
  return value ?? []
}
