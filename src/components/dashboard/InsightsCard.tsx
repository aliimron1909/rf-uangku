import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Lightbulb, RefreshCw, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import type { Category, Transaction } from '../../types'
import { setSetting } from '../../db/db'
import { useSetting } from '../../hooks/useSetting'
import { summarizeInsightsWithGroq } from '../../lib/groq'
import { factsSignature, monthlyInsights, type InsightTone } from '../../lib/insights'
import { monthKey, todayISO } from '../../lib/dates'
import { DEFAULT_GROQ_MODEL } from '../../lib/constants'
import { cn, errorMessage } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../ui/Button'

interface InsightsCardProps {
  transactions: Transaction[]
  categories: Category[]
  monthLabel: string
}

interface CachedSummary {
  signature: string
  text: string
}

const SUMMARY_KEY = 'insightAiSummary'

const toneStyle: Record<InsightTone, string> = {
  up: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300',
  good: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
  info: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300',
  down: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
}

export function InsightsCard({ transactions, categories, monthLabel }: InsightsCardProps) {
  const { toast } = useToast()
  const apiKey = useSetting<string>('groqKey', '')
  const model = useSetting<string>('groqModel', DEFAULT_GROQ_MODEL)
  const cached = useSetting<CachedSummary | null>(SUMMARY_KEY, null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const result = useMemo(
    () => monthlyInsights(transactions, categories, monthKey(), todayISO(), monthLabel),
    [transactions, categories, monthLabel],
  )
  const signature = useMemo(() => factsSignature(result.facts), [result.facts])
  const summary = cached && cached.signature === signature ? cached.text : ''

  if (result.insights.length === 0) return null

  async function generate() {
    setLoading(true)
    try {
      const text = await summarizeInsightsWithGroq({
        apiKey,
        model,
        facts: result.facts,
        insights: result.insights.map((item) => item.text),
      })
      await setSetting(SUMMARY_KEY, { signature, text } satisfies CachedSummary)
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="min-w-0 rounded-3xl glass p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <Lightbulb className="h-5 w-5 shrink-0 text-amber-500" />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-slate-900 dark:text-slate-100">
            Insight {monthLabel}
          </span>
          {!open && (
            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
              {result.insights[0].text}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-slate-400 transition', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="mt-3">
      <ul className="space-y-2">
        {result.insights.map((item) => (
          <li key={item.id} className="flex items-start gap-2.5">
            <span
              className={cn(
                'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
                toneStyle[item.tone],
              )}
            >
              {item.tone === 'up' ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : item.tone === 'good' || item.tone === 'down' ? (
                <TrendingDown className="h-3.5 w-3.5" />
              ) : (
                <Lightbulb className="h-3.5 w-3.5" />
              )}
            </span>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{item.text}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
        {summary && (
          <p className="mb-3 flex items-start gap-2 rounded-xl bg-violet-50 p-3 text-sm leading-relaxed text-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
            {summary}
          </p>
        )}
        {apiKey ? (
          <Button variant="outline" size="sm" onClick={() => void generate()} loading={loading}>
            {summary ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {summary ? 'Perbarui ringkasan AI' : 'Ringkasan AI'}
          </Button>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Isi API key Groq di{' '}
            <Link to="/settings" className="font-semibold text-emerald-600 dark:text-emerald-400">
              Pengaturan
            </Link>{' '}
            untuk ringkasan AI.
          </p>
        )}
        {apiKey && (
          <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
            Hanya total dan nama kategori yang dikirim ke Groq, tanpa catatan transaksi.
          </p>
        )}
      </div>
        </div>
      )}
    </section>
  )
}
