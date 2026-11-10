import { useId } from 'react'
import { cn } from '../../lib/utils'
import { formatNumberInput } from '../../lib/format'

interface CurrencyInputProps {
  label?: string
  value: string
  onChange: (value: string) => void
  error?: string
  autoFocus?: boolean
}

export function CurrencyInput({
  label = 'Nominal',
  value,
  onChange,
  error,
  autoFocus,
}: CurrencyInputProps) {
  const generatedId = useId()
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={generatedId}
        className="block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      <div className="relative">
        <span className="absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-slate-500 dark:text-slate-400">
          Rp
        </span>
        <input
          id={generatedId}
          inputMode="numeric"
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => onChange(formatNumberInput(event.target.value))}
          placeholder="0"
          className={cn(
            'h-14 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-2xl font-bold tracking-tight text-slate-900 shadow-sm outline-none transition placeholder:text-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600',
            error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20',
          )}
        />
      </div>
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  )
}
