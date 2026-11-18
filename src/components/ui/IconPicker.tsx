import { ICON_KEYS, ICON_REGISTRY } from '../../lib/icons'
import { cn } from '../../lib/utils'

interface IconPickerProps {
  label: string
  value: string
  color: string
  onChange: (key: string) => void
}

export function IconPicker({ label, value, color, onChange }: IconPickerProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
      <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-8">
        {ICON_KEYS.map((key) => {
          const Icon = ICON_REGISTRY[key]
          const selected = value === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              aria-label={`Ikon ${key}`}
              aria-pressed={selected}
              className={cn(
                'flex h-9 w-full items-center justify-center rounded-lg border transition',
                selected
                  ? 'border-transparent text-white shadow-sm'
                  : 'border-slate-200 bg-white/60 backdrop-blur-md text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-white/[0.06] dark:text-slate-400 dark:hover:bg-slate-800',
              )}
              style={selected ? { backgroundColor: color } : undefined}
            >
              <Icon className="h-4 w-4" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
