import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Goal, GoalContribution } from '../types'

export function useGoals(): { goals: Goal[]; contributions: GoalContribution[] } {
  const goals = useLiveQuery<Goal[]>(() => db.goals.toArray(), [])
  const contributions = useLiveQuery<GoalContribution[]>(
    () => db.goalContributions.toArray(),
    [],
  )
  return { goals: goals ?? [], contributions: contributions ?? [] }
}
