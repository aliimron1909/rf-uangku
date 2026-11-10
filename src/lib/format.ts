export function formatRupiah(value: number): string {
  const sign = value < 0 ? '-' : ''
  return `${sign}Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
    Math.abs(value),
  )}`
}

export function formatSignedRupiah(value: number, type: 'income' | 'expense'): string {
  const sign = type === 'income' ? '+' : '-'
  return `${sign}Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
    Math.abs(value),
  )}`
}

export function formatCompactRupiah(value: number): string {
  if (value === 0) return 'Rp 0'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000_000) {
    return `${sign}Rp ${(abs / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1).replace('.', ',')} M`
  }
  if (abs >= 1_000_000) {
    return `${sign}Rp ${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace('.', ',')} jt`
  }
  if (abs >= 1_000) {
    return `${sign}Rp ${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1).replace('.', ',')} rb`
  }
  return `${sign}Rp ${abs}`
}

export function formatNumberInput(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  return new Intl.NumberFormat('id-ID').format(Number(digits))
}

export function parseNumberInput(value: string): number {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}%`
}

export function formatRupiahForPdf(value: number): string {
  return formatRupiah(value).replace(/\u00A0/g, ' ')
}
