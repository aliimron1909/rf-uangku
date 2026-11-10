import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Save } from 'lucide-react'
import type {
  RecurrenceFrequency,
  RecurringTransaction,
  TxType,
} from '../../types'
import { useAllAccounts } from '../../hooks/useAccounts'
import { useAllCategories } from '../../hooks/useCategories'
import { createRecurring, processDueRecurring, updateRecurring } from '../../db/recurring'
import { todayISO } from '../../lib/dates'
import { formatNumberInput, parseNumberInput } from '../../lib/format'
import { errorMessage } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../ui/Button'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'

interface RecurringFormProps {
  rule?: RecurringTransaction | null
  onSaved: () => void
  onCancel: () => void
}

interface FormErrors {
  amount?: string
  accountId?: string
  categoryId?: string
  interval?: string
  startDate?: string
  endDate?: string
}

const FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'daily', label: 'Harian' },
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'yearly', label: 'Tahunan' },
]

export function RecurringForm({ rule, onSaved, onCancel }: RecurringFormProps) {
  const allAccounts = useAllAccounts()
  const allCategories = useAllCategories()
  const { toast } = useToast()

  const [type, setType] = useState<TxType>(rule?.type ?? 'expense')
  const [amountInput, setAmountInput] = useState(
    rule ? formatNumberInput(String(rule.amount)) : '',
  )
  const [accountId, setAccountId] = useState(rule?.accountId ?? '')
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? '')
  const [note, setNote] = useState(rule?.note ?? '')
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(rule?.frequency ?? 'monthly')
  const [intervalInput, setIntervalInput] = useState(String(rule?.interval ?? 1))
  const [startDate, setStartDate] = useState(rule?.startDate ?? todayISO())
  const [endDate, setEndDate] = useState(rule?.endDate ?? '')
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  const accountOptions = useMemo(
    () => allAccounts.filter((account) => !account.archived || account.id === accountId),
    [accountId, allAccounts],
  )

  const categoryOptions = useMemo(
    () =>
      allCategories.filter(
        (category) =>
          category.type === type && (!category.archived || category.id === categoryId),
      ),
    [allCategories, categoryId, type],
  )

  useEffect(() => {
    if (!accountId && accountOptions.length > 0) setAccountId(accountOptions[0].id)
  }, [accountId, accountOptions])

  useEffect(() => {
    if (!categoryId && categoryOptions.length > 0) setCategoryId(categoryOptions[0].id)
  }, [categoryId, categoryOptions])

  function changeType(nextType: TxType) {
    if (nextType === type) return
    setType(nextType)
    const nextCategories = allCategories.filter(
      (category) => category.type === nextType && !category.archived,
    )
    if (!nextCategories.some((category) => category.id === categoryId)) {
      setCategoryId(nextCategories[0]?.id ?? '')
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amount = parseNumberInput(amountInput)
    const interval = Number(intervalInput.replace(/\D/g, '')) || 0
    const nextErrors: FormErrors = {}

    if (!amount || amount <= 0) nextErrors.amount = 'Nominal harus lebih dari 0.'
    if (!accountId) nextErrors.accountId = 'Pilih rekening.'
    if (!categoryId) nextErrors.categoryId = 'Pilih kategori.'
    if (interval < 1 || interval > 365) nextErrors.interval = 'Interval harus 1–365.'
    if (!startDate) nextErrors.startDate = 'Pilih tanggal mulai.'
    if (endDate && endDate < startDate) nextErrors.endDate = 'Tanggal selesai harus setelah mulai.'

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    try {
      const input = {
        type,
        amount,
        accountId,
        categoryId,
        note: note.trim(),
        frequency,
        interval,
        startDate,
        ...(endDate ? { endDate } : {}),
      }

      if (rule) {
        const resetSchedule =
          rule.frequency !== frequency || rule.interval !== interval || rule.startDate !== startDate
        await updateRecurring(rule.id, input, { resetSchedule })
      } else {
        await createRecurring(input)
      }

      const result = await processDueRecurring()
      if (result.created > 0) {
        toast(`${result.created} transaksi berulang langsung dibuat.`, 'success')
      }
      if (result.paused > 0) {
        toast(`${result.paused} aturan berulang dijeda karena data terkait tidak valid.`, 'info')
      }
      onSaved()
    } catch (caught) {
      setErrors({ amount: errorMessage(caught) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
          Jenis transaksi
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => changeType('income')}
            className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition ${
              type === 'income'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <ArrowDownLeft className="h-4 w-4" />
            Pemasukan
          </button>
          <button
            type="button"
            onClick={() => changeType('expense')}
            className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition ${
              type === 'expense'
                ? 'border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-500/20 dark:border-rose-500 dark:bg-rose-950/50 dark:text-rose-300'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <ArrowUpRight className="h-4 w-4" />
            Pengeluaran
          </button>
        </div>
      </div>

      <CurrencyInput
        value={amountInput}
        onChange={setAmountInput}
        error={errors.amount}
        autoFocus={!rule}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Rekening"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          error={errors.accountId}
        >
          <option value="">Pilih rekening</option>
          {accountOptions.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
              {account.archived ? ' (arsip)' : ''}
            </option>
          ))}
        </Select>
        <Select
          label="Kategori"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          error={errors.categoryId}
        >
          <option value="">Pilih kategori</option>
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
              {category.archived ? ' (arsip)' : ''}
            </option>
          ))}
        </Select>
      </div>

      <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Jadwal berulang
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Frekuensi"
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as RecurrenceFrequency)}
          >
            {FREQUENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Input
            label="Setiap"
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            value={intervalInput}
            onChange={(event) => setIntervalInput(event.target.value.replace(/\D/g, ''))}
            error={errors.interval}
            hint="Contoh: 1 = tiap hari/bulan, 2 = tiap 2 hari/bulan."
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input
            label="Tanggal mulai"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            error={errors.startDate}
            max="2100-12-31"
          />
          <Input
            label="Tanggal selesai (opsional)"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            error={errors.endDate}
            min={startDate}
            max="2100-12-31"
          />
        </div>
      </div>

      <Textarea
        label="Catatan (opsional)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Contoh: langganan internet bulanan"
        maxLength={160}
        className="min-h-20"
      />

      <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
        Transaksi tertunda dibuat otomatis saat aplikasi dibuka atau dibuka kembali. Tidak ada
        eksekusi latar belakang saat aplikasi tertutup. Perubahan jadwal hanya berlaku untuk
        transaksi berikutnya.
      </p>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Batal
        </Button>
        <Button type="submit" loading={saving}>
          <Save className="h-4 w-4" />
          {rule ? 'Simpan perubahan' : 'Simpan aturan'}
        </Button>
      </div>
    </form>
  )
}
