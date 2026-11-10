import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Account } from '../types'

export function useAccounts(): Account[] {
  const value = useLiveQuery<Account[]>(
    async () =>
      (await db.accounts.orderBy('sortOrder').toArray()).filter((account) => !account.archived),
    [],
  )
  return value ?? []
}

export function useAllAccounts(): Account[] {
  const value = useLiveQuery<Account[]>(
    () => db.accounts.orderBy('sortOrder').toArray(),
    [],
  )
  return value ?? []
}
