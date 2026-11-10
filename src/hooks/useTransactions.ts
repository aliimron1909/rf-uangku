import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { sortTransactions } from '../lib/analytics'
import type { Transaction } from '../types'

export function useTransactions(): Transaction[] {
  const value = useLiveQuery<Transaction[]>(
    async () => sortTransactions(await db.transactions.toArray()),
    [],
  )
  return value ?? []
}
