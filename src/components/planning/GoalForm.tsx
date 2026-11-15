import { useState } from 'react'
import { Save } from 'lucide-react'
import type { Goal } from '../../types'
import { createGoal, GOAL_NAME_MAX_LENGTH, updateGoal } from '../../db/goals'
import { GOAL_COLORS } from '../../lib/constants'
import { formatNumberInput, parseNumberInput } from '../../lib/format'
import { cn, errorMessage } from '../../lib/utils'
import { Button } from '../ui/Button'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Input } from '../ui/Input'

interface GoalFormProps {
  goal?: Goal | null
  onSaved: () => void
  onCancel: () => void
}

interface FormErrors {
  name?: string
  amount?: string
  form?: string
}

export function GoalForm({ goal, onSaved, onCancel }: GoalFormProps) {
  const [name, setName] = useState(goal?.name ?? '')
  const [amountInput, setAmountInput] = useState(
    goal ? formatNumberInput(String(goal.targetAmount)) : '',
  )
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')
  const [color, setColor] = useState(goal?.color ?? GOAL_COLORS[0])
  const [note, setNote] = useState(goal?.note ?? '')
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const targetAmount = parseNumberInput(amountInput)
    const nextErrors: FormErrors = {}
    if (!name.trim()) nextErrors.name = 'Nama target wajib diisi.'
    if (!targetAmount || targetAmount <= 0) nextErrors.amount = 'Nominal target harus lebih dari 0.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    try {
      const input = { name, targetAmount, deadline: deadline || undefined, color, note }
      if (goal) await updateGoal(goal.id, input)
      else await createGoal(input)
      onSaved()
    } catch (caught) {
      setErrors({ form: errorMessage(caught) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Nama target"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Contoh: Laptop baru, Dana darurat"
        maxLength={GOAL_NAME_MAX_LENGTH}
        error={errors.name}
        autoFocus={!goal}
      />
      <CurrencyInput
        label="Target dana"
        value={amountInput}
        onChange={setAmountInput}
        error={errors.amount}
      />
      <Input
        label="Tenggat (opsional)"
        type="date"
        value={deadline}
        onChange={(event) => setDeadline(event.target.value)}
        max="2100-12-31"
        hint="Dipakai untuk menghitung setoran per bulan yang disarankan."
      />

      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Warna</p>
        <div className="flex flex-wrap gap-2">
          {GOAL_COLORS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setColor(item)}
              aria-label={`Warna ${item}`}
              aria-pressed={color === item}
              className={cn(
                'h-8 w-8 rounded-full ring-offset-2 transition dark:ring-offset-slate-900',
                color === item ? 'ring-2 ring-slate-400' : 'hover:scale-110',
              )}
              style={{ backgroundColor: item }}
            />
          ))}
        </div>
      </div>

      <Input
        label="Catatan (opsional)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={120}
      />

      <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
        Target tabungan hanya <span className="font-semibold">mencatat progres</span>. Saldo
        rekening tidak berubah saat kamu menambah atau mengambil dana target.
      </p>

      {errors.form && <p className="text-sm text-rose-600 dark:text-rose-400">{errors.form}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Batal
        </Button>
        <Button type="submit" loading={saving}>
          <Save className="h-4 w-4" />
          {goal ? 'Simpan perubahan' : 'Simpan target'}
        </Button>
      </div>
    </form>
  )
}
