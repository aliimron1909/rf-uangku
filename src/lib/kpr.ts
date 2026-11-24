/** Hitungan simulasi KPR: bunga fixed lalu floating, anuitas (cicilan tetap per bulan di tiap masa). */

export interface KprInput {
  /** Harga rumah (Rp). */
  price: number
  /** Uang muka (Rp). */
  downPayment: number
  /** Lama cicilan (tahun). */
  years: number
  /** Bunga masa fixed (% per tahun). */
  fixedRate: number
  /** Lama masa fixed (tahun); 0 = langsung floating. */
  fixedYears: number
  /** Bunga masa floating (% per tahun). */
  floatingRate: number
}

export interface KprRow {
  /** Bulan ke-1 sampai terakhir. */
  month: number
  payment: number
  principal: number
  interest: number
  /** Sisa pokok setelah bulan ini. */
  balance: number
  phase: 'fixed' | 'floating'
}

export interface KprSummary {
  loan: number
  months: number
  fixedMonths: number
  paymentFixed: number
  paymentFloating: number
  totalPrincipal: number
  totalInterest: number
  totalPaid: number
}

export function loanAmount(input: KprInput): number {
  return Math.max(0, input.price - input.downPayment)
}

export function totalMonths(input: KprInput): number {
  return Math.max(0, Math.round(input.years * 12))
}

export function fixedMonthsOf(input: KprInput): number {
  return Math.min(totalMonths(input), Math.max(0, Math.round(input.fixedYears * 12)))
}

/** Cicilan bulanan anuitas (setara PMT). Bunga 0 = pokok dibagi rata. */
export function monthlyPayment(principal: number, annualRatePercent: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0
  const rate = annualRatePercent / 100 / 12
  if (rate === 0) return principal / months
  return (principal * rate) / (1 - Math.pow(1 + rate, -months))
}

export function buildSchedule(input: KprInput): KprRow[] {
  const loan = loanAmount(input)
  const months = totalMonths(input)
  if (loan <= 0 || months <= 0) return []
  const fixedMonths = fixedMonthsOf(input)
  const rows: KprRow[] = []
  let balance = loan
  let payment = 0
  for (let month = 1; month <= months; month++) {
    const phase = month <= fixedMonths ? 'fixed' : 'floating'
    const annual = phase === 'fixed' ? input.fixedRate : input.floatingRate
    // Cicilan dihitung ulang di awal tiap masa dari sisa pokok dan sisa bulan.
    if (month === 1 || month === fixedMonths + 1) payment = monthlyPayment(balance, annual, months - month + 1)
    const interest = (balance * annual) / 100 / 12
    const principal = month === months ? balance : Math.min(balance, payment - interest)
    balance = Math.max(0, balance - principal)
    rows.push({ month, payment: principal + interest, principal, interest, balance, phase })
  }
  return rows
}

export function summarize(input: KprInput, rows: KprRow[]): KprSummary {
  const loan = loanAmount(input)
  const months = totalMonths(input)
  const fixedMonths = fixedMonthsOf(input)
  const totalPrincipal = rows.reduce((sum, row) => sum + row.principal, 0)
  const totalInterest = rows.reduce((sum, row) => sum + row.interest, 0)
  return {
    loan,
    months,
    fixedMonths,
    paymentFixed: rows.find((row) => row.phase === 'fixed')?.payment ?? 0,
    paymentFloating: rows.find((row) => row.phase === 'floating')?.payment ?? 0,
    totalPrincipal,
    totalInterest,
    totalPaid: totalPrincipal + totalInterest,
  }
}

export interface KprYear {
  year: number
  principal: number
  interest: number
}

/** Pokok dan bunga yang dibayar per tahun cicilan (tahun ke-1, ke-2, ...). */
export function yearlyBreakdown(rows: KprRow[]): KprYear[] {
  const years: KprYear[] = []
  for (const row of rows) {
    const index = Math.floor((row.month - 1) / 12)
    if (!years[index]) years[index] = { year: index + 1, principal: 0, interest: 0 }
    years[index].principal += row.principal
    years[index].interest += row.interest
  }
  return years
}

/** Bulan ke-n (1 = bulan mulai) sebagai tanggal 'YYYY-MM-01'; startMonth berbentuk 'YYYY-MM'. */
export function monthDate(startMonth: string, month: number): string {
  const [year, mon] = startMonth.split('-').map(Number)
  const index = year * 12 + (mon - 1) + (month - 1)
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`
}

/** Menerima angka dari isian teks (koma desimal Indonesia diterima); NaN/negatif menjadi 0. */
export function parseDecimal(text: string): number {
  const value = Number(text.trim().replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? value : 0
}

/** Tanggal cicilan ke-n dari tanggal cicilan pertama (hari yang sama tiap bulan, maksimal tanggal 28). */
export function installmentDate(firstDate: string, month: number): string {
  const day = Math.min(28, Number(firstDate.slice(8, 10)) || 1)
  return `${monthDate(firstDate.slice(0, 7), month).slice(0, 7)}-${String(day).padStart(2, '0')}`
}
