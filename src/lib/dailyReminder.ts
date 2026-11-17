export const DAILY_REMINDER_ENABLED_KEY = 'dailyReminderEnabled'
export const DAILY_REMINDER_TIME_KEY = 'dailyReminderTime'
export const DAILY_REMINDER_LAST_KEY = 'dailyReminderLast'
export const DEFAULT_REMINDER_TIME = '20:00'

export function isValidReminderTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export interface DailyReminderState {
  enabled: boolean
  /** Jam pengingat 'HH:mm'. */
  time: string
  /** Menit sejak tengah malam saat ini. */
  nowMinutes: number
  today: string
  /** Tanggal terakhir pengingat sudah ditampilkan. */
  lastReminded?: string
  /** Sudah ada transaksi/transfer bertanggal hari ini. */
  hasEntryToday: boolean
}

/** Ingatkan sekali per hari, setelah jam yang dipilih, hanya jika belum ada catatan hari ini. */
export function shouldRemindToday(state: DailyReminderState): boolean {
  if (!state.enabled) return false
  if (state.hasEntryToday) return false
  if (state.lastReminded === state.today) return false
  const time = isValidReminderTime(state.time) ? state.time : DEFAULT_REMINDER_TIME
  return state.nowMinutes >= timeToMinutes(time)
}
