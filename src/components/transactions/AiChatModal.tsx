import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  Bot,
  Check,
  RotateCcw,
  Send,
  Sparkles,
  User,
  Wand2,
} from 'lucide-react'
import type { Account, Category } from '../../types'
import { useSetting } from '../../hooks/useSetting'
import { DEFAULT_GROQ_MODEL } from '../../lib/constants'
import { formatDate } from '../../lib/dates'
import { formatRupiah } from '../../lib/format'
import {
  chatTransactionWithGroq,
  resolveAiDraft,
  type GroqChatMessage,
  type ResolvedAiDraft,
} from '../../lib/groq'
import { cn, errorMessage } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface AiChatModalProps {
  open: boolean
  onClose: () => void
  accounts: Account[]
  categories: Category[]
  onApplyDraft: (draft: ResolvedAiDraft) => void
  onSaveDraft: (draft: ResolvedAiDraft) => Promise<void>
}

const greeting: GroqChatMessage = {
  role: 'assistant',
  content:
    'Halo! Ceritakan transaksimu dengan bahasa sehari-hari. Contoh: "makan siang 25rb pakai Gopay". Aku akan bantu menyiapkan draft transaksinya.',
}

const examples = [
  'Makan siang 25rb pakai Gopay',
  'Gaji 5jt masuk BCA',
  'Bensin 50rb Tunai',
  'Kopi 18rb tadi pagi',
]

export function AiChatModal({
  open,
  onClose,
  accounts,
  categories,
  onApplyDraft,
  onSaveDraft,
}: AiChatModalProps) {
  const apiKey = useSetting<string>('groqKey', '')
  const model = useSetting<string>('groqModel', DEFAULT_GROQ_MODEL)
  const [messages, setMessages] = useState<GroqChatMessage[]>([greeting])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<ResolvedAiDraft | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages, loading, draft, error])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120)
    return () => window.clearTimeout(timer)
  }, [open])

  function resetChat() {
    setMessages([greeting])
    setInput('')
    setError('')
    setDraft(null)
    setLoading(false)
    setSaving(false)
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    if (!apiKey) {
      setError('API key Groq belum diisi. Buka Pengaturan untuk mengaktifkan chat AI.')
      return
    }

    const nextMessages: GroqChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setError('')
    setDraft(null)
    setLoading(true)

    try {
      const result = await chatTransactionWithGroq(nextMessages, {
        apiKey,
        model,
        categories,
        accounts,
      })
      setMessages([...nextMessages, { role: 'assistant', content: result.reply }])
      if (result.draft) {
        const resolved = resolveAiDraft(result.draft, accounts, categories)
        if (resolved) {
          setDraft({ ...resolved, note: result.draft.note })
        } else {
          setError(
            'AI memberi draft, tetapi kategori atau rekeningnya tidak ditemukan. Coba sebutkan kategori lain.',
          )
        }
      }
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveDirect() {
    if (!draft || saving) return
    setSaving(true)
    setError('')
    try {
      await onSaveDraft(draft)
      setDraft(null)
      setInput('')
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: 'Transaksi berhasil disimpan. Ada lagi yang ingin dicatat?' },
      ])
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  function handleApply() {
    if (!draft) return
    onApplyDraft(draft)
    setDraft(null)
  }

  const draftCategory = draft
    ? categories.find((category) => category.id === draft.categoryId)?.name ?? 'Kategori'
    : ''
  const draftAccount = draft
    ? accounts.find((account) => account.id === draft.accountId)?.name ?? 'Rekening'
    : ''

  const footer = apiKey ? (
    <div>
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void handleSend()
            }
          }}
          rows={1}
          placeholder="Tulis transaksi atau jawab pertanyaan AI..."
          aria-label="Pesan untuk AI"
          className="max-h-28 min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <Button
          type="button"
          size="icon"
          onClick={() => void handleSend()}
          loading={loading}
          aria-label="Kirim pesan"
        >
          {!loading && <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
        Enter untuk kirim, Shift+Enter untuk baris baru. AI bisa salah, periksa draft sebelum
        menyimpan.
      </p>
    </div>
  ) : undefined

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Chat AI"
      description="Catat transaksi lewat percakapan. Data tetap diproses dari perangkatmu."
      size="lg"
      footer={footer}
    >
      {!apiKey ? (
        <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/70 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="font-bold text-emerald-950 dark:text-emerald-100">
                Aktifkan chat AI dulu
              </p>
              <p className="mt-1 text-sm leading-relaxed text-emerald-900/80 dark:text-emerald-200/80">
                Chat AI memakai API key Groq yang disimpan lokal di perangkat. Tempel API key di
                Pengaturan, lalu kembali ke sini untuk mulai mengobrol.
              </p>
              <Link
                to="/settings"
                onClick={onClose}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Buka Pengaturan
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-[48dvh] flex-col sm:h-[52dvh]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Percakapan
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={resetChat}>
              <RotateCcw className="h-3.5 w-3.5" />
              Mulai ulang
            </Button>
          </div>

          <div ref={scrollRef} className="mt-2 flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.map((message, index) => {
              const isUser = message.role === 'user'
              return (
                <div
                  key={`${message.role}-${index}`}
                  className={cn('flex items-start gap-2', isUser ? 'justify-end' : 'justify-start')}
                >
                  {!isUser && (
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <Bot className="h-4 w-4" />
                    </span>
                  )}
                  <div
                    className={cn(
                      'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                      isUser
                        ? 'rounded-tr-sm bg-emerald-600 text-white'
                        : 'rounded-tl-sm bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
                    )}
                  >
                    {message.content}
                  </div>
                  {isUser && (
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                      <User className="h-4 w-4" />
                    </span>
                  )}
                </div>
              )
            })}

            {messages.length === 1 && !loading && !draft && (
              <div className="flex flex-wrap gap-1.5 pl-9">
                {examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      setInput(example)
                      inputRef.current?.focus()
                    }}
                    className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-50 dark:bg-slate-900 dark:text-emerald-300 dark:ring-emerald-900"
                  >
                    {example}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <Bot className="h-4 w-4" />
                </span>
                <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-slate-100 px-3.5 py-3 dark:bg-slate-800">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                </div>
              </div>
            )}

            {draft && (
              <div className="ml-9 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 dark:border-emerald-900 dark:bg-emerald-950/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    Draft transaksi
                  </p>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold',
                      draft.type === 'income'
                        ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
                    )}
                  >
                    {draft.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                  </span>
                </div>
                <p className="mt-1 text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  {formatRupiah(draft.amount)}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Kategori</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-200">
                      {draftCategory}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Rekening</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-200">
                      {draftAccount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Tanggal</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatDate(draft.occurredAt)}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-slate-500 dark:text-slate-400">Catatan</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-200">
                      {draft.note || '—'}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Button type="button" size="sm" onClick={handleApply} className="flex-1">
                    <Wand2 className="h-4 w-4" />
                    Periksa di form
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleSaveDirect()}
                    loading={saving}
                    className="flex-1"
                  >
                    {!saving && <Check className="h-4 w-4" />}
                    Simpan langsung
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <div className="ml-9 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
