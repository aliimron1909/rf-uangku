import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Save } from 'lucide-react'
import type { Debt, DebtDirection } from '../../types'
import { createDebt, DEBT_PERSON_MAX_LENGTH, updateDebt } from '../../db/debts'
import { formatNumberInput, parseNumberInput } from '../../lib/format'
import { cn, errorMessage } from '../../lib/utils'
import { Button } from '../ui/Button'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Input } from '../ui/Input'

interface DebtFormProps {
  debt?: Debt | null
  defaultDirection?: DebtDirection
  onSaved: () => void
  onCancel: () => void
}

interface FormErrors {
  person?: string
  amount?: string
  form?: string
}

export function DebtForm({ debt, defaultDirection = 'owe', onSaved, onCancel }: DebtFormProps) {
  const [direction, setDirection] = useState<DebtDirection>(debt?.direction ?? defaultDirection)
  const [person, setPerson] = useState(debt?.person ?? '')
  const [amountInput, setAmountInput] = useState(
    debt ? formatNumberInput(String(debt.amount)) : '',
  )
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? '')
  const [note, setNote] = useState(debt?.note ?? '')
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amount = parseNumberInput(amountInput)
    const nextErrors: FormErrors = {}
    if (!person.trim()) nextErrors.person = 'Nama wajib diisi.'
    if (!amount || amount <= 0) nextErrors.amount = 'Nominal harus lebih dari 0.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    try {
      const input = { direction, person, amount, dueDate: dueDate || undefined, note }
      if (debt) await updateDebt(debt.id, input)
      else await createDebt(input)
      onSaved()
    } catch (caught) {
      setErrors({ form: errorMessage(caught) })
    } finally {
      setSaving(false)
    }
  }

  const options: { value: DebtDirection; label: string; hint: string; owe: boolean }[] = [
    { value: 'owe', label: 'Hutang saya', hint: 'Saya berhutang', owe: true },
    { value: 'lent', label: 'Piutang', hint: 'Orang berhutang ke saya', owe: false },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Jenis</p>
        <div className="grid grid-cols-2 gap-2">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setDirection(option.value)}
              aria-pressed={direction === option.value}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition',
                direction === option.value
                  ? option.owe
                    ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-500/20 dark:bg-rose-950/50'
                    : 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20 dark:bg-emerald-950/50'
                  : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800',
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {option.owe ? (
                  <ArrowUpRight className="h-4 w-4 text-rose-500" />
                ) : (
                  <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                )}
                {option.label}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {option.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Input
        label={direction === 'owe' ? 'Berhutang kepada' : 'Yang berhutang'}
        value={person}
        onChange={(event) => setPerson(event.target.value)}
        placeholder="Nama orang atau pihak"
        maxLength={DEBT_PERSON_MAX_LENGTH}
        error={errors.person}
        autoFocus={!debt}
      />
      <CurrencyInput
        label="Nominal"
        value={amountInput}
        onChange={setAmountInput}
        error={errors.amount}
      />
      <Input
        label="Jatuh tempo (opsional)"
        type="date"
        value={dueDate}
        onChange={(event) => setDueDate(event.target.value)}
        max="2100-12-31"
      />
      <Input
        label="Catatan (opsional)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={120}
      />

      <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
        Hutang dan piutang hanya <span className="font-semibold">dicatat sebagai pengingat</span>.
        Saldo rekening tidak berubah; catat transaksi atau transfer terpisah bila uangnya benar-benar
        bergerak.
      </p>

      {errors.form && <p className="text-sm text-rose-600 dark:text-rose-400">{errors.form}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Batal
        </Button>
        <Button type="submit" loading={saving}>
          <Save className="h-4 w-4" />
          {debt ? 'Simpan perubahan' : 'Simpan'}
        </Button>
      </div>
    </form>
  )
}
