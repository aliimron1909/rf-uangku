import { useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import type { Budget, Category } from '../../types'
import { upsertBudget } from '../../db/budgets'
import { formatNumberInput, parseNumberInput } from '../../lib/format'
import { errorMessage } from '../../lib/utils'
import { Button } from '../ui/Button'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Select } from '../ui/Select'

interface BudgetFormProps {
  budget?: Budget | null
  categories: Category[]
  budgets: Budget[]
  onSaved: () => void
  onCancel: () => void
}

export function BudgetForm({ budget, categories, budgets, onSaved, onCancel }: BudgetFormProps) {
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? '')
  const [amountInput, setAmountInput] = useState(
    budget ? formatNumberInput(String(budget.amount)) : '',
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const categoryOptions = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.type === 'expense' &&
          (category.id === budget?.categoryId ||
            (!category.archived && !budgets.some((item) => item.categoryId === category.id))),
      ),
    [budget?.categoryId, budgets, categories],
  )

  useEffect(() => {
    if (!categoryId && categoryOptions.length > 0) {
      setCategoryId(categoryOptions[0].id)
    }
  }, [categoryId, categoryOptions])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const amount = parseNumberInput(amountInput)
    if (!categoryId) {
      setError('Pilih kategori pengeluaran.')
      return
    }
    if (!amount || amount <= 0) {
      setError('Batas budget harus lebih dari 0.')
      return
    }

    setSaving(true)
    try {
      await upsertBudget({ categoryId, amount })
      onSaved()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="Kategori pengeluaran"
        value={categoryId}
        onChange={(event) => setCategoryId(event.target.value)}
        disabled={Boolean(budget)}
      >
        <option value="">Pilih kategori</option>
        {categoryOptions.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
            {category.archived ? ' (arsip)' : ''}
          </option>
        ))}
      </Select>

      <CurrencyInput
        label="Batas budget bulanan"
        value={amountInput}
        onChange={setAmountInput}
        error={error}
        autoFocus
      />

      <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
        Budget berlaku sebagai batas bulanan berulang. Mengubah nominal akan memengaruhi perhitungan
        semua bulan karena riwayat batas per bulan belum disimpan.
      </p>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Batal
        </Button>
        <Button type="submit" loading={saving}>
          <Save className="h-4 w-4" />
          Simpan budget
        </Button>
      </div>
    </form>
  )
}
