import { useMemo, useState } from 'react'
import { FileUp } from 'lucide-react'
import type { Category, Transaction } from '../../types'
import { useAccounts } from '../../hooks/useAccounts'
import { useAllCategories } from '../../hooks/useCategories'
import { importTransactions } from '../../db/transactions'
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  buildImportRows,
  detectHeaderRow,
  guessMapping,
  parseCsv,
  type ColumnMapping,
  type ImportRow,
} from '../../lib/csvImport'
import { formatDate } from '../../lib/dates'
import { formatRupiah } from '../../lib/format'
import { cn, errorMessage } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'

interface ImportCsvModalProps {
  open: boolean
  existing: Transaction[]
  onClose: () => void
}

type Step = 'pick' | 'map' | 'review'
type AmountMode = 'single' | 'split'

const NONE = '-1'

export function ImportCsvModal({ open, existing, onClose }: ImportCsvModalProps) {
  const { toast } = useToast()
  const accounts = useAccounts()
  const categories = useAllCategories()

  const [step, setStep] = useState<Step>('pick')
  const [fileName, setFileName] = useState('')
  const [table, setTable] = useState<string[][]>([])
  const [headerRow, setHeaderRow] = useState(0)
  const [accountId, setAccountId] = useState('')
  const [amountMode, setAmountMode] = useState<AmountMode>('single')
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: -1, description: -1, amount: null, debit: null, credit: null, type: null,
  })
  const [positiveIsExpense, setPositiveIsExpense] = useState(false)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [skipped, setSkipped] = useState<Array<{ line: number; reason: string }>>([])
  const [truncated, setTruncated] = useState(false)
  const [included, setIncluded] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const header = table[headerRow] ?? []
  const columnLabel = (index: number) => header[index] || `Kolom ${index + 1}`
  const columnCount = Math.max(0, ...table.slice(0, 20).map((row) => row.length))
  const effectiveAccountId = accountId || accounts[0]?.id || ''

  function reset() {
    setStep('pick')
    setFileName('')
    setTable([])
    setRows([])
    setSkipped([])
    setIncluded(new Set())
    setError('')
  }

  function close() {
    reset()
    onClose()
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    if (file.size > IMPORT_MAX_BYTES) {
      setError('Ukuran file maksimal 2 MB.')
      return
    }
    try {
      const parsed = parseCsv(await file.text())
      if (parsed.length < 2) {
        setError('File kosong atau tidak berformat CSV.')
        return
      }
      const detected = detectHeaderRow(parsed)
      const headerIndex = detected >= 0 ? detected : 0
      const guessed = guessMapping(parsed[headerIndex])
      setFileName(file.name)
      setTable(parsed)
      setHeaderRow(headerIndex)
      setMapping(guessed)
      setAmountMode(guessed.debit !== null && guessed.credit !== null ? 'split' : 'single')
      setStep('map')
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  function changeHeaderRow(value: number) {
    const index = Math.min(Math.max(value - 1, 0), table.length - 1)
    setHeaderRow(index)
    setMapping(guessMapping(table[index] ?? []))
  }

  function pickColumn(field: keyof ColumnMapping, value: string) {
    const index = Number(value)
    setMapping((current) => ({
      ...current,
      [field]: field === 'date' || field === 'description' ? index : index < 0 ? null : index,
    }))
  }

  function buildReview() {
    setError('')
    const effective: ColumnMapping =
      amountMode === 'split'
        ? { ...mapping, amount: null }
        : { ...mapping, debit: null, credit: null }
    if (effective.date < 0) return setError('Pilih kolom tanggal.')
    if (effective.description < 0) return setError('Pilih kolom keterangan.')
    if (amountMode === 'single' && effective.amount === null) return setError('Pilih kolom nominal.')
    if (amountMode === 'split' && (effective.debit === null || effective.credit === null)) {
      return setError('Pilih kolom debit dan kredit.')
    }
    if (!effectiveAccountId) return setError('Pilih rekening tujuan.')

    const result = buildImportRows(
      table,
      { mapping: effective, headerRow, positiveIsExpense, accountId: effectiveAccountId },
      categories,
      existing,
    )
    if (result.rows.length === 0) {
      setError('Tidak ada baris yang bisa dibaca. Periksa pemilihan kolom dan baris judul.')
      return
    }
    setRows(result.rows)
    setSkipped(result.skipped)
    setTruncated(result.truncated)
    setIncluded(new Set(result.rows.filter((row) => !row.duplicate).map((row) => row.line)))
    setStep('review')
  }

  const selected = useMemo(() => rows.filter((row) => included.has(row.line)), [rows, included])
  const totals = useMemo(
    () => ({
      income: selected.filter((row) => row.type === 'income').reduce((sum, row) => sum + row.amount, 0),
      expense: selected.filter((row) => row.type === 'expense').reduce((sum, row) => sum + row.amount, 0),
    }),
    [selected],
  )

  function categoriesFor(type: 'income' | 'expense', currentId: string): Category[] {
    return categories.filter(
      (category) => category.type === type && (!category.archived || category.id === currentId),
    )
  }

  async function handleImport() {
    setBusy(true)
    try {
      const count = await importTransactions(selected, effectiveAccountId)
      toast(`${count} transaksi diimpor (diberi tag #impor).`)
      close()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const columnOptions = Array.from({ length: columnCount }, (_, index) => index)
  const preview = table.slice(headerRow + 1, headerRow + 4)

  function ColumnSelect(props: { label: string; field: keyof ColumnMapping; optional?: boolean }) {
    const value = mapping[props.field]
    return (
      <Select
        label={props.label}
        value={value === null ? NONE : String(value)}
        onChange={(event) => pickColumn(props.field, event.target.value)}
      >
        <option value={NONE}>{props.optional ? '(tidak ada)' : 'Pilih kolom'}</option>
        {columnOptions.map((index) => (
          <option key={index} value={index}>
            {columnLabel(index)}
          </option>
        ))}
      </Select>
    )
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Impor mutasi CSV"
      description="Data dibaca di perangkat ini dan tidak diunggah ke server."
      size="lg"
    >
      {step === 'pick' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Pilih file CSV dari m-banking atau e-wallet (pemisah koma, titik koma, atau tab).
            Maksimal {IMPORT_MAX_ROWS.toLocaleString('id-ID')} baris dan 2 MB.
          </p>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-8 text-sm font-semibold text-slate-600 transition hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-300">
            <FileUp className="h-5 w-5" />
            Pilih file CSV
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(event) => void handleFile(event)}
            />
          </label>
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        </div>
      )}

      {step === 'map' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            File: <strong>{fileName}</strong> · {table.length} baris
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Rekening tujuan"
              value={effectiveAccountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
            <div className="space-y-1.5">
              <label
                htmlFor="header-row"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Baris judul kolom
              </label>
              <input
                id="header-row"
                type="number"
                min={1}
                max={table.length}
                value={headerRow + 1}
                onChange={(event) => changeHeaderRow(Number(event.target.value) || 1)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <ColumnSelect label="Kolom tanggal" field="date" />
            <ColumnSelect label="Kolom keterangan" field="description" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(['single', 'split'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setAmountMode(mode)}
                className={cn(
                  'rounded-xl border px-3 py-2 text-xs font-semibold transition',
                  amountMode === mode
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400',
                )}
              >
                {mode === 'single' ? 'Satu kolom nominal' : 'Kolom debit dan kredit'}
              </button>
            ))}
          </div>
          {amountMode === 'single' ? (
            <div className="space-y-3">
              <ColumnSelect label="Kolom nominal" field="amount" />
              <ColumnSelect label="Kolom jenis (DB/CR, opsional)" field="type" optional />
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={positiveIsExpense}
                  onChange={(event) => setPositiveIsExpense(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                />
                Nominal positif berarti pengeluaran
              </label>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <ColumnSelect label="Kolom debit (keluar)" field="debit" />
              <ColumnSelect label="Kolom kredit (masuk)" field="credit" />
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  {columnOptions.map((index) => (
                    <th key={index} className="whitespace-nowrap px-2 py-1.5 font-semibold">
                      {columnLabel(index)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-slate-100 dark:border-slate-800">
                    {columnOptions.map((index) => (
                      <td key={index} className="max-w-[10rem] truncate px-2 py-1.5">
                        {row[index] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={reset}>
              Ganti file
            </Button>
            <Button onClick={buildReview}>Lanjut ke pratinjau</Button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {selected.length} dari {rows.length} dipilih
            </span>
            <span className="text-emerald-600 dark:text-emerald-400">
              Masuk {formatRupiah(totals.income)}
            </span>
            <span className="text-rose-600 dark:text-rose-400">
              Keluar {formatRupiah(totals.expense)}
            </span>
            <button
              type="button"
              className="ml-auto font-semibold text-emerald-600 dark:text-emerald-400"
              onClick={() =>
                setIncluded(
                  selected.length === rows.length ? new Set() : new Set(rows.map((row) => row.line)),
                )
              }
            >
              {selected.length === rows.length ? 'Kosongkan' : 'Pilih semua'}
            </button>
          </div>
          {(skipped.length > 0 || truncated) && (
            <p className="rounded-xl bg-amber-50 p-2.5 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {skipped.length > 0 &&
                `${skipped.length} baris dilewati (mis. baris ${skipped[0].line}: ${skipped[0].reason}). `}
              {truncated && `Hanya ${IMPORT_MAX_ROWS} baris pertama yang dibaca.`}
            </p>
          )}
          <div className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
            {rows.map((row) => (
              <div key={row.line} className="space-y-1.5 px-3 py-2.5">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={included.has(row.line)}
                    onChange={(event) =>
                      setIncluded((current) => {
                        const next = new Set(current)
                        if (event.target.checked) next.add(row.line)
                        else next.delete(row.line)
                        return next
                      })
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {row.description || '(tanpa keterangan)'}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {formatDate(row.date, 'dd MMM yyyy')}
                      {row.duplicate && <Badge variant="warning">Mungkin duplikat</Badge>}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 text-sm font-bold',
                      row.type === 'income'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400',
                    )}
                  >
                    {row.type === 'income' ? '+' : '-'}
                    {formatRupiah(row.amount)}
                  </span>
                </label>
                <Select
                  aria-label={`Kategori baris ${row.line}`}
                  value={row.categoryId}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item) =>
                        item.line === row.line ? { ...item, categoryId: event.target.value } : item,
                      ),
                    )
                  }
                >
                  {categoriesFor(row.type, row.categoryId).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={() => setStep('map')} disabled={busy}>
              Kembali
            </Button>
            <Button onClick={() => void handleImport()} loading={busy} disabled={selected.length === 0}>
              Impor {selected.length} transaksi
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
