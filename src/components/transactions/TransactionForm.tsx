import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Save } from 'lucide-react'
import type { Transaction, TxType } from '../../types'
import { useAccounts, useAllAccounts } from '../../hooks/useAccounts'
import { useCategories, useAllCategories } from '../../hooks/useCategories'
import { saveTransaction } from '../../db/transactions'
import { useTransactions } from '../../hooks/useTransactions'
import { collectTags } from '../../lib/tags'
import { splitIssue, splitMembers } from '../../lib/split'
import { createFavorite } from '../../db/favorites'
import { FAVORITE_NAME_MAX_LENGTH, suggestFavoriteName } from '../../lib/favorites'
import { todayISO } from '../../lib/dates'
import { formatNumberInput, parseNumberInput } from '../../lib/format'
import type { ResolvedAiDraft, ResolvedAiTransfer } from '../../lib/groq'
import { createId, errorMessage } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../ui/Button'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { TransferForm, type TransferInitial } from '../transfers/TransferForm'
import { AiQuickAdd } from './AiQuickAdd'
import { ReceiptField } from './ReceiptField'
import { SplitEditor, type SplitPartDraft } from './SplitEditor'
import { TagInput } from './TagInput'

interface TransactionFormProps {
  transaction?: Transaction | null
  initialDraft?: ResolvedAiDraft | null
  /** Hasil AI berupa transfer: form langsung dibuka pada mode Transfer. */
  initialTransfer?: ResolvedAiTransfer | null
  onSaved: () => void
  onCancel: () => void
}

interface FormErrors {
  amount?: string
  accountId?: string
  categoryId?: string
  occurredAt?: string
  split?: string
}

