import { useMemo, useState } from 'react'
import { CalendarDays, Download, FileSpreadsheet, FileText, SlidersHorizontal } from 'lucide-react'
import type { ReportPreset, ReportType } from '../types'
import { useTransactions } from '../hooks/useTransactions'
import { useAllAccounts } from '../hooks/useAccounts'
import { useAllCategories } from '../hooks/useCategories'
import { useProfile } from '../hooks/useProfile'
import { computeTotals, withRefs } from '../lib/analytics'
import { presetRange } from '../lib/dates'
import { formatRupiah } from '../lib/format'
import { downloadReportPdf } from '../lib/pdf'
import { downloadCsv, toCsv } from '../db/backup'
import { errorMessage } from '../lib/utils'
import { useToast } from '../contexts/ToastContext'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Input } from '../components/ui/Input'
import { EmptyState } from '../components/ui/EmptyState'
import { ReportTable } from '../components/reports/ReportTable'

const presetOptions: Array<{ value: ReportPreset; label: string }> = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'week', label: 'Minggu Ini' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'year', label: 'Tahun Ini' },
  { value: 'custom', label: 'Kustom' },
]

const typeLabels: Record<ReportType, string> = {
  all: 'Semua transaksi',
  income: 'Pemasukan saja',
  expense: 'Pengeluaran saja',
}

export function ReportsPage() {
  const transactions = useTransactions()
  const accounts = useAllAccounts()
  const categories = useAllCategories()
  const { name: profileName } = useProfile()
  const { toast } = useToast()

  const initialRange = presetRange('month')
  const [preset, setPreset] = useState<ReportPreset>('month')
  const [customStart, setCustomStart] = useState(initialRange.start)
  const [customEnd, setCustomEnd] = useState(initialRange.end)
  const [type, setType] = useState<ReportType>('all')
  const [accountId, setAccountId] = useState('all')
  const [downloading, setDownloading] = useState(false)

  const range = useMemo(
    () => presetRange(preset, customStart, customEnd),
    [preset, customStart, customEnd],
  )

  const reportTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        if (transaction.occurredAt < range.start || transaction.occurredAt > range.end) return false
        if (type !== 'all' && transaction.type !== type) return false
        if (accountId !== 'all' && transaction.accountId !== accountId) return false
        return true
      }),
    [transactions, range, type, accountId],
  )

  const rows = useMemo(
    () => withRefs(reportTransactions, accounts, categories),
    [reportTransactions, accounts, categories],
  )
  const totals = useMemo(() => computeTotals(reportTransactions), [reportTransactions])

  const accountLabel =
    accountId === 'all'
      ? 'Semua rekening'
      : accounts.find((account) => account.id === accountId)?.name ?? 'Semua rekening'

  async function handlePdf() {
    if (rows.length === 0) return
    setDownloading(true)
    try {
      await downloadReportPdf({
        transactions: reportTransactions,
        accounts,
        categories,
        start: range.start,
        end: range.end,
        periodLabel: range.label,
        typeLabel: typeLabels[type],
        accountLabel,
        userName: profileName,
      })
      toast('PDF laporan berhasil dibuat.')
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setDownloading(false)
    }
  }

  function handleCsv() {
    if (rows.length === 0) return
    downloadCsv(
      toCsv(reportTransactions, accounts, categories),
      `Laporan-RF-Uangku-${range.start}-sd-${range.end}.csv`,
    )
    toast('CSV laporan berhasil diunduh.')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Analisis Keuangan
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
            Laporan
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Pilih periode, lalu unduh PDF atau CSV.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCsv} disabled={rows.length === 0}>
            <FileSpreadsheet className="h-4 w-4" />
            CSV
          </Button>
          <Button onClick={() => void handlePdf()} loading={downloading} disabled={rows.length === 0}>
            <Download className="h-4 w-4" />
            Unduh PDF
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Periode Laporan</h3>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {presetOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPreset(option.value)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                preset === option.value
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input
              label="Tanggal mulai"
              type="date"
              value={customStart}
              onChange={(event) => setCustomStart(event.target.value)}
            />
            <Input
              label="Tanggal akhir"
              type="date"
              value={customEnd}
              onChange={(event) => setCustomEnd(event.target.value)}
            />
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Select
            label="Jenis transaksi"
            value={type}
            onChange={(event) => setType(event.target.value as ReportType)}
          >
            <option value="all">Semua transaksi</option>
            <option value="income">Pemasukan saja</option>
            <option value="expense">Pengeluaran saja</option>
          </Select>
          <Select
            label="Rekening"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            <option value="all">Semua rekening</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
                {account.archived ? ' (arsip)' : ''}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <SlidersHorizontal className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Periode aktif: <span className="font-semibold text-slate-700 dark:text-slate-200">{range.label}</span>
            {' · '}
            {typeLabels[type]}
            {' · '}
            {accountLabel}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ReportStat label="Pemasukan" value={totals.income} tone="income" />
        <ReportStat label="Pengeluaran" value={totals.expense} tone="expense" />
        <ReportStat label="Selisih" value={totals.net} tone={totals.net >= 0 ? 'net' : 'expense'} prefix={totals.net >= 0 ? '+' : ''} />
        <ReportStat label="Jumlah Transaksi" value={totals.count} tone="neutral" isCount />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 dark:border-slate-800 sm:px-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Rincian Transaksi</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{range.label}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {rows.length} baris
          </span>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-7 w-7" />}
            title="Belum ada transaksi pada periode ini"
            description="Ubah periode atau filter, atau tambahkan transaksi terlebih dahulu."
          />
        ) : (
          <ReportTable transactions={rows} />
        )}

        {rows.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40 sm:px-5">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total selisih</p>
            <p
              className={`text-sm font-extrabold ${
                totals.net >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {totals.net >= 0 ? '+' : ''}
              {formatRupiah(totals.net)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

interface ReportStatProps {
  label: string
  value: number
  tone: 'income' | 'expense' | 'net' | 'neutral'
  prefix?: string
  isCount?: boolean
}

const toneClasses: Record<ReportStatProps['tone'], string> = {
  income: 'text-emerald-600 dark:text-emerald-400',
  expense: 'text-rose-600 dark:text-rose-400',
  net: 'text-sky-600 dark:text-sky-400',
  neutral: 'text-slate-700 dark:text-slate-200',
}

function ReportStat({ label, value, tone, prefix = '', isCount }: ReportStatProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className={`mt-1.5 text-base font-extrabold tracking-tight sm:text-lg ${toneClasses[tone]}`}>
        {isCount ? value : `${prefix}${formatRupiah(value)}`}
      </p>
    </div>
  )
}
