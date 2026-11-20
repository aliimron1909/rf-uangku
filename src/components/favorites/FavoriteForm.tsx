import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Save } from 'lucide-react'
import type { Favorite, TxType } from '../../types'
import { useAccounts, useAllAccounts } from '../../hooks/useAccounts'
import { useAllCategories, useCategories } from '../../hooks/useCategories'
import { createFavorite, updateFavorite } from '../../db/favorites'
import { FAVORITE_NAME_MAX_LENGTH } from '../../lib/favorites'
import { formatNumberInput, parseNumberInput } from '../../lib/format'
import { cn, errorMessage } from '../../lib/utils'
import { Button } from '../ui/Button'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { categoryLabel, selectableCategories } from '../../lib/categoryTree'

interface FavoriteFormProps {
  favorite?: Favorite | null
  onSaved: () => void
  onCancel: () => void
}

interface FormErrors {
  name?: string
  amount?: string
  accountId?: string
  categoryId?: string
  form?: string
}

export function FavoriteForm({ favorite, onSaved, onCancel }: FavoriteFormProps) {
  const accounts = useAccounts()
  const allAccounts = useAllAccounts()
  const categories = useCategories()
  const allCategories = useAllCategories()

  const [name, setName] = useState(favorite?.name ?? '')
  const [type, setType] = useState<TxType>(favorite?.type ?? 'expense')
  const [amountInput, setAmountInput] = useState(
    favorite ? formatNumberInput(String(favorite.amount)) : '',
  )
  const [accountId, setAccountId] = useState(favorite?.accountId ?? '')
  const [categoryId, setCategoryId] = useState(favorite?.categoryId ?? '')
  const [note, setNote] = useState(favorite?.note ?? '')
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  const accountOptions = useMemo(() => {
    if (!accountId || accounts.some((account) => account.id === accountId)) return accounts
    const selected = allAccounts.find((account) => account.id === accountId)
    return selected ? [...accounts, selected] : accounts
  }, [accounts, allAccounts, accountId])

  const categoryOptions = useMemo(() => {
    const active = selectableCategories(categories).filter((category) => category.type === type)
    if (!categoryId || active.some((category) => category.id === categoryId)) return active
    const selected = allCategories.find(
      (category) => category.id === categoryId && category.type === type,
    )
    return selected ? [...active, selected] : active
  }, [categories, allCategories, categoryId, type])

  useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id)
  }, [accounts, accountId])

  useEffect(() => {
    if (categoryId && categoryOptions.some((category) => category.id === categoryId)) return
    setCategoryId(categoryOptions[0]?.id ?? '')
  }, [categoryOptions, categoryId])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amount = parseNumberInput(amountInput)
    const nextErrors: FormErrors = {}
    if (!name.trim()) nextErrors.name = 'Nama favorit wajib diisi.'
    if (!amount || amount <= 0) nextErrors.amount = 'Nominal harus lebih dari 0.'
    if (!accountId) nextErrors.accountId = 'Pilih rekening.'
    if (!categoryId) nextErrors.categoryId = 'Pilih kategori.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    try {
      const input = { name, type, amount, accountId, categoryId, note }
      if (favorite) await updateFavorite(favorite.id, input)
      else await createFavorite(input)
      onSaved()
    } catch (caught) {
      setErrors({ form: errorMessage(caught) })
    } finally {
      setSaving(false)
    }
  }

  const typeButtons: { value: TxType; label: string; active: string; Icon: typeof ArrowUpRight }[] = [
    {
      value: 'expense',
      label: 'Pengeluaran',
      active:
        'border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-500/20 dark:bg-rose-950/50 dark:text-rose-300',
      Icon: ArrowUpRight,
    },
    {
      value: 'income',
      label: 'Pemasukan',
      active:
        'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20 dark:bg-emerald-950/50 dark:text-emerald-300',
      Icon: ArrowDownLeft,
    },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Nama favorit"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Contoh: Kopi pagi, Bensin"
        maxLength={FAVORITE_NAME_MAX_LENGTH}
        error={errors.name}
        autoFocus={!favorite}
      />

      <div className="grid grid-cols-2 gap-2">
        {typeButtons.map(({ value, label, active, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setType(value)}
            aria-pressed={type === value}
            className={cn(
              'flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition',
              type === value
                ? active
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <CurrencyInput value={amountInput} onChange={setAmountInput} error={errors.amount} />

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
              {categoryLabel(category, allCategories)}
              {category.archived ? ' (arsip)' : ''}
            </option>
          ))}
        </Select>
      </div>

      <Input
        label="Catatan (opsional)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Dipakai sebagai catatan transaksi"
        maxLength={160}
      />

      {errors.form && <p className="text-sm text-rose-600 dark:text-rose-400">{errors.form}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Batal
        </Button>
        <Button type="submit" loading={saving}>
          <Save className="h-4 w-4" />
          {favorite ? 'Simpan perubahan' : 'Simpan favorit'}
        </Button>
      </div>
    </form>
  )
}
