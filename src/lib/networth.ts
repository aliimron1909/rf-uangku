import type { Account, Debt, DebtPayment, Transaction } from '../types'
import { monthRangeFromKey, shiftMonthKey } from './dates'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

export interface NetWorthPoint {
  /** 'YYYY-MM' */
  key: string
  label: string
  /** Tanggal acuan (akhir bulan, atau hari ini untuk bulan berjalan). */
  asOf: string
  /** Saldo semua rekening (transfer tidak mengubah total). */
  cash: number
  /** Piutang yang belum dibayar. */
  receivable: number
  /** Hutang yang belum dibayar. */
  payable: number
  netWorth: number
}

/**
 * Kekayaan bersih di akhir tiap bulan: saldo rekening + piutang - hutang.
 * Setoran tujuan tabungan tidak ikut dihitung karena tidak memindahkan saldo rekening.
 */
export function netWorthSeries(
  accounts: Account[],
  transactions: Transaction[],
  debts: Debt[],
  payments: DebtPayment[],
  today: string,
  months = 12,
): NetWorthPoint[] {
  const opening = accounts.reduce((sum, a) => sum + (Number(a.openingBalance) || 0), 0)
  const debtById = new Map(debts.map((debt) => [debt.id, debt]))
  const currentKey = today.slice(0, 7)
  const points: NetWorthPoint[] = []

  for (let offset = months - 1; offset >= 0; offset--) {
    const key = shiftMonthKey(currentKey, -offset)
    const end = monthRangeFromKey(key).end
    const asOf = end > today ? today : end

    let cash = opening
    for (const tx of transactions) {
      if (tx.occurredAt <= asOf) cash += tx.type === 'income' ? tx.amount : -tx.amount
    }

    let receivable = 0
    let payable = 0
    for (const debt of debts) {
      if (debt.createdAt.slice(0, 10) > asOf) continue
      if (debt.accountId) cash += debt.direction === 'owe' ? debt.amount : -debt.amount
      if (debt.direction === 'owe') payable += debt.amount
      else receivable += debt.amount
    }
    for (const payment of payments) {
      if (payment.occurredAt > asOf) continue
      const debt = debtById.get(payment.debtId)
      if (!debt || debt.createdAt.slice(0, 10) > asOf) continue
      if (debt.direction === 'owe') {
        payable -= payment.amount
        if (payment.accountId) cash -= payment.amount
      } else {
        receivable -= payment.amount
        if (payment.accountId) cash += payment.amount
      }
    }
    payable = Math.max(0, payable)
    receivable = Math.max(0, receivable)

    points.push({
      key,
      label: format(new Date(`${key}-01T00:00:00`), 'MMM yy', { locale: localeId }),
      asOf,
      cash,
      receivable,
      payable,
      netWorth: cash + receivable - payable,
    })
  }
  return points
}

/** Titik awal pertama yang punya data, agar grafik tidak diawali deretan nol. */
export function trimLeadingEmpty(points: NetWorthPoint[]): NetWorthPoint[] {
  const first = points.findIndex(
    (p) => p.cash !== 0 || p.receivable !== 0 || p.payable !== 0,
  )
  return first <= 0 ? points : points.slice(first)
}
