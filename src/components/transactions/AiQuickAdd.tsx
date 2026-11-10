import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Wand2 } from 'lucide-react'
import type { Account, Category, TxType } from '../../types'
import { useSetting } from '../../hooks/useSetting'
import { DEFAULT_GROQ_MODEL } from '../../lib/constants'
import { parseTransactionWithGroq, resolveAiDraft } from '../../lib/groq'
import { errorMessage } from '../../lib/utils'
import { Button } from '../ui/Button'

interface AiQuickAddProps {
  accounts: Account[]
  categories: Category[]
  onApply: (draft: {
    type: TxType
    amount: number
    accountId: string
    categoryId: string
    occurredAt: string
    note: string
  }) => void
}

const examples = ['Makan siang 25rb pakai Gopay', 'Gaji 5jt masuk BCA', 'Bensin 50rb Tunai']

export function AiQuickAdd({ accounts, categories, onApply }: AiQuickAddProps) {
  const apiKey = useSetting<string>('groqKey', '')
  const model = useSetting<string>('groqModel', DEFAULT_GROQ_MODEL)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (!apiKey) {
    return (
      <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
        <div className="flex items-start gap-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="text-xs leading-relaxed text-emerald-900 dark:text-emerald-200">
            <p className="font-semibold">Isi cepat dengan AI</p>
            <p className="mt-0.5 text-emerald-800/80 dark:text-emerald-300/80">
              Tempel API key Groq di{' '}
              <Link to="/settings" className="font-bold underline underline-offset-2">
                Pengaturan
              </Link>{' '}
              untuk menulis transaksi dengan bahasa sehari-hari.
            </p>
          </div>
        </div>
      </div>
    )
  }

  async function handleParse() {
    setError('')
    setSuccess('')
    if (!text.trim()) {
      setError('Tulis dulu transaksinya.')
      return
    }
    setLoading(true)
    try {
      const draft = await parseTransactionWithGroq(text, {
        apiKey,
        model,
        categories,
        accounts,
      })
      const resolved = resolveAiDraft(draft, accounts, categories)
      if (!resolved) {
        throw new Error('Master rekening atau kategori belum tersedia.')
      }

      onApply({
        ...resolved,
        note: draft.note || text.trim(),
      })
      setSuccess('Draft diterapkan. Periksa lagi sebelum menyimpan.')
      setText('')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
            Isi cepat dengan AI
          </p>
          <p className="text-[11px] text-emerald-800/70 dark:text-emerald-300/70">
            Tulis bebas, AI mengisi form. Tetap periksa sebelum simpan.
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void handleParse()
            }
          }}
          placeholder="Contoh: makan siang 25rb pakai Gopay"
          aria-label="Deskripsi transaksi untuk AI"
          className="h-10 flex-1 rounded-xl border border-emerald-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-emerald-900 dark:bg-slate-950 dark:text-slate-100"
        />
        <Button
          type="button"
          size="sm"
          onClick={() => void handleParse()}
          loading={loading}
          className="shrink-0"
        >
          <Wand2 className="h-4 w-4" />
          Isi form
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setText(example)}
            className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-50 dark:bg-slate-900 dark:text-emerald-300 dark:ring-emerald-900"
          >
            {example}
          </button>
        ))}
      </div>

      {error && <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}
      {success && (
        <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">{success}</p>
      )}
    </div>
  )
}
