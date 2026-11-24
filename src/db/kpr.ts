import { db } from './db'
import { createRecurring } from './recurring'
import { createId } from '../lib/utils'
import {
  buildSchedule,
  fixedMonthsOf,
  installmentDate,
  totalMonths,
  type KprInput,
} from '../lib/kpr'
import type { KprSimulation } from '../types'

export interface KprSaveInput extends KprInput {
  name: string
  startMonth: string
  paidMonths?: number
  actualBalance?: number
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
    paidMonths: input.paidMonths && input.paidMonths > 0 ? Math.floor(input.paidMonths) : undefined,
    actualBalance: input.actualBalance && input.actualBalance > 0 ? Math.round(input.actualBalance) : undefined,
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
 * Membuat transaksi berulang bulanan untuk cicilan yang belum dibayar: satu aturan untuk sisa masa fixed
 * dan, bila ada, satu lagi untuk masa floating (nominalnya berbeda). `paidMonths` = cicilan yang sudah
 * dibayar; `firstDate` = tanggal cicilan berikutnya (ke-paidMonths+1). Mengembalikan jumlah aturan dibuat.
 */
export async function createKprRecurring(options: {
  input: KprInput
  firstDate: string
  accountId: string
  categoryId: string
  paidMonths?: number
  actualBalance?: number
}): Promise<number> {
  const { input, firstDate, accountId, categoryId } = options
  const paid = Math.max(0, Math.floor(options.paidMonths ?? 0))
  const rows = buildSchedule(
    input,
    options.actualBalance && paid > 0 ? { afterMonth: paid, balance: options.actualBalance } : undefined,
  )
  const months = totalMonths(input)
  const fixedMonths = fixedMonthsOf(input)
  const from = paid + 1
  let created = 0
  const make = async (fromMonth: number, toMonth: number, label: string) => {
    if (fromMonth > toMonth) return
    await createRecurring({
      type: 'expense',
      amount: Math.round(rows[fromMonth - 1].payment),
      accountId,
      categoryId,
      note: `Cicilan KPR (${label})`,
      frequency: 'monthly',
      interval: 1,
      startDate: installmentDate(firstDate, fromMonth - from + 1),
      endDate: installmentDate(firstDate, toMonth - from + 1),
    })
    created += 1
  }
  await make(from, fixedMonths, 'bunga fixed')
  await make(Math.max(from, fixedMonths + 1), months, 'bunga floating')
  return created
}
