// Logika murni pengingat harian (tanpa dependensi) agar bisa diuji dari skrip verifikasi.

/** Pengingat hanya dikirim dalam jendela ini setelah jam yang dipilih (menit). */
export const REMINDER_WINDOW_MINUTES = 180

export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** Tanggal (YYYY-MM-DD) dan menit-sejak-tengah-malam di zona waktu pengguna. */
export function localParts(now: Date, timeZone: string): { date: string; minutes: number } {
  let formatter: Intl.DateTimeFormat
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
  } catch {
    return localParts(now, 'Asia/Jakarta')
  }
  const parts: Record<string, string> = {}
  for (const part of formatter.formatToParts(now)) parts[part.type] = part.value
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

/** Apakah jam/tanggal sudah memenuhi syarat kirim (sebelum memeriksa ada-tidaknya catatan hari ini). */
export function isReminderDue(input: {
  enabled: boolean
  remindTime: string
  timeZone: string
  lastSentDate: string | null
  now: Date
}): { due: boolean; today: string } {
  const { date, minutes } = localParts(input.now, input.timeZone)
  if (!input.enabled || !isValidTime(input.remindTime) || input.lastSentDate === date) {
    return { due: false, today: date }
  }
  const elapsed = minutes - timeToMinutes(input.remindTime)
  return { due: elapsed >= 0 && elapsed < REMINDER_WINDOW_MINUTES, today: date }
}
