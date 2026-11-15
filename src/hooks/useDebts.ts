import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Debt, DebtPayment } from '../types'

export function useDebts(): { debts: Debt[]; payments: DebtPayment[] } {
  const debts = useLiveQuery<Debt[]>(() => db.debts.toArray(), [])
  const payments = useLiveQuery<DebtPayment[]>(() => db.debtPayments.toArray(), [])
  return { debts: debts ?? [], payments: payments ?? [] }
}
