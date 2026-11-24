import { db } from './db'
import { createRecurring } from './recurring'
import { createId } from '../lib/utils'
import {
  buildSchedule,
  fixedMonthsOf,
  installmentDate,
  summarize,
  totalMonths,
  type KprInput,
} from '../lib/kpr'
import type { KprSimulation } from '../types'

export interface KprSaveInput extends KprInput {
  name: string
  startMonth: string
}

export async function saveKprSimulation(input: KprSaveInput, id?: string): Promise<KprSimulation> {
  const now = new Date().toISOString()
  const existing = id ? await db.kprSimulations.get(id) : undefined
  const row: KprSimulation = {
    id: existing?.id ?? createId(),
    name: input.name.trim().slice(0, 60) || 'Simulasi KPR',
    price: input.price,
    downPayment: input.downPayment,
    years: input.years,
    fixedRate: input.fixedRate,
    fixedYears: input.fixedYears,
    floatingRate: input.floatingRate,
    startMonth: input.startMonth,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  await db.kprSimulations.put(row)
  return row
}

export async function deleteKprSimulation(id: string): Promise<void> {
  await db.kprSimulations.delete(id)
}

/**
 * Membuat transaksi berulang bulanan untuk cicilan: satu aturan untuk masa fixed dan, bila ada,
 * satu lagi untuk masa floating (nominalnya berbeda). Mengembalikan jumlah aturan yang dibuat.
 */
export async function createKprRecurring(options: {
  input: KprInput
  firstDate: string
  accountId: string
  categoryId: string
}): Promise<number> {
  const { input, firstDate, accountId, categoryId } = options
  const summary = summarize(input, buildSchedule(input))
  const months = totalMonths(input)
  const fixedMonths = fixedMonthsOf(input)
  let created = 0
  const make = async (amount: number, from: number, to: number, label: string) => {
    await createRecurring({
      type: 'expense',
      amount: Math.round(amount),
      accountId,
      categoryId,
      note: `Cicilan KPR (${label})`,
      frequency: 'monthly',
      interval: 1,
      startDate: installmentDate(firstDate, from),
      endDate: installmentDate(firstDate, to),
    })
    created += 1
  }
  if (fixedMonths > 0) await make(summary.paymentFixed, 1, fixedMonths, 'bunga fixed')
  if (fixedMonths < months) await make(summary.paymentFloating, fixedMonths + 1, months, 'bunga floating')
  return created
}
