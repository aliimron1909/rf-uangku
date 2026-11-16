import { useId, useState } from 'react'
import { X } from 'lucide-react'
import {
  TAGS_MAX_PER_TRANSACTION,
  TAG_MAX_LENGTH,
  normalizeTags,
  parseTagInput,
  type TagCount,
} from '../../lib/tags'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions: TagCount[]
}

export function TagInput({ value, onChange, suggestions }: TagInputProps) {
  const listId = useId()
  const [draft, setDraft] = useState('')

  function commit(text: string) {
    const parsed = parseTagInput(text)
    if (parsed.length > 0) onChange(normalizeTags([...value, ...parsed]))
    setDraft('')
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commit(draft)
    } else if (event.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const available = suggestions.filter((item) => !value.includes(item.tag)).slice(0, 6)
  const full = value.length >= TAGS_MAX_PER_TRANSACTION

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={listId}
        className="block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        Tag (opsional)
      </label>
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
          >
            #{tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((item) => item !== tag))}
              aria-label={`Hapus tag ${tag}`}
              className="rounded p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-900"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={listId}
          value={draft}
          disabled={full}
          maxLength={TAG_MAX_LENGTH + 4}
          onChange={(event) => {
            const next = event.target.value
            if (next.includes(',')) commit(next)
            else setDraft(next)
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => commit(draft)}
          placeholder={full ? 'Batas tag tercapai' : value.length === 0 ? 'liburan, kantor...' : ''}
          className="min-w-[7rem] flex-1 bg-transparent py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
        />
      </div>
      {available.length > 0 && !full && (
        <div className="flex flex-wrap gap-1.5">
          {available.map((item) => (
            <button
              key={item.tag}
              type="button"
              onClick={() => onChange(normalizeTags([...value, item.tag]))}
              className="rounded-lg border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-400"
            >
              #{item.tag}
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Pisahkan dengan koma atau Enter. Maksimal {TAGS_MAX_PER_TRANSACTION} tag.
      </p>
    </div>
  )
}
