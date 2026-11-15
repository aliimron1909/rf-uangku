import { useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import type { Account } from '../../types'
import { useAccounts, useAllAccounts } from '../../hooks/useAccounts'
import { todayISO } from '../../lib/dates'
import { formatNumberInput, formatRupiah, parseNumberInput } from '../../lib/format'
import { errorMessage } from '../../lib/utils'
import { Button } from '../ui/Button'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'

export interface AmountEntryValues {
  amount: number
  occurredAt: string
  note: string
  /** Rekening terpilih; kosong = tidak dicatat ke rekening. */
  accountId: string
}

interface AmountEntryFormProps {
  amountLabel?: string
  submitLabel: string
  /** Batas atas nominal; menampilkan tombol "Isi semua". */
  maxAmount?: number
  maxLabel?: string
  notePlaceholder?: string
  /** Tampilkan pilihan rekening (opsional) dengan label ini. */
  accountLabel?: string
  accountHint?: string
  defaultAccountId?: string
  onSubmit: (values: AmountEntryValues) => Promise<void>
  onCancel: () => void
}

/** Form singkat: nominal + tanggal + catatan (setoran tabungan, pembayaran hutang). */
export function AmountEntryForm({
  amountLabel = 'Nominal',
  submitLabel,
  maxAmount,
  maxLabel = 'Maksimal',
  notePlaceholder,
  accountLabel,
  accountHint,
  defaultAccountId = '',
  onSubmit,
  onCancel,
}: AmountEntryFormProps) {
  const activeAccounts = useAccounts()
  const allAccounts = useAllAccounts()
  const [accountId, setAccountId] = useState(defaultAccountId)
  const accountOptions = useMemo<Account[]>(() => {
    if (!accountId || activeAccounts.some((account) => account.id === accountId)) {
      return activeAccounts
    }
    const selected = allAccounts.find((account) => account.id === accountId)
    return selected ? [...activeAccounts, selected] : activeAccounts
  }, [activeAccounts, allAccounts, accountId])
  const [amountInput, setAmountInput] = useState('')
  const [occurredAt, setOccurredAt] = useState(todayISO())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const amount = parseNumberInput(amountInput)
    if (!amount || amount <= 0) {
      setError('Nominal harus lebih dari 0.')
      return
    }
    if (maxAmount !== undefined && amount > maxAmount) {
      setError(`${maxLabel}: ${formatRupiah(maxAmount)}.`)
      return
    }
    if (!occurredAt) {
      setError('Pilih tanggal.')
      return
    }

    setSaving(true)
    try {
      await onSubmit({ amount, occurredAt, note: note.trim(), accountId })
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <CurrencyInput
        label={amountLabel}
        value={amountInput}
        onChange={setAmountInput}
        error={error}
        autoFocus
      />
      {maxAmount !== undefined && maxAmount > 0 && (
        <button
          type="button"
          onClick={() => setAmountInput(formatNumberInput(String(maxAmount)))}
          className="-mt-2 text-xs font-semibold text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400"
        >
          Isi semua ({formatRupiah(maxAmount)})
        </button>
      )}
      {accountLabel && (
        <Select
          label={accountLabel}
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
        >
          <option value="">Tidak dicatat ke rekening</option>
          {accountOptions.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
              {account.archived ? ' (arsip)' : ''}
            </option>
          ))}
        </Select>
      )}
      {accountLabel && accountHint && (
        <p className="-mt-2 text-[11px] text-slate-500 dark:text-slate-400">{accountHint}</p>
      )}
      <Input
        label="Tanggal"
        type="date"
        value={occurredAt}
        onChange={(event) => setOccurredAt(event.target.value)}
        max="2100-12-31"
      />
      <Input
        label="Catatan (opsional)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={notePlaceholder}
        maxLength={120}
      />
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Batal
        </Button>
        <Button type="submit" loading={saving}>
          <Save className="h-4 w-4" />
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
