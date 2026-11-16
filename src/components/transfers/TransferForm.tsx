import { useEffect, useMemo, useState } from 'react'
import { ArrowDownUp, Save } from 'lucide-react'
import type { Transfer } from '../../types'
import { useAccounts, useAllAccounts } from '../../hooks/useAccounts'
import { createTransfer, updateTransfer } from '../../db/transfers'
import { todayISO } from '../../lib/dates'
import { formatNumberInput, parseNumberInput } from '../../lib/format'
import { errorMessage } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../ui/Button'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'

export interface TransferInitial {
  fromAccountId: string
  toAccountId: string
  amount: number
  occurredAt: string
  note: string
}

interface TransferFormProps {
  transfer?: Transfer | null
  /** Nilai awal untuk transfer baru (mis. dari AI atau form transaksi). */
  initial?: TransferInitial | null
  onSaved: () => void
  onCancel: () => void
}

interface FormErrors {
  amount?: string
  fromAccountId?: string
  toAccountId?: string
  occurredAt?: string
}

export function TransferForm({ transfer, initial, onSaved, onCancel }: TransferFormProps) {
  const accounts = useAccounts()
  const allAccounts = useAllAccounts()
  const { toast } = useToast()

  const [fromAccountId, setFromAccountId] = useState(transfer?.fromAccountId ?? initial?.fromAccountId ?? '')
  const [toAccountId, setToAccountId] = useState(transfer?.toAccountId ?? initial?.toAccountId ?? '')
  const [amountInput, setAmountInput] = useState(
    transfer
      ? formatNumberInput(String(transfer.amount))
      : initial && initial.amount > 0
        ? formatNumberInput(String(initial.amount))
        : '',
  )
  const [occurredAt, setOccurredAt] = useState(transfer?.occurredAt ?? initial?.occurredAt ?? todayISO())
  const [note, setNote] = useState(transfer?.note ?? initial?.note ?? '')
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  // Keep archived accounts visible when editing an older transfer.
  const accountOptions = useMemo(() => {
    const selectedIds = [fromAccountId, toAccountId].filter(Boolean)
    const extra = allAccounts.filter(
      (account) => selectedIds.includes(account.id) && !accounts.some((a) => a.id === account.id),
    )
    return [...accounts, ...extra]
  }, [accounts, allAccounts, fromAccountId, toAccountId])

  useEffect(() => {
    if (transfer || accounts.length < 2) return
    const from = fromAccountId || accounts[0].id
    if (!fromAccountId) setFromAccountId(from)
    if (!toAccountId) setToAccountId(accounts.find((account) => account.id !== from)?.id ?? '')
  }, [accounts, fromAccountId, toAccountId, transfer])

  function swapAccounts() {
    setFromAccountId(toAccountId)
    setToAccountId(fromAccountId)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amount = parseNumberInput(amountInput)
    const nextErrors: FormErrors = {}

    if (!amount || amount <= 0) nextErrors.amount = 'Nominal harus lebih dari 0.'
    if (!fromAccountId) nextErrors.fromAccountId = 'Pilih rekening asal.'
    if (!toAccountId) nextErrors.toAccountId = 'Pilih rekening tujuan.'
    if (fromAccountId && toAccountId && fromAccountId === toAccountId) {
      nextErrors.toAccountId = 'Rekening tujuan harus berbeda dari rekening asal.'
    }
    if (!occurredAt) nextErrors.occurredAt = 'Pilih tanggal.'

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    try {
      const input = { fromAccountId, toAccountId, amount, occurredAt, note: note.trim() }
      if (transfer) {
        await updateTransfer(transfer.id, input)
        toast('Transfer berhasil diperbarui.')
      } else {
        await createTransfer(input)
        toast('Transfer berhasil disimpan.')
      }
      onSaved()
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!transfer && accounts.length < 2) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Transfer butuh minimal dua rekening aktif. Tambahkan rekening di Pengaturan → Rekening
          & Kategori.
        </p>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onCancel}>
            Tutup
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <CurrencyInput
        value={amountInput}
        onChange={setAmountInput}
        error={errors.amount}
        autoFocus={!transfer}
      />

      <div className="space-y-2">
        <Select
          label="Dari rekening"
          value={fromAccountId}
          onChange={(event) => setFromAccountId(event.target.value)}
          error={errors.fromAccountId}
        >
          <option value="">Pilih rekening asal</option>
          {accountOptions.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
              {account.archived ? ' (arsip)' : ''}
            </option>
          ))}
        </Select>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={swapAccounts}
            aria-label="Tukar rekening asal dan tujuan"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowDownUp className="h-4 w-4" />
          </button>
        </div>
        <Select
          label="Ke rekening"
          value={toAccountId}
          onChange={(event) => setToAccountId(event.target.value)}
          error={errors.toAccountId}
        >
          <option value="">Pilih rekening tujuan</option>
          {accountOptions.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
              {account.archived ? ' (arsip)' : ''}
            </option>
          ))}
        </Select>
      </div>

      <Input
        label="Tanggal"
        type="date"
        value={occurredAt}
        onChange={(event) => setOccurredAt(event.target.value)}
        error={errors.occurredAt}
        max="2100-12-31"
      />

      <Textarea
        label="Catatan (opsional)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Contoh: isi saldo Gopay"
        maxLength={160}
        className="min-h-20"
      />

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Transfer hanya memindahkan saldo antar rekening. Tidak dihitung sebagai pemasukan atau
        pengeluaran.
      </p>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Batal
        </Button>
        <Button type="submit" loading={saving}>
          <Save className="h-4 w-4" />
          {transfer ? 'Simpan perubahan' : 'Simpan transfer'}
        </Button>
      </div>
    </form>
  )
}
