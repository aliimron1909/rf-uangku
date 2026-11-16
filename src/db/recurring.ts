import { db } from './db'
import { createId } from '../lib/utils'
import { writeTransfer } from './transfers'
import { todayISO } from '../lib/dates'
import {
  advanceOccurrence,
  dueOccurrences,
  isRuleFinished,
  nextOccurrenceAfter,
  nextOccurrenceOnOrAfter,
} from '../lib/recurrence'
import type {
  RecurrenceFrequency,
  RecurringTransaction,
  Transaction,
  TxType,
} from '../types'

export interface RecurringInput {
  type: TxType
  amount: number
  accountId: string
  categoryId: string
  /** Jika terisi, aturan ini adalah transfer ke rekening ini. */
  toAccountId?: string
  /** Biaya admin per transfer berulang. */
  fee?: number
  note?: string
  frequency: RecurrenceFrequency
  interval: number
  startDate: string
  endDate?: string
}

export interface RecurringRunResult {
  created: number
  /** Dari jumlah ini, berapa yang berupa transfer. */
  transfers: number
  paused: number
  checked: number
}

export async function createRecurring(input: RecurringInput): Promise<RecurringTransaction> {
  const now = new Date().toISOString()
  const rule: RecurringTransaction = {
    id: createId(),
    ...input,
    note: input.note?.trim() || '',
    nextRunAt: input.startDate,
    active: true,
    createdAt: now,
    updatedAt: now,
  }
  await db.recurringTransactions.add(rule)
  return rule
}

export async function updateRecurring(
  id: string,
  input: RecurringInput,
  options: { resetSchedule?: boolean } = {},
): Promise<RecurringTransaction> {
  const existing = await db.recurringTransactions.get(id)
  if (!existing) throw new Error('Aturan transaksi berulang tidak ditemukan.')

  const nextRule: RecurringTransaction = {
    ...existing,
    ...input,
    note: input.note?.trim() || '',
    updatedAt: new Date().toISOString(),
  }

  if (options.resetSchedule) {
    // Editing a schedule must not generate a second transaction for today.
    nextRule.nextRunAt = nextOccurrenceAfter(nextRule, todayISO())
  }

  await db.recurringTransactions.put(nextRule)
  return nextRule
}

export async function deleteRecurring(id: string): Promise<void> {
  await db.recurringTransactions.delete(id)
}

export async function setRecurringActive(
  id: string,
  active: boolean,
): Promise<{ active: boolean; finished: boolean }> {
  const rule = await db.recurringTransactions.get(id)
  if (!rule) throw new Error('Aturan transaksi berulang tidak ditemukan.')

  const now = new Date().toISOString()

  if (!active) {
    await db.recurringTransactions.update(id, { active: false, updatedAt: now })
    return { active: false, finished: false }
  }

  const nextRunAt = nextOccurrenceOnOrAfter(rule, todayISO())
  const finished = Boolean(rule.endDate && nextRunAt > rule.endDate)
  await db.recurringTransactions.update(id, {
    active: !finished,
    nextRunAt,
    updatedAt: now,
  })
  return { active: !finished, finished }
}

export async function processDueRecurring(today = todayISO()): Promise<RecurringRunResult> {
  return db.transaction(
    'rw',
    db.recurringTransactions,
    db.transactions,
    db.transfers,
    db.accounts,
    db.categories,
    async () => {
      const due = await db.recurringTransactions.where('nextRunAt').belowOrEqual(today).toArray()
      let created = 0
      let transfers = 0
      let paused = 0

      for (const candidate of due) {
        const rule = await db.recurringTransactions.get(candidate.id)
        if (!rule || !rule.active || rule.nextRunAt > today) continue

        const now = new Date().toISOString()

        if (isRuleFinished(rule)) {
          await db.recurringTransactions.update(rule.id, { active: false, updatedAt: now })
          paused += 1
          continue
        }

        const dates = dueOccurrences(rule, today)

        if (rule.toAccountId) {
          const [from, to] = await Promise.all([
            db.accounts.get(rule.accountId),
            db.accounts.get(rule.toAccountId),
          ])
          if (!from || from.archived || !to || to.archived || from.id === to.id) {
            await db.recurringTransactions.update(rule.id, { active: false, updatedAt: now })
            paused += 1
            continue
          }
          for (const date of dates) {
            await writeTransfer({
              fromAccountId: rule.accountId,
              toAccountId: rule.toAccountId,
              amount: rule.amount,
              fee: rule.fee,
              occurredAt: date,
              note: rule.note?.trim() || '',
              recurringId: rule.id,
            })
            created += 1
            transfers += 1
          }
        } else {
          const [account, category] = await Promise.all([
            db.accounts.get(rule.accountId),
            db.categories.get(rule.categoryId),
          ])

          if (
            !account ||
            account.archived ||
            !category ||
            category.archived ||
            category.type !== rule.type
          ) {
            await db.recurringTransactions.update(rule.id, { active: false, updatedAt: now })
            paused += 1
            continue
          }

          for (const date of dates) {
            const transaction: Transaction = {
              id: createId(),
              type: rule.type,
              amount: rule.amount,
              accountId: rule.accountId,
              categoryId: rule.categoryId,
              occurredAt: date,
              note: rule.note?.trim() || '',
              recurringId: rule.id,
              createdAt: now,
              updatedAt: now,
            }
            await db.transactions.add(transaction)
            created += 1
          }
        }

        if (dates.length === 0) continue

        const lastRunAt = dates[dates.length - 1]
        const nextRunAt = advanceOccurrence(lastRunAt, rule)
        const finished = Boolean(rule.endDate && nextRunAt > rule.endDate)

        await db.recurringTransactions.update(rule.id, {
          lastRunAt,
          nextRunAt,
          active: !finished,
          updatedAt: now,
        })
      }

      return { created, transfers, paused, checked: due.length }
    },
  )
}
