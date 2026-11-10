import type { Account, AiDraft, Category, TxType } from '../types'
import { todayISO } from './dates'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models'

export interface GroqModelInfo {
  id: string
  ownedBy?: string
  created?: number
  contextWindow?: number
  active: boolean
}

const NON_CHAT_MODEL_MARKERS = [
  'whisper',
  'tts',
  'guard',
  'embed',
  'moderation',
  'rerank',
  'transcribe',
  'speech',
]

function isChatModel(id: string): boolean {
  const normalized = id.toLowerCase()
  return !NON_CHAT_MODEL_MARKERS.some((marker) => normalized.includes(marker))
}

export interface ParseOptions {
  apiKey: string
  model: string
  categories: Category[]
  accounts: Account[]
  today?: string
}

export interface ResolvedAiDraft {
  type: TxType
  amount: number
  accountId: string
  categoryId: string
  occurredAt: string
  note: string
}

export interface GroqChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface GroqChatResult {
  reply: string
  draft: AiDraft | null
}

export function resolveAiDraft(
  draft: AiDraft,
  accounts: Account[],
  categories: Category[],
): ResolvedAiDraft | null {
  const category =
    categories.find(
      (item) =>
        item.type === draft.type && item.name.toLowerCase() === draft.categoryName.toLowerCase(),
    ) ??
    categories.find((item) => item.type === draft.type && item.name === 'Lain-lain') ??
    categories.find((item) => item.type === draft.type)

  const account =
    accounts.find((item) => item.name.toLowerCase() === draft.accountName.toLowerCase()) ??
    accounts.find((item) => item.name === 'Tunai') ??
    accounts[0]

  if (!category || !account) return null

  return {
    type: draft.type,
    amount: draft.amount,
    accountId: account.id,
    categoryId: category.id,
    occurredAt: draft.occurredAt,
    note: draft.note,
  }
}

function normalizeType(value: unknown): TxType | null {
  const raw = String(value ?? '').toLowerCase()
  if (['income', 'pemasukan', 'masuk'].includes(raw)) return 'income'
  if (['expense', 'pengeluaran', 'keluar'].includes(raw)) return 'expense'
  return null
}

async function readGroqError(response: Response): Promise<string> {
  let message = `Groq error (${response.status})`
  try {
    const body = (await response.json()) as { error?: { message?: string } }
    if (body?.error?.message) message = body.error.message
  } catch {
    // ignore
  }
  if (response.status === 401) return 'API key Groq tidak valid. Periksa di Pengaturan.'
  if (response.status === 404) {
    return 'Model Groq tidak ditemukan atau sudah tidak aktif. Buka Pengaturan → AI Groq, tekan Cari model aktif, lalu pilih model lain.'
  }
  if (response.status === 429) return 'Kuota Groq sedang penuh. Coba lagi beberapa saat.'
  if (/model.*(not found|does not exist|decommission|not supported|invalid)/i.test(message)) {
    return 'Model Groq tidak tersedia atau sudah tidak aktif. Buka Pengaturan → AI Groq, tekan Cari model aktif, lalu pilih model lain.'
  }
  return message
}

export async function listGroqChatModels(apiKey: string): Promise<GroqModelInfo[]> {
  const response = await fetch(GROQ_MODELS_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(await readGroqError(response))
  }

  const body = (await response.json()) as {
    data?: Array<Record<string, unknown>>
  }

  return (body.data ?? [])
    .map((model): GroqModelInfo => {
      const contextWindow = Number(model.context_window)
      return {
        id: String(model.id ?? '').trim(),
        ownedBy: String(model.owned_by ?? '').trim() || undefined,
        created: Number(model.created) || undefined,
        contextWindow: Number.isFinite(contextWindow) && contextWindow > 0 ? contextWindow : undefined,
        active: model.active !== false,
      }
    })
    .filter((model) => model.id.length > 0 && model.active && isChatModel(model.id))
    .sort((a, b) => a.id.localeCompare(b.id))
}

export async function parseTransactionWithGroq(
  text: string,
  options: ParseOptions,
): Promise<AiDraft> {
  const today = options.today ?? todayISO()
  const incomeCategories = options.categories
    .filter((category) => category.type === 'income' && !category.archived)
    .map((category) => category.name)
  const expenseCategories = options.categories
    .filter((category) => category.type === 'expense' && !category.archived)
    .map((category) => category.name)
  const accountNames = options.accounts
    .filter((account) => !account.archived)
    .map((account) => account.name)

  const systemPrompt = `Kamu adalah parser transaksi keuangan pribadi berbahasa Indonesia.
Hari ini: ${today}.
Kembalikan HANYA objek JSON valid tanpa markdown dengan schema:
{"type":"income"|"expense","amount":number,"categoryName":string,"accountName":string,"occurredAt":"YYYY-MM-DD","note":string}
Aturan:
- "type" wajib "income" untuk pemasukan, "expense" untuk pengeluaran.
- "amount" angka bulat positif dalam Rupiah, tanpa titik/koma.
- "categoryName" wajib salah satu dari daftar kategori sesuai type.
- "accountName" wajib salah satu dari daftar rekening.
- "occurredAt" format YYYY-MM-DD. Jika tidak disebut, gunakan ${today}.
- "note" ringkas, maksimal 80 karakter.
Kategori pemasukan: ${incomeCategories.join(', ')}.
Kategori pengeluaran: ${expenseCategories.join(', ')}.
Rekening: ${accountNames.join(', ')}.
Jika ragu, gunakan kategori "Lain-lain" dan rekening "Tunai".`

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(await readGroqError(response))
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = body?.choices?.[0]?.message?.content ?? ''
  const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('AI mengembalikan format yang tidak valid. Coba tulis ulang dengan lebih jelas.')
  }

  const object = parsed as Record<string, unknown>
  const type = normalizeType(object.type)
  const amount = Number(object.amount)

  if (!type) throw new Error('AI tidak dapat menentukan jenis transaksi.')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('AI tidak dapat menentukan nominal.')
  if (!text.trim()) throw new Error('Tulis dulu transaksinya.')

  const categoryName = String(object.categoryName ?? '').trim()
  const accountName = String(object.accountName ?? '').trim()
  const occurredAt = /^\d{4}-\d{2}-\d{2}$/.test(String(object.occurredAt))
    ? String(object.occurredAt)
    : today
  const note = String(object.note ?? '').slice(0, 120)

  return {
    type,
    amount: Math.round(amount),
    categoryName,
    accountName,
    occurredAt,
    note,
  }
}

