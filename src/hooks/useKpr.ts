import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { KprSimulation } from '../types'

export function useKprSimulations(): KprSimulation[] {
  const value = useLiveQuery<KprSimulation[]>(
    async () => (await db.kprSimulations.toArray()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [],
  )
  return value ?? []
}
