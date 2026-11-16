import type { Category, Transaction, TxType } from '../types'
import { isIsoDate } from './dateMath'

export const IMPORT_MAX_ROWS = 2000
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024
const NOTE_MAX_LENGTH = 160

/** Memecah teks CSV (kutip, kutip ganda, CRLF, BOM). Pemisah dideteksi otomatis. */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const source = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const pushCell = () => {
    row.push(cell.trim())
    cell = ''
  }
  const pushRow = () => {
    pushCell()
    if (row.some((value) => value !== '')) rows.push(row)
    row = []
  }
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"'
          index += 1
        } else quoted = false
      } else cell += char
    } else if (char === '"') quoted = true
    else if (char === delimiter) pushCell()
    else if (char === '\n') pushRow()
    else if (char === '\r') {
      if (source[index + 1] === '\n') index += 1
      pushRow()
    } else cell += char
  }
  if (cell !== '' || row.length > 0) pushRow()
  return rows
}

export function detectDelimiter(text: string): string {
  const sample = text.replace(/^﻿/, '').split(/\r?\n/).slice(0, 10)
  let best = ','
  let bestScore = -1
  for (const delimiter of [',', ';', '\t', '|']) {
    let score = 0
    for (const line of sample) {
      let quoted = false
      let count = 0
      for (const char of line) {
        if (char === '"') quoted = !quoted
        else if (char === delimiter && !quoted) count += 1
      }
      score += count
    }
    if (score > bestScore) {
      best = delimiter
      bestScore = score
    }
  }
  return best
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7,
  agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
}

function toIso(year: number, month: number, day: number): string | null {
  const value = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return isIsoDate(value) ? value : null
}

/** Mengenali yyyy-MM-dd, dd/MM/yyyy, dd-MM-yy, dan "5 Nov 2026" (nama bulan Indonesia/Inggris). */
export function parseDate(raw: string): string | null {
  const text = raw.trim()
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/.exec(text)
  if (match) return toIso(Number(match[1]), Number(match[2]), Number(match[3]))
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?!\d)/.exec(text)
  if (match) {
    const year = Number(match[3])
    return toIso(year < 100 ? 2000 + year : year, Number(match[2]), Number(match[1]))
  }
  match = /^(\d{1,2})[ -/]+([A-Za-z]{3,})[a-z]*\.?[ ,/-]+(\d{2}|\d{4})(?!\d)/.exec(text)
  if (match) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()]
    const year = Number(match[3])
    if (month) return toIso(year < 100 ? 2000 + year : year, month, Number(match[1]))
  }
  return null
}

/**
 * Nominal bertanda: "-50.000", "Rp 1.234.567,89", "1,234,567.00", "(25.000)", "75.000 DB".
 * Hasil dibulatkan ke rupiah; null bila tidak terbaca.
 */
export function parseAmount(raw: string): number | null {
  let text = raw.trim()
  if (!text) return null
  let negative = false
  if (/^\(.*\)$/.test(text)) {
    negative = true
    text = text.slice(1, -1)
  }
  if (/\bDB\b|\bDR\b|\bD$/i.test(text)) negative = true
  if (/^-|-$/.test(text.trim())) negative = true
  text = text.replace(/rp\.?|idr/gi, '').replace(/[^\d.,]/g, '')
  if (!/\d/.test(text)) return null

  const lastDot = text.lastIndexOf('.')
  const lastComma = text.lastIndexOf(',')
  let normalized: string
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? '.' : ','
    const thousands = decimal === '.' ? ',' : '.'
    normalized = text.split(thousands).join('').replace(decimal, '.')
  } else if (lastDot >= 0 || lastComma >= 0) {
    const separator = lastDot >= 0 ? '.' : ','
    const parts = text.split(separator)
    const tail = parts[parts.length - 1]
    normalized =
      parts.length > 2 || tail.length === 3 ? parts.join('') : `${parts[0]}.${tail}`
  } else normalized = text
  const value = Math.round(Number(normalized))
  if (!Number.isFinite(value)) return null
  return negative ? -value : value
}

export interface ColumnMapping {
  date: number
  description: number
  amount: number | null
  debit: number | null
  credit: number | null
  type: number | null
}

const none = -1
function findColumn(header: string[], pattern: RegExp): number {
  return header.findIndex((cell) => pattern.test(cell))
}

/** Menebak kolom dari judul. Mengembalikan -1 untuk kolom wajib yang tidak ketemu. */
export function guessMapping(header: string[]): ColumnMapping {
  const lower = header.map((cell) => cell.toLowerCase())
  const debit = findColumn(lower, /debit|\bdb\b|keluar|pengeluaran|tarik/)
  const credit = findColumn(lower, /kredit|credit|\bcr\b|masuk|pemasukan|setor/)
  const amount = findColumn(lower, /nominal|jumlah|amount|mutasi|nilai/)
  const type = findColumn(lower, /^(tipe|jenis|type|d\/k|db\/cr)/)
  return {
    date: findColumn(lower, /tanggal|tgl|date|waktu/),
    description: findColumn(lower, /keterangan|deskripsi|description|catatan|uraian|berita|remark|transaksi|detail/),
    amount: amount >= 0 ? amount : null,
    debit: debit >= 0 && credit >= 0 ? debit : null,
    credit: debit >= 0 && credit >= 0 ? credit : null,
    type: type >= 0 ? type : null,
  }
}

