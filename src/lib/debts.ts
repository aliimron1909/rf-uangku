import type { AccountFlow, Debt, DebtDirection, DebtPayment } from '../types'
import { daysBetween } from './dateMath'

export const DEBT_DUE_SOON_DAYS = 7

export type DebtStatus = 'paid' | 'overdue' | 'dueSoon' | 'open'

export interface DebtProgress {
  debt: Debt
  paid: number
  remaining: number
  percentage: number
  status: DebtStatus
  /** Sisa hari sampai jatuh tempo (negatif jika lewat); null jika tanpa jatuh tempo. */
  daysUntilDue: number | null
}

export function debtDirectionLabel(direction: DebtDirection): string {
  return direction === 'owe' ? 'Hutang saya' : 'Piutang'
}

function statusRank(status: DebtStatus): number {
  if (status === 'overdue') return 0
  if (status === 'dueSoon') return 1
  if (status === 'open') return 2
  return 3
}

export function debtProgress(
  debts: Debt[],
  payments: DebtPayment[],
  today: string,
): DebtProgress[] {
  const paidByDebt = new Map<string, number>()
  for (const payment of payments) {
    paidByDebt.set(payment.debtId, (paidByDebt.get(payment.debtId) ?? 0) + payment.amount)
  }

  return debts
    .map((debt): DebtProgress => {
      const paid = paidByDebt.get(debt.id) ?? 0
      const remaining = Math.max(0, debt.amount - paid)
      const percentage =
        debt.amount > 0 ? Math.min(100, Math.max(0, (paid / debt.amount) * 100)) : 0
      const daysUntilDue = debt.dueDate ? daysBetween(today, debt.dueDate) : null

      let status: DebtStatus = 'open'
      if (remaining <= 0) status = 'paid'
      else if (daysUntilDue !== null && daysUntilDue < 0) status = 'overdue'
      else if (daysUntilDue !== null && daysUntilDue <= DEBT_DUE_SOON_DAYS) status = 'dueSoon'

      return { debt, paid, remaining, percentage, status, daysUntilDue }
    })
    .sort(
      (a, b) =>
        statusRank(a.status) - statusRank(b.status) ||
        (a.debt.dueDate ?? '9999-99-99').localeCompare(b.debt.dueDate ?? '9999-99-99') ||
        a.debt.person.localeCompare(b.debt.person),
    )
}

export function debtSummary(progress: DebtProgress[]): {
  oweRemaining: number
  lentRemaining: number
  overdueCount: number
  dueSoonCount: number
} {
  let oweRemaining = 0
  let lentRemaining = 0
  for (const item of progress) {
    if (item.debt.direction === 'owe') oweRemaining += item.remaining
    else lentRemaining += item.remaining
  }
  return {
    oweRemaining,
    lentRemaining,
    overdueCount: progress.filter((item) => item.status === 'overdue').length,
    dueSoonCount: progress.filter((item) => item.status === 'dueSoon').length,
  }
}

/** Yang perlu diingatkan: sudah lewat jatuh tempo atau jatuh tempo dalam 7 hari. */
export function debtReminders(progress: DebtProgress[]): DebtProgress[] {
  return progress.filter((item) => item.status === 'overdue' || item.status === 'dueSoon')
}

/**
 * Perubahan saldo rekening akibat hutang/piutang yang dikaitkan ke rekening.
 * - Hutang saya: uang masuk saat dicatat (+), keluar saat dibayar (-).
 * - Piutang: uang keluar saat dicatat (-), masuk saat diterima (+).
 * Bukan pemasukan/pengeluaran, jadi tidak memengaruhi laporan dan budget.
 */
export function debtAccountFlows(debts: Debt[], payments: DebtPayment[]): AccountFlow[] {
  const flows: AccountFlow[] = []
  const byId = new Map(debts.map((debt) => [debt.id, debt]))

  for (const debt of debts) {
    if (!debt.accountId) continue
    flows.push({
      accountId: debt.accountId,
      amount: debt.direction === 'owe' ? debt.amount : -debt.amount,
    })
  }
  for (const payment of payments) {
    if (!payment.accountId) continue
    const debt = byId.get(payment.debtId)
    if (!debt) continue
    flows.push({
      accountId: payment.accountId,
      amount: debt.direction === 'owe' ? -payment.amount : payment.amount,
    })
  }
  return flows
}
