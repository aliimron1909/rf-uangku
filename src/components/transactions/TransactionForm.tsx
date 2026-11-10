import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Save } from 'lucide-react'
import type { Transaction, TxType } from '../../types'
import { useAccounts, useAllAccounts } from '../../hooks/useAccounts'
import { useBudgets } from '../../hooks/useBudgets'
import { useCategories, useAllCategories } from '../../hooks/useCategories'
import { useTransactions } from '../../hooks/useTransactions'
import { createTransaction, updateTransaction } from '../../db/transactions'
import { newExpenseBudgetAlert } from '../../lib/budget'
import { todayISO } from '../../lib/dates'
import { formatNumberInput, parseNumberInput } from '../../lib/format'
import type { ResolvedAiDraft } from '../../lib/groq'
import { errorMessage } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../ui/Button'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { AiQuickAdd } from './AiQuickAdd'

interface TransactionFormProps {
  transaction?: Transaction | null
  initialDraft?: ResolvedAiDraft | null
  onSaved: () => void
  onCancel: () => void
}

interface FormErrors {
  amount?: string
  accountId?: string
  categoryId?: string
  occurredAt?: string
}

export function TransactionForm({
  transaction,
  initialDraft,
  onSaved,
  onCancel,
}: TransactionFormProps) {
  const accounts = useAccounts()
  const allAccounts = useAllAccounts()
  const categories = useCategories()
  const allCategories = useAllCategories()
  const budgets = useBudgets()
  const allTransactions = useTransactions()
  const { toast } = useToast()

  const [type, setType] = useState<TxType>(
    transaction?.type ?? initialDraft?.type ?? 'expense',
  )
  const [amountInput, setAmountInput] = useState(
    transaction
      ? formatNumberInput(String(transaction.amount))
      : initialDraft
        ? formatNumberInput(String(initialDraft.amount))
        : '',
  )
  const [accountId, setAccountId] = useState(
    transaction?.accountId ?? initialDraft?.accountId ?? '',
  )
  const [categoryId, setCategoryId] = useState(
    transaction?.categoryId ?? initialDraft?.categoryId ?? '',
  )
  const [occurredAt, setOccurredAt] = useState(
    transaction?.occurredAt ?? initialDraft?.occurredAt ?? todayISO(),
  )
  const [note, setNote] = useState(transaction?.note ?? initialDraft?.note ?? '')
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  const availableCategories = useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type],
  )

  // When editing an older transaction, its account/category may already be
  // archived. Keep that selected row visible instead of showing a blank select.
  const accountOptions = useMemo(() => {
    if (!accountId || accounts.some((account) => account.id === accountId)) return accounts
    const selected = allAccounts.find((account) => account.id === accountId)
    return selected ? [...accounts, selected] : accounts
  }, [accounts, allAccounts, accountId])

  const categoryOptions = useMemo(() => {
    if (!categoryId || availableCategories.some((category) => category.id === categoryId)) {
      return availableCategories
    }
    const selected = allCategories.find(
      (category) => category.id === categoryId && category.type === type,
    )
    return selected ? [...availableCategories, selected] : availableCategories
  }, [availableCategories, allCategories, categoryId, type])

  useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id)
  }, [accounts, accountId])

  useEffect(() => {
    if (!categoryId && availableCategories.length > 0) {
      setCategoryId(availableCategories[0].id)
    }
  }, [availableCategories, categoryId])

  function changeType(nextType: TxType) {
    if (nextType === type) return
    setType(nextType)
    const nextCategories = categories.filter((category) => category.type === nextType)
    if (!nextCategories.some((category) => category.id === categoryId)) {
      setCategoryId(nextCategories[0]?.id ?? '')
    }
  }

  function applyAiDraft(draft: {
    type: TxType
    amount: number
    accountId: string
    categoryId: string
    occurredAt: string
    note: string
  }) {
    setType(draft.type)
    setAmountInput(formatNumberInput(String(draft.amount)))
    setAccountId(draft.accountId)
    setCategoryId(draft.categoryId)
    setOccurredAt(draft.occurredAt)
    setNote(draft.note)
    setErrors({})
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amount = parseNumberInput(amountInput)
    const nextErrors: FormErrors = {}

    if (!amount || amount <= 0) nextErrors.amount = 'Nominal harus lebih dari 0.'
    if (!accountId) nextErrors.accountId = 'Pilih rekening.'
    if (!categoryId) nextErrors.categoryId = 'Pilih kategori.'
    if (!occurredAt) nextErrors.occurredAt = 'Pilih tanggal.'

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
        occurredAt,
        note: note.trim(),
      }
      if (transaction) {
        await updateTransaction(transaction.id, input)
        toast('Transaksi berhasil diperbarui.')
      } else {
        await createTransaction(input)
        toast('Transaksi berhasil disimpan.')
        const alert = newExpenseBudgetAlert(budgets, allTransactions, allCategories, input)
        if (alert) toast(alert.message, alert.type)
      }
      onSaved()
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!transaction && (
        <AiQuickAdd accounts={accounts} categories={categories} onApply={applyAiDraft} />
      )}

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
        autoFocus={!transaction}
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
        placeholder="Contoh: makan siang bersama keluarga"
        maxLength={160}
        className="min-h-20"
      />

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Batal
        </Button>
        <Button type="submit" loading={saving}>
          <Save className="h-4 w-4" />
          {transaction ? 'Simpan perubahan' : 'Simpan transaksi'}
        </Button>
      </div>
    </form>
  )
}