export function TransactionForm({
  transaction,
  initialDraft,
  initialTransfer,
  onSaved,
  onCancel,
}: TransactionFormProps) {
  const accounts = useAccounts()
  const allAccounts = useAllAccounts()
  const categories = useCategories()
  const allCategories = useAllCategories()
  const { toast } = useToast()
  const allTransactions = useTransactions()
  const initialMembers = transaction ? splitMembers(transaction, allTransactions) : []
  const initialTotal = initialMembers.reduce((sum, item) => sum + item.amount, 0)

  const [type, setType] = useState<TxType>(
    transaction?.type ?? initialDraft?.type ?? 'expense',
  )
  const [isTransfer, setIsTransfer] = useState(Boolean(initialTransfer) && !transaction)
  const [transferInitial, setTransferInitial] = useState<TransferInitial | null>(
    initialTransfer ?? null,
  )
  const [transferNonce, setTransferNonce] = useState(0)
  const [amountInput, setAmountInput] = useState(
    transaction
      ? formatNumberInput(String(initialTotal || transaction.amount))
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
  const [tags, setTags] = useState<string[]>(transaction?.tags ?? [])
  const [receiptId, setReceiptId] = useState<string | undefined>(transaction?.receiptId)
  const [newReceipt, setNewReceipt] = useState<string | undefined>(undefined)
  const [splitMode, setSplitMode] = useState(initialMembers.length > 1)
  const [parts, setParts] = useState<SplitPartDraft[]>(
    initialMembers.length > 1
      ? initialMembers.map((member) => ({
          key: createId(),
          categoryId: member.categoryId,
          amountInput: formatNumberInput(String(member.amount)),
        }))
      : [],
  )
  const [saveAsFavorite, setSaveAsFavorite] = useState(false)
  const [favoriteName, setFavoriteName] = useState('')

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

  const partCategories = useMemo(() => {
    const used = new Set(parts.map((part) => part.categoryId).filter(Boolean))
    const extra = allCategories.filter(
      (category) =>
        category.type === type &&
        used.has(category.id) &&
        !availableCategories.some((item) => item.id === category.id),
    )
    return [...availableCategories, ...extra]
  }, [availableCategories, allCategories, parts, type])

  function toggleSplit(enabled: boolean) {
    setSplitMode(enabled)
    if (enabled && parts.length < 2) {
      setParts([
        { key: createId(), categoryId: categoryId, amountInput: amountInput },
        { key: createId(), categoryId: '', amountInput: '' },
      ])
    }
    setErrors((current) => ({ ...current, split: undefined }))
  }

  useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id)
  }, [accounts, accountId])

  useEffect(() => {
    if (!categoryId && availableCategories.length > 0) {
      setCategoryId(availableCategories[0].id)
    }
  }, [availableCategories, categoryId])

  function openTransfer() {
    // Bawa nominal, tanggal, dan catatan yang sudah diisi ke form transfer.
    setTransferInitial({
      fromAccountId: accountId,
      toAccountId: '',
      amount: parseNumberInput(amountInput),
      occurredAt: occurredAt || todayISO(),
      note,
    })
    setTransferNonce((value) => value + 1)
    setIsTransfer(true)
  }

  function applyAiTransfer(transfer: ResolvedAiTransfer) {
    setTransferInitial(transfer)
    setTransferNonce((value) => value + 1)
    setIsTransfer(true)
  }

  function changeType(nextType: TxType) {
    if (isTransfer) setIsTransfer(false)
    if (nextType === type) return
    setType(nextType)
    if (splitMode) setParts((current) => current.map((part) => ({ ...part, categoryId: '' })))
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
    setIsTransfer(false)
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
    if (!categoryId && !splitMode) nextErrors.categoryId = 'Pilih kategori.'
    const splitParts = splitMode
      ? parts.map((part) => ({
          categoryId: part.categoryId,
          amount: parseNumberInput(part.amountInput),
        }))
      : undefined
    if (splitParts && amount > 0) {
      const issue = splitIssue(amount, splitParts)
      if (issue) nextErrors.split = issue
    }
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
        categoryId: splitParts ? splitParts[0].categoryId : categoryId,
        occurredAt,
        note: note.trim(),
        tags,
        receiptId,
        newReceiptDataUrl: newReceipt,
        parts: splitParts,
      }
      await saveTransaction(transaction ?? null, input)
      toast(transaction ? 'Transaksi berhasil diperbarui.' : 'Transaksi berhasil disimpan.')
      if (saveAsFavorite && !splitParts) {
        try {
          const categoryName = allCategories.find((item) => item.id === categoryId)?.name ?? ''
          await createFavorite({
            name: favoriteName.trim() || suggestFavoriteName(note, categoryName),
            type,
            amount,
            accountId,
            categoryId,
            note: note.trim(),
          })
          toast('Disimpan juga sebagai favorit.')
        } catch (caught) {
          toast(`Transaksi tersimpan, tetapi favorit gagal dibuat: ${errorMessage(caught)}`, 'error')
        }
      }
      onSaved()
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setSaving(false)
    }
  }

  const topSection = (
    <>
      {!transaction && (
        <AiQuickAdd
          accounts={accounts}
          categories={categories}
          onApply={applyAiDraft}
          onApplyTransfer={applyAiTransfer}
        />
      )}

      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
          Jenis transaksi
        </p>
        <div className={transaction ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-3 gap-2'}>
          {!transaction && (
            <button
              type="button"
              onClick={openTransfer}
              className={`flex h-11 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold transition ${
                isTransfer
                  ? 'border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-500/20 dark:border-sky-500 dark:bg-sky-950/50 dark:text-sky-300'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <ArrowLeftRight className="h-4 w-4" />
              Transfer
            </button>
          )}
          <button
            type="button"
            onClick={() => changeType('income')}
            className={`flex h-11 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold transition ${
              !isTransfer && type === 'income'
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
            className={`flex h-11 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold transition ${
              !isTransfer && type === 'expense'
                ? 'border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-500/20 dark:border-rose-500 dark:bg-rose-950/50 dark:text-rose-300'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <ArrowUpRight className="h-4 w-4" />
            Pengeluaran
          </button>
        </div>
      </div>
    </>
  )

  if (isTransfer && !transaction) {
    return (
      <div className="space-y-4">
        {topSection}
        <TransferForm
          key={transferNonce}
          initial={transferInitial}
          onSaved={onSaved}
          onCancel={onCancel}
        />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {topSection}

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
        {!splitMode && (
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
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={splitMode}
          onChange={(event) => toggleSplit(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        Pecah ke beberapa kategori (satu struk)
      </label>
      {splitMode && (
        <SplitEditor
          total={parseNumberInput(amountInput)}
          parts={parts}
          categories={partCategories}
          onChange={setParts}
          error={errors.split}
        />
      )}

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

      <TagInput value={tags} onChange={setTags} suggestions={collectTags(allTransactions)} />

      <ReceiptField
        receiptId={receiptId}
        newDataUrl={newReceipt}
        onChange={(next) => {
          setReceiptId(next.receiptId)
          setNewReceipt(next.newDataUrl)
        }}
      />

      {!splitMode && (
      <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={saveAsFavorite}
            onChange={(event) => setSaveAsFavorite(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          Simpan juga sebagai favorit
        </label>
        {saveAsFavorite && (
          <div className="mt-2.5">
            <Input
              label="Nama favorit"
              value={favoriteName}
              onChange={(event) => setFavoriteName(event.target.value)}
              placeholder={suggestFavoriteName(
                note,
                allCategories.find((item) => item.id === categoryId)?.name ?? 'Favorit',
              )}
              maxLength={FAVORITE_NAME_MAX_LENGTH}
            />
          </div>
        )}
      </div>
      )}

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
