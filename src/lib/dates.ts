import {
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  eachYearOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import type { Granularity, ReportPreset, TrendPoint, Transaction } from '../types'

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function formatDate(iso: string, pattern = 'dd MMM yyyy'): string {
  try {
    return format(parseISO(iso), pattern, { locale: localeId })
  } catch {
    return iso
  }
}

export function formatDateTime(date = new Date()): string {
  return format(date, 'dd MMM yyyy HH:mm', { locale: localeId })
}

export function monthRange(date = new Date()): { start: string; end: string; label: string } {
  return {
    start: format(startOfMonth(date), 'yyyy-MM-dd'),
    end: format(endOfMonth(date), 'yyyy-MM-dd'),
    label: format(date, 'MMMM yyyy', { locale: localeId }),
  }
}

export function presetRange(
  preset: ReportPreset,
  customStart?: string,
  customEnd?: string,
): { start: string; end: string; label: string } {
  const today = new Date()

  switch (preset) {
    case 'today': {
      const iso = format(today, 'yyyy-MM-dd')
      return {
        start: iso,
        end: iso,
        label: format(today, 'dd MMMM yyyy', { locale: localeId }),
      }
    }
    case 'week': {
      const start = startOfWeek(today, { weekStartsOn: 1 })
      const end = endOfWeek(today, { weekStartsOn: 1 })
      return {
        start: format(start, 'yyyy-MM-dd'),
        end: format(end, 'yyyy-MM-dd'),
        label: `${format(start, 'dd MMM', { locale: localeId })} - ${format(end, 'dd MMM yyyy', {
          locale: localeId,
        })}`,
      }
    }
    case 'month': {
      const range = monthRange(today)
      return { ...range, label: format(today, 'MMMM yyyy', { locale: localeId }) }
    }
    case 'year': {
      return {
        start: format(startOfYear(today), 'yyyy-MM-dd'),
        end: format(endOfYear(today), 'yyyy-MM-dd'),
        label: format(today, 'yyyy', { locale: localeId }),
      }
    }
    case 'custom':
    default: {
      const start = customStart || format(startOfMonth(today), 'yyyy-MM-dd')
      const end = customEnd || format(today, 'yyyy-MM-dd')
      return { start, end, label: `${formatDate(start)} - ${formatDate(end)}` }
    }
  }
}

export function buildTrend(
  transactions: Transaction[],
  granularity: Granularity,
): { data: TrendPoint[]; start: string; end: string } {
  const today = new Date()
  let starts: Date[] = []
  let endDate = today
  let keyOf: (date: Date) => string
  let labelOf: (date: Date) => string

  if (granularity === 'daily') {
    const start = subDays(today, 13)
    starts = eachDayOfInterval({ start, end: today })
    keyOf = (date) => format(date, 'yyyy-MM-dd')
    labelOf = (date) => format(date, 'dd MMM', { locale: localeId })
  } else if (granularity === 'weekly') {
    const end = endOfWeek(today, { weekStartsOn: 1 })
    const start = startOfWeek(subWeeks(today, 7), { weekStartsOn: 1 })
    starts = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 })
    endDate = end
    keyOf = (date) => format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    labelOf = (date) => format(date, 'd MMM', { locale: localeId })
  } else if (granularity === 'monthly') {
    const start = startOfMonth(subMonths(today, 11))
    const end = endOfMonth(today)
    starts = eachMonthOfInterval({ start, end })
    endDate = end
    keyOf = (date) => format(date, 'yyyy-MM')
    labelOf = (date) => format(date, 'MMM yy', { locale: localeId })
  } else {
    const start = startOfYear(subYears(today, 4))
    const end = endOfYear(today)
    starts = eachYearOfInterval({ start, end })
    endDate = end
    keyOf = (date) => format(date, 'yyyy')
    labelOf = (date) => format(date, 'yyyy')
  }

  const map = new Map<string, TrendPoint>()
  for (const date of starts) {
    const key = keyOf(date)
    map.set(key, { key, label: labelOf(date), income: 0, expense: 0, net: 0 })
  }

  for (const transaction of transactions) {
    const point = map.get(keyOf(parseISO(transaction.occurredAt)))
    if (!point) continue
    if (transaction.type === 'income') point.income += transaction.amount
    else point.expense += transaction.amount
    point.net = point.income - point.expense
  }

  return {
    data: Array.from(map.values()),
    start: format(starts[0] ?? today, 'yyyy-MM-dd'),
    end: format(endDate, 'yyyy-MM-dd'),
  }
}
