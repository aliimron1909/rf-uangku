import { Plus, Trash2 } from 'lucide-react'
import type { Category } from '../../types'
import { SPLIT_MAX_PARTS } from '../../lib/split'
import { formatNumberInput, formatRupiah, parseNumberInput } from '../../lib/format'
import { cn, createId } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { categoryLabel } from '../../lib/categoryTree'

export interface SplitPartDraft {
  key: string
  categoryId: string
  amountInput: string
}

interface SplitEditorProps {
  total: number
  parts: SplitPartDraft[]
  categories: Category[]
  onChange: (parts: SplitPartDraft[]) => void
  error?: string
}

export function SplitEditor({ total, parts, categories, onChange, error }: SplitEditorProps) {
  const allocated = parts.reduce((sum, part) => sum + parseNumberInput(part.amountInput), 0)
  const remaining = total - allocated

  function update(key: string, patch: Partial<SplitPartDraft>) {
    onChange(parts.map((part) => (part.key === key ? { ...part, ...patch } : part)))
  }

  function addPart() {
    onChange([
      ...parts,
      {
        key: createId(),
        categoryId: '',
        amountInput: remaining > 0 ? formatNumberInput(String(remaining)) : '',
      },
    ])
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
        Pecah per kategori
      </p>
      {parts.map((part, index) => {
        const takenElsewhere = new Set(
          parts.filter((other) => other.key !== part.key).map((other) => other.categoryId),
        )
        return (
          <div key={part.key} className="grid grid-cols-[1fr_8.5rem_auto] items-end gap-2">
            <Select
              aria-label={`Kategori pecahan ${index + 1}`}
              value={part.categoryId}
              onChange={(event) => update(part.key, { categoryId: event.target.value })}
            >
              <option value="">Pilih kategori</option>
              {categories.map((category) => (
                <option
                  key={category.id}
                  value={category.id}
                  disabled={takenElsewhere.has(category.id)}
                >
                  {categoryLabel(category, categories)}
                  {category.archived ? ' (arsip)' : ''}
                </option>
              ))}
            </Select>
            <input
              inputMode="numeric"
              aria-label={`Nominal pecahan ${index + 1}`}
              value={part.amountInput}
              onChange={(event) =>
                update(part.key, { amountInput: formatNumberInput(event.target.value) })
              }
              placeholder="0"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-right text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="button"
              disabled={parts.length <= 2}
              onClick={() => onChange(parts.filter((other) => other.key !== part.key))}
              aria-label={`Hapus pecahan ${index + 1}`}
              className="h-11 rounded-xl px-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 dark:hover:bg-rose-950/50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )
      })}
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={parts.length >= SPLIT_MAX_PARTS}
          onClick={addPart}
        >
          <Plus className="h-4 w-4" />
          Tambah kategori
        </Button>
        <p
          className={cn(
            'text-xs font-semibold',
            remaining === 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-amber-600 dark:text-amber-400',
          )}
        >
          {remaining === 0
            ? 'Total pas'
            : remaining > 0
              ? `Sisa ${formatRupiah(remaining)}`
              : `Lebih ${formatRupiah(-remaining)}`}
        </p>
      </div>
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  )
}
