import { db } from './db'
import { isIsoDate } from '../lib/dateMath'
import { goalSaved } from '../lib/goals'
import { createId } from '../lib/utils'
import type { Goal, GoalContribution, GoalContributionKind } from '../types'

export const GOAL_NAME_MAX_LENGTH = 60

export interface GoalInput {
  name: string
  targetAmount: number
  deadline?: string
  color: string
  note?: string
}

function cleanGoal(input: GoalInput): Omit<Goal, 'id' | 'createdAt' | 'updatedAt'> {
  const name = input.name.trim()
  if (!name) throw new Error('Nama target wajib diisi.')
  if (name.length > GOAL_NAME_MAX_LENGTH) {
    throw new Error(`Nama target maksimal ${GOAL_NAME_MAX_LENGTH} karakter.`)
  }
  if (!Number.isFinite(input.targetAmount) || input.targetAmount <= 0) {
    throw new Error('Nominal target harus lebih dari 0.')
  }
  if (input.deadline && !isIsoDate(input.deadline)) throw new Error('Tenggat tidak valid.')
  return {
    name,
    targetAmount: input.targetAmount,
    deadline: input.deadline || undefined,
    color: input.color,
    note: input.note?.trim() || '',
  }
}

export async function createGoal(input: GoalInput): Promise<Goal> {
  const now = new Date().toISOString()
  const goal: Goal = { id: createId(), ...cleanGoal(input), createdAt: now, updatedAt: now }
  await db.goals.add(goal)
  return goal
}

export async function updateGoal(id: string, input: GoalInput): Promise<void> {
  const updated = await db.goals.update(id, {
    ...cleanGoal(input),
    updatedAt: new Date().toISOString(),
  })
  if (updated === 0) throw new Error('Target tidak ditemukan.')
}

export async function deleteGoal(id: string): Promise<void> {
  await db.transaction('rw', db.goals, db.goalContributions, async () => {
    await db.goalContributions.where('goalId').equals(id).delete()
    await db.goals.delete(id)
  })
}

export interface ContributionInput {
  goalId: string
  kind: GoalContributionKind
  amount: number
  occurredAt: string
  note?: string
}

export async function addGoalContribution(input: ContributionInput): Promise<GoalContribution> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Nominal harus lebih dari 0.')
  }
  if (!isIsoDate(input.occurredAt)) throw new Error('Tanggal tidak valid.')

  return db.transaction('rw', db.goals, db.goalContributions, async () => {
    if (!(await db.goals.get(input.goalId))) throw new Error('Target tidak ditemukan.')
    if (input.kind === 'withdrawal') {
      const items = await db.goalContributions.where('goalId').equals(input.goalId).toArray()
      if (input.amount > goalSaved(items, input.goalId)) {
        throw new Error('Nominal pengambilan melebihi tabungan yang terkumpul.')
      }
    }
    const row: GoalContribution = {
      id: createId(),
      goalId: input.goalId,
      kind: input.kind,
      amount: input.amount,
      occurredAt: input.occurredAt,
      note: input.note?.trim() || '',
      createdAt: new Date().toISOString(),
    }
    await db.goalContributions.add(row)
    return row
  })
}

export async function deleteGoalContribution(id: string): Promise<void> {
  await db.transaction('rw', db.goalContributions, async () => {
    const row = await db.goalContributions.get(id)
    if (!row) return
    const items = await db.goalContributions.where('goalId').equals(row.goalId).toArray()
    const after = goalSaved(
      items.filter((item) => item.id !== id),
      row.goalId,
    )
    if (after < 0) {
      throw new Error('Tidak bisa dihapus: tabungan akan menjadi negatif karena ada pengambilan setelahnya.')
    }
    await db.goalContributions.delete(id)
  })
}
