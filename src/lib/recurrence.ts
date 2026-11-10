import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  parseISO,
} from 'date-fns'
import type { RecurrenceFrequency, RecurringTransaction } from '../types'
import { formatDate } from './dates'

export const FREQUENCY_UNITS: Record<RecurrenceFrequency, string> = {
  daily: 'hari',
  weekly: 'minggu',
  monthly: 'bulan',
  yearly: 'tahun',
}

export function frequencyLabel(frequency: RecurrenceFrequency, interval: number): string {
  const unit = FREQUENCY_UNITS[frequency]
  return interval === 1 ? `Setiap ${unit}` : `Setiap ${interval} ${unit}`
}

export function recurrenceDescription(rule: RecurringTransaction): string {
  const end = rule.endDate ? ` · sampai ${formatDate(rule.endDate)}` : ''
  return `${frequencyLabel(rule.frequency, rule.interval)} · mulai ${formatDate(rule.startDate)}${end}`
}

function calendarMonthDiff(start: Date, current: Date): number {
  return (current.getFullYear() - start.getFullYear()) * 12 + current.getMonth() - start.getMonth()
}

function calendarYearDiff(start: Date, current: Date): number {
  return current.getFullYear() - start.getFullYear()
}

/**
 * Advance one occurrence from a known schedule date. Monthly and yearly rules
 * are anchored to startDate so dates like the 31st keep their anchor across
 * short months instead of drifting to the 28th forever.
 */
export function advanceOccurrence(
  currentISO: string,
  rule: Pick<RecurringTransaction, 'startDate' | 'frequency' | 'interval'>,
): string {
  const start = parseISO(rule.startDate)
  const current = parseISO(currentISO)

  if (rule.frequency === 'monthly') {
    const months = Math.max(0, calendarMonthDiff(start, current))
    return format(addMonths(start, months + rule.interval), 'yyyy-MM-dd')
  }

  if (rule.frequency === 'yearly') {
    const years = Math.max(0, calendarYearDiff(start, current))
    return format(addYears(start, years + rule.interval), 'yyyy-MM-dd')
  }

  if (rule.frequency === 'daily') {
    return format(addDays(current, rule.interval), 'yyyy-MM-dd')
  }

  return format(addWeeks(current, rule.interval), 'yyyy-MM-dd')
}

export function nextOccurrenceOnOrAfter(
  rule: Pick<RecurringTransaction, 'startDate' | 'frequency' | 'interval'>,
  dateISO: string,
): string {
  if (rule.startDate >= dateISO) return rule.startDate

  const start = parseISO(rule.startDate)
  const target = parseISO(dateISO)
  let result: Date

  if (rule.frequency === 'daily') {
    const diff = differenceInCalendarDays(target, start)
    const steps = Math.max(0, Math.ceil(diff / rule.interval))
    result = addDays(start, steps * rule.interval)
  } else if (rule.frequency === 'weekly') {
    const stepDays = 7 * rule.interval
    const diff = differenceInCalendarDays(target, start)
    const steps = Math.max(0, Math.ceil(diff / stepDays))
    result = addDays(start, steps * stepDays)
  } else if (rule.frequency === 'monthly') {
    const diff = calendarMonthDiff(start, target)
    const steps = Math.max(0, Math.ceil(diff / rule.interval))
    result = addMonths(start, steps * rule.interval)
  } else {
    const diff = calendarYearDiff(start, target)
    const steps = Math.max(0, Math.ceil(diff / rule.interval))
    result = addYears(start, steps * rule.interval)
  }

  const resultISO = format(result, 'yyyy-MM-dd')
  if (resultISO < dateISO) return advanceOccurrence(resultISO, rule)
  return resultISO
}

export function nextOccurrenceAfter(
  rule: Pick<RecurringTransaction, 'startDate' | 'frequency' | 'interval'>,
  dateISO: string,
): string {
  const next = nextOccurrenceOnOrAfter(rule, dateISO)
  return next > dateISO ? next : advanceOccurrence(next, rule)
}

export function dueOccurrences(
  rule: Pick<RecurringTransaction, 'nextRunAt' | 'startDate' | 'endDate' | 'frequency' | 'interval'>,
  todayISO: string,
): string[] {
  const dates: string[] = []
  let cursor = rule.nextRunAt
  let guard = 0

  while (cursor <= todayISO && guard < 500) {
    if (rule.endDate && cursor > rule.endDate) break
    dates.push(cursor)
    cursor = advanceOccurrence(cursor, rule)
    guard += 1
  }

  return dates
}

export function isRuleFinished(
  rule: Pick<RecurringTransaction, 'nextRunAt' | 'endDate'>,
): boolean {
  return Boolean(rule.endDate && rule.nextRunAt > rule.endDate)
}