export async function chatTransactionWithGroq(
  messages: GroqChatMessage[],
  options: ParseOptions,
): Promise<GroqChatResult> {
  const today = options.today ?? todayISO()
  const incomeCategories = options.categories
    .filter((category) => category.type === 'income' && !category.archived)
    .map((category) => category.name)
  const expenseCategories = options.categories
    .filter((category) => category.type === 'expense' && !category.archived)
    .map((category) => category.name)
  const accountNames = options.accounts
    .filter((account) => !account.archived)
    .map((account) => account.name)

  const systemPrompt = `Kamu adalah asisten keuangan RF Uangku yang ramah, singkat, dan membantu pengguna mencatat SATU transaksi lewat percakapan berbahasa Indonesia.
Hari ini: ${today}.
Balas HANYA objek JSON valid tanpa markdown dengan schema:
{"reply":string,"transaction":null}
atau
{"reply":string,"transaction":{"type":"income"|"expense","amount":number,"categoryName":string,"accountName":string,"occurredAt":"YYYY-MM-DD","note":string}}
Aturan:
- "reply" adalah jawaban untuk pengguna, maksimal 2 kalimat. Jangan menampilkan JSON di reply.
- Jika nominal atau jenis transaksi belum bisa disimpulkan, tanyakan satu klarifikasi singkat dan isi "transaction": null. Jangan mengarang nominal.
- Jika informasi sudah cukup atau pengguna mengonfirmasi, isi "transaction" dengan data final.
- "type" wajib "income" untuk pemasukan, "expense" untuk pengeluaran.
- "amount" angka bulat positif dalam Rupiah, tanpa titik/koma.
- "categoryName" wajib salah satu dari daftar kategori sesuai type.
- "accountName" wajib salah satu dari daftar rekening.
- "occurredAt" format YYYY-MM-DD. Jika tidak disebut, gunakan ${today}.
- "note" ringkas, maksimal 80 karakter.
- Jika kategori tidak disebut, gunakan "Lain-lain" sesuai type.
- Jika rekening tidak disebut, gunakan "Tunai".
- Jika pengguna mengoreksi data, perbarui "transaction" sesuai koreksi.
Kategori pemasukan: ${incomeCategories.join(', ')}.
Kategori pengeluaran: ${expenseCategories.join(', ')}.
Rekening: ${accountNames.join(', ')}.`

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-12).map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(await readGroqError(response))
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = body?.choices?.[0]?.message?.content ?? ''
  const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('AI mengembalikan format yang tidak valid. Coba kirim pesan lagi.')
  }

  const object = parsed as Record<string, unknown>
  const reply = String(object.reply ?? '').trim()
  const rawDraft = object.transaction
  let draft: AiDraft | null = null

  if (rawDraft && typeof rawDraft === 'object' && !Array.isArray(rawDraft)) {
    const transaction = rawDraft as Record<string, unknown>
    const type = normalizeType(transaction.type)
    const amount = Number(transaction.amount)
    if (type && Number.isFinite(amount) && amount > 0) {
      draft = {
        type,
        amount: Math.round(amount),
        categoryName: String(transaction.categoryName ?? '').trim(),
        accountName: String(transaction.accountName ?? '').trim(),
        occurredAt: /^\d{4}-\d{2}-\d{2}$/.test(String(transaction.occurredAt))
          ? String(transaction.occurredAt)
          : today,
        note: String(transaction.note ?? '').slice(0, 120),
      }
    }
  }

  if (!reply && !draft) {
    throw new Error('AI tidak memberi jawaban. Coba kirim pesan lagi.')
  }

  return {
    reply: reply || 'Baik, transaksinya sudah siap. Periksa dulu sebelum disimpan.',
    draft,
  }
}

export async function testGroq(apiKey: string, model: string): Promise<string> {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [{ role: 'user', content: 'Balas hanya dengan kata: OK' }],
    }),
  })

  if (!response.ok) {
    throw new Error(await readGroqError(response))
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return body?.choices?.[0]?.message?.content?.trim() || 'OK'
}
