import type { TxType } from '../types'

/** Notifikasi mentah dari aplikasi bank/e-wallet (dibaca di HP, tidak pernah dikirim ke server). */
export interface RawBankNotif {
  id: string
  pkg: string
  title: string
  text: string
  time: number
}

/** Transaksi yang terdeteksi dan menunggu ditinjau pengguna. */
export interface PendingNotifTx {
  id: string
  type: TxType
  amount: number
  note: string
  source: string
  /** yyyy-MM-dd */
  occurredAt: string
  time: number
}

export const BANK_NOTIF_PENDING_KEY = 'bankNotifPending'
export const BANK_NOTIF_ENABLED_KEY = 'bankNotifEnabled'
const MAX_PENDING = 50
/** Notifikasi kembar (mis. dari app dan SMS) dalam jeda ini dianggap satu transaksi. */
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000

const SOURCE_NAMES: [string, string][] = [
  ['id.dana', 'DANA'],
  ['ovo.id', 'OVO'],
  ['com.gojek', 'GoPay'],
  ['com.shopee', 'ShopeePay'],
  ['com.telkom.mwallet', 'LinkAja'],
  ['id.co.bri', 'BRImo'],
  ['id.bmri', 'Livin Mandiri'],
  ['com.mandiri', 'Mandiri'],
  ['src.com.bni', 'BNI Mobile'],
  ['com.btpn', 'Jenius'],
  ['com.jago', 'Jago'],
  ['id.co.bcadigital', 'blu'],
  ['com.bca', 'BCA'],
  ['id.co.cimbniaga', 'OCTO'],
  ['net.myinfosys.permata', 'PermataMobile'],
  ['com.bsm', 'BSI Mobile'],
  ['com.bnc', 'Neobank'],
  ['seabank', 'SeaBank'],
]

export function sourceName(pkg: string): string {
  const lower = pkg.toLowerCase()
  const found = SOURCE_NAMES.find(([prefix]) =>
    prefix === 'seabank' ? lower.includes(prefix) : lower.startsWith(prefix.toLowerCase()),
  )
  return found?.[1] ?? 'Bank/e-wallet'
}

/** Mengubah "1.250.000", "1.250.000,50", "50,000", "50000" menjadi bilangan bulat rupiah. */
export function parseIdrAmount(raw: string): number {
  const value = raw.trim()
  if (/^\d+$/.test(value)) return Number(value)
  const lastSeparator = Math.max(value.lastIndexOf('.'), value.lastIndexOf(','))
  if (lastSeparator < 0) return NaN
  const fraction = value.slice(lastSeparator + 1)
  // Tiga digit setelah pemisah terakhir = pemisah ribuan; selain itu = desimal (dibuang).
  const integerPart = fraction.length === 3 ? value : value.slice(0, lastSeparator)
  return Number(integerPart.replace(/[.,]/g, ''))
}

const AMOUNT_PATTERN = /(?:Rp|IDR)\.?\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi
const BALANCE_BEFORE = /(saldo|sisa|balance|limit|biaya|admin|fee)\W*$/i

function pickAmount(text: string): number | null {
  for (const match of text.matchAll(AMOUNT_PATTERN)) {
    const before = text.slice(Math.max(0, (match.index ?? 0) - 18), match.index ?? 0)
    if (BALANCE_BEFORE.test(before)) continue
    const amount = parseIdrAmount(match[1])
    if (Number.isFinite(amount) && amount > 0) return amount
  }
  return null
}

const INCOME_WORDS = /(terima|diterima|menerima|dana masuk|uang masuk|transfer masuk|masuk ke|kredit|gaji|refund|pengembalian dana)/i
const EXPENSE_WORDS = /(bayar|pembayaran|pembelian|belanja|transfer (ke|berhasil|keluar)|dikirim|kirim uang|debit|penarikan|tarik tunai|keluar|checkout|qris|transaksi (di|pada|berhasil))/i
/** Isi ulang saldo hanya memindahkan uang antar rekening: dilewati supaya tidak menggandakan catatan. */
const SKIP_WORDS = /(otp|kode verifikasi|kode rahasia|top ?up|isi saldo|promo|cashback|diskon|voucher|login|masuk akun|kata sandi|password)/i

/** Mengurai satu notifikasi menjadi calon transaksi; null bila bukan transaksi uang yang jelas. */
export function parseBankNotification(raw: RawBankNotif): PendingNotifTx | null {
  const text = `${raw.title} ${raw.text}`.replace(/\s+/g, ' ').trim()
  if (!text || SKIP_WORDS.test(text)) return null
  const amount = pickAmount(text)
  if (amount === null) return null
  const income = INCOME_WORDS.test(text)
  const expense = EXPENSE_WORDS.test(text)
  if (!income && !expense) return null
  // Bila kedua jenis kata muncul, "transfer ke" menandakan uang keluar; selain itu anggap uang masuk.
  const type: TxType = income && !(expense && /transfer ke|dikirim|kirim uang|pembayaran ke|bayar/i.test(text)) ? 'income' : 'expense'
  const date = new Date(raw.time)
  const occurredAt = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const source = sourceName(raw.pkg)
  const note = `${source}: ${raw.text.replace(/\s+/g, ' ').trim()}`.slice(0, 90)
  return { id: raw.id, type, amount, note, source, occurredAt, time: raw.time }
}

/** Menggabungkan hasil baru ke daftar tinjauan: tanpa ID kembar dan tanpa transaksi kembar berdekatan. */
export function mergePending(existing: PendingNotifTx[], incoming: PendingNotifTx[]): PendingNotifTx[] {
  const result = [...existing]
  for (const item of incoming) {
    if (result.some((current) => current.id === item.id)) continue
    const twin = result.some(
      (current) =>
        current.type === item.type &&
        current.amount === item.amount &&
        Math.abs(current.time - item.time) <= DUPLICATE_WINDOW_MS,
    )
    if (twin) continue
    result.push(item)
  }
  return result.sort((a, b) => b.time - a.time).slice(0, MAX_PENDING)
}
