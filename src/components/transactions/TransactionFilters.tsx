import { Search, X } from 'lucide-react'
import type { Account, Category, ReportType } from '../../types'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'

export interface TransactionFilterState {
  search: string
  type: ReportType
  accountId: string
  categoryId: string
  dateFrom: string
  dateTo: string
}

interface TransactionFiltersProps {
  filters: TransactionFilterState
  onChange: (filters: TransactionFilterState) => void
  accounts: Account[]
  categories: Category[]
}

export function TransactionFilters({
  filters,
  onChange,
  accounts,
  categories,
}: TransactionFiltersProps) {
  const visibleCategories =
    filters.type === 'all'
      ? categories
      : categories.filter((category) => category.type === filters.type)

  function update(patch: Partial<TransactionFilterState>) {
    onChange({ ...filters, ...patch })
  }

  function reset() {
    onChange({
      search: '',
      type: 'all',
      accountId: 'all',
      categoryId: 'all',
      dateFrom: '',
      dateTo: '',
    })
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <Input
            label="Cari"
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
            placeholder="Catatan, kategori, rekening..."
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <Select
          label="Jenis"
          value={filters.type}
          onChange={(event) =>
            update({
              type: event.target.value as ReportType,
              categoryId: 'all',
            })
          }
        >
          <option value="all">Semua</option>
          <option value="income">Pemasukan</option>
          <option value="expense">Pengeluaran</option>
        </Select>
        <Select
          label="Rekening"
          value={filters.accountId}
          onChange={(event) => update({ accountId: event.target.value })}
        >
          <option value="all">Semua rekening</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
              {account.archived ? ' (arsip)' : ''}
            </option>
          ))}
        </Select>
        <Select
          label="Kategori"
          value={filters.categoryId}
          onChange={(event) => update({ categoryId: event.target.value })}
        >
          <option value="all">Semua kategori</option>
          {visibleCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
              {category.archived ? ' (arsip)' : ''}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Dari"
            type="date"
            value={filters.dateFrom}
            onChange={(event) => update({ dateFrom: event.target.value })}
          />
          <Input
            label="Sampai"
            type="date"
            value={filters.dateTo}
            onChange={(event) => update({ dateTo: event.target.value })}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          Filter tanggal memakai format tanggal transaksi.
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          <X className="h-3.5 w-3.5" />
          Reset filter
        </Button>
      </div>
    </div>
  )
}
