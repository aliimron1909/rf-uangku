import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Budget } from '../types'

export function useBudgets(): Budget[] {
  const value = useLiveQuery<Budget[]>(() => db.budgets.toArray(), [])
  return value ?? []
}
