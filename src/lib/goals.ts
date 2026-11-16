import type { AccountFlow, Goal, GoalContribution } from '../types'
import { daysBetween } from './dateMath'

export type GoalStatus = 'active' | 'late' | 'done'

export interface GoalProgress {
  goal: Goal
  saved: number
  remaining: number
  /** 0-100, dibatasi 100 walau tabungan melebihi target. */
  percentage: number
  status: GoalStatus
  /** Sisa hari sampai tenggat (negatif jika lewat); null jika tanpa tenggat. */
  daysLeft: number | null
  /** Setoran per bulan agar target tercapai tepat waktu; null jika tidak relevan. */
  monthlyNeeded: number | null
}

export function goalSaved(contributions: GoalContribution[], goalId: string): number {
  return contributions.reduce((sum, item) => {
    if (item.goalId !== goalId) return sum
    return item.kind === 'deposit' ? sum + item.amount : sum - item.amount
  }, 0)
}

function statusRank(status: GoalStatus): number {
  if (status === 'active') return 0
  if (status === 'late') return 1
  return 2
}

export function goalProgress(
  goals: Goal[],
  contributions: GoalContribution[],
  today: string,
): GoalProgress[] {
  const savedByGoal = new Map<string, number>()
  for (const item of contributions) {
    const delta = item.kind === 'deposit' ? item.amount : -item.amount
    savedByGoal.set(item.goalId, (savedByGoal.get(item.goalId) ?? 0) + delta)
  }

  return goals
    .map((goal): GoalProgress => {
      const saved = savedByGoal.get(goal.id) ?? 0
      const remaining = Math.max(0, goal.targetAmount - saved)
      const percentage =
        goal.targetAmount > 0
          ? Math.min(100, Math.max(0, (saved / goal.targetAmount) * 100))
          : 0
      const daysLeft = goal.deadline ? daysBetween(today, goal.deadline) : null

      let status: GoalStatus = 'active'
      if (goal.targetAmount > 0 && saved >= goal.targetAmount) status = 'done'
      else if (daysLeft !== null && daysLeft < 0) status = 'late'

      let monthlyNeeded: number | null = null
      if (status === 'active' && daysLeft !== null && remaining > 0) {
        const months = Math.max(1, Math.ceil(daysLeft / 30))
        monthlyNeeded = Math.ceil(remaining / months)
      }

      return { goal, saved, remaining, percentage, status, daysLeft, monthlyNeeded }
    })
    .sort(
      (a, b) =>
        statusRank(a.status) - statusRank(b.status) ||
        (a.goal.deadline ?? '9999-99-99').localeCompare(b.goal.deadline ?? '9999-99-99') ||
        a.goal.name.localeCompare(b.goal.name),
    )
}

export function goalSummary(progress: GoalProgress[]): {
  totalSaved: number
  totalTarget: number
  activeCount: number
  doneCount: number
} {
  return {
    totalSaved: progress.reduce((sum, item) => sum + Math.max(0, item.saved), 0),
    totalTarget: progress.reduce((sum, item) => sum + item.goal.targetAmount, 0),
    activeCount: progress.filter((item) => item.status !== 'done').length,
    doneCount: progress.filter((item) => item.status === 'done').length,
  }
}

/**
 * Perubahan saldo rekening akibat setoran/pengambilan tabungan yang dikaitkan ke rekening:
 * setor = uang keluar dari rekening (-), ambil = uang kembali ke rekening (+).
 */
export function goalAccountFlows(contributions: GoalContribution[]): AccountFlow[] {
  const flows: AccountFlow[] = []
  for (const item of contributions) {
    if (!item.accountId) continue
    flows.push({
      accountId: item.accountId,
      amount: item.kind === 'deposit' ? -item.amount : item.amount,
    })
  }
  return flows
}