/** Baris judul = baris pertama yang memuat kata "tanggal"/"date" dan minimal 3 kolom terisi. */
export function detectHeaderRow(rows: string[][]): number {
  const index = rows.slice(0, 15).findIndex(
    (row) => row.filter(Boolean).length >= 3 && row.some((cell) => /tanggal|tgl|date/i.test(cell)),
  )
  return index
}

export interface ImportOptions {
  mapping: ColumnMapping
  /** Indeks baris judul; -1 bila tidak ada judul (data mulai dari baris pertama). */
  headerRow: number
  /** Bila true, nominal positif dianggap pengeluaran (sebagian bank memakai tanda terbalik). */
  positiveIsExpense: boolean
  accountId: string
}

export interface ImportRow {
  line: number
  date: string
  description: string
  amount: number
  type: TxType
  categoryId: string
  duplicate: boolean
}

export interface ImportParseResult {
  rows: ImportRow[]
  skipped: Array<{ line: number; reason: string }>
  truncated: boolean
}

export function normalizeDescription(text: string): string {
  return text
    .toLowerCase()
    .replace(/\d{4,}/g, ' ')
    .replace(/[^a-zÀ-ɏ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function typeFromText(value: string): TxType | null {
  const text = value.trim().toLowerCase()
  if (/^(db|d|dr|debit|keluar|pengeluaran|expense)$/.test(text)) return 'expense'
  if (/^(cr|k|kr|kredit|credit|masuk|pemasukan|income)$/.test(text)) return 'income'
  return null
}

/** Menebak kategori: riwayat deskripsi serupa, lalu nama kategori di deskripsi, lalu "Lainnya". */
export function guessCategory(
  description: string,
  type: TxType,
  categories: Category[],
  history: Transaction[],
): string {
  const ofType = categories.filter((category) => category.type === type && !category.archived)
  const normalized = normalizeDescription(description)
  if (normalized) {
    const match = history.find(
      (item) => item.type === type && normalizeDescription(item.note ?? '') === normalized,
    )
    if (match && ofType.some((category) => category.id === match.categoryId)) return match.categoryId
    const named = ofType.find((category) => {
      const name = category.name.toLowerCase()
      return name.length >= 3 && normalized.includes(name)
    })
    if (named) return named.id
  }
  return (
    ofType.find((category) => /lain/i.test(category.name))?.id ?? ofType[0]?.id ?? ''
  )
}

export function buildImportRows(
  table: string[][],
  options: ImportOptions,
  categories: Category[],
  existing: Transaction[],
): ImportParseResult {
  const { mapping } = options
  const rows: ImportRow[] = []
  const skipped: Array<{ line: number; reason: string }> = []
  const seen = new Set(
    existing
      .filter((item) => item.accountId === options.accountId)
      .map((item) => `${item.occurredAt}|${item.type}|${item.amount}|${normalizeDescription(item.note ?? '')}`),
  )
  let truncated = false

  for (let index = options.headerRow + 1; index < table.length; index += 1) {
    const cells = table[index]
    const line = index + 1
    if (rows.length >= IMPORT_MAX_ROWS) {
      truncated = true
      break
    }
    const date = parseDate(cells[mapping.date] ?? '')
    if (!date) {
      skipped.push({ line, reason: 'Tanggal tidak terbaca' })
      continue
    }

    let amount: number | null = null
    let type: TxType | null = null
    if (mapping.debit !== null && mapping.credit !== null) {
      const debit = parseAmount(cells[mapping.debit] ?? '')
      const credit = parseAmount(cells[mapping.credit] ?? '')
      if (debit && Math.abs(debit) > 0) {
        amount = Math.abs(debit)
        type = 'expense'
      } else if (credit && Math.abs(credit) > 0) {
        amount = Math.abs(credit)
        type = 'income'
      }
    } else if (mapping.amount !== null) {
      const value = parseAmount(cells[mapping.amount] ?? '')
      if (value) {
        amount = Math.abs(value)
        const explicit = mapping.type !== null ? typeFromText(cells[mapping.type] ?? '') : null
        if (explicit) type = explicit
        else {
          const expense = options.positiveIsExpense ? value > 0 : value < 0
          type = expense ? 'expense' : 'income'
        }
      }
    }
    if (!amount || !type) {
      skipped.push({ line, reason: 'Nominal tidak terbaca' })
      continue
    }

    const description = (cells[mapping.description] ?? '').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX_LENGTH)
    const key = `${date}|${type}|${amount}|${normalizeDescription(description)}`
    rows.push({
      line,
      date,
      description,
      amount,
      type,
      categoryId: guessCategory(description, type, categories, existing),
      duplicate: seen.has(key),
    })
  }
  return { rows, skipped, truncated }
}
