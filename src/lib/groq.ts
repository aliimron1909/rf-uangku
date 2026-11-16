import type { Account, AiDraft, AiTransferDraft, Category, TxType } from '../types'
import type { InsightFacts } from './insights'
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
  transfer: AiTransferDraft | null
}

export type ParsedAiEntry =
  | { kind: 'transaction'; draft: AiDraft }
  | { kind: 'transfer'; transfer: AiTransferDraft }

export interface ResolvedAiTransfer {
  fromAccountId: string
  toAccountId: string
  amount: number
  occurredAt: string
  note: string
}

/** Cocokkan nama rekening dari AI: persis (tanpa huruf besar/kecil), lalu saling mengandung. */
export function matchAccountName(name: string, accounts: Account[]): Account | null {
  const wanted = name.trim().toLowerCase()
  if (!wanted) return null
  const active = accounts.filter((account) => !account.archived)
  return (
    active.find((account) => account.name.toLowerCase() === wanted) ??
    active.find((account) => {
      const candidate = account.name.toLowerCase()
      return candidate.includes(wanted) || wanted.includes(candidate)
    }) ??
    null
  )
}

export function resolveAiTransfer(
  draft: AiTransferDraft,
  accounts: Account[],
): ResolvedAiTransfer | null {
  const from = matchAccountName(draft.fromAccountName, accounts)
  const to = matchAccountName(draft.toAccountName, accounts)
  if (!from || !to || from.id === to.id) return null
  return {
    fromAccountId: from.id,
    toAccountId: to.id,
    amount: draft.amount,
    occurredAt: draft.occurredAt,
    note: draft.note,
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Membaca objek JSON hasil AI menjadi transaksi biasa atau transfer.
 * Mengembalikan null bila jenis atau nominal tidak jelas.
 */
export function readAiEntry(
  object: Record<string, unknown>,
  today: string,
): ParsedAiEntry | null {
  const amount = Number(object.amount)
  if (!Number.isFinite(amount) || amount <= 0) return null
  const occurredAt = ISO_DATE.test(String(object.occurredAt)) ? String(object.occurredAt) : today
  const note = String(object.note ?? '').slice(0, 120)

  if (String(object.type ?? '').toLowerCase() === 'transfer') {
    return {
      kind: 'transfer',
      transfer: {
        amount: Math.round(amount),
        fromAccountName: String(object.fromAccountName ?? '').trim(),
        toAccountName: String(object.toAccountName ?? '').trim(),
        occurredAt,
        note,
      },
    }
  }

  const type = normalizeType(object.type)
  if (!type) return null
  return {
    kind: 'transaction',
    draft: {
      type,
      amount: Math.round(amount),
      categoryName: String(object.categoryName ?? '').trim(),
      accountName: String(object.accountName ?? '').trim(),
      occurredAt,
      note,
    },
  }
}

const TRANSFER_RULES = `- Pindah uang antar rekening milik pengguna sendiri adalah "transfer", BUKAN pemasukan/pengeluaran. Contoh: "top up gopay 50rb dari BCA", "isi saldo Gopay 100rb dari BCA", "tarik tunai 200rb dari BCA", "setor tunai 500rb ke BCA", "pindah 1jt dari BCA ke Seabank".
- Untuk transfer isi "fromAccountName" (rekening sumber) dan "toAccountName" (rekening tujuan), keduanya wajib dari daftar rekening dan harus berbeda. Tidak perlu categoryName/accountName.
- Contoh: "top up gopay 50rb dari BCA" -> {"type":"transfer","amount":50000,"fromAccountName":"BCA","toAccountName":"Gopay",...}. "tarik tunai 200rb dari BCA" -> dari BCA ke Tunai.
- Uang keluar ke orang lain, toko, atau layanan (bayar tagihan, belanja, kirim ke teman) tetap "expense".`

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
): Promise<ParsedAiEntry> {
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
atau untuk transfer antar rekening:
{"type":"transfer","amount":number,"fromAccountName":string,"toAccountName":string,"occurredAt":"YYYY-MM-DD","note":string}
Aturan:
- "type" wajib "income" untuk pemasukan, "expense" untuk pengeluaran, "transfer" untuk pindah uang antar rekening sendiri.
- "amount" angka bulat positif dalam Rupiah, tanpa titik/koma.
- "categoryName" wajib salah satu dari daftar kategori sesuai type.
- "accountName" wajib salah satu dari daftar rekening.
- "occurredAt" format YYYY-MM-DD. Jika tidak disebut, gunakan ${today}.
- "note" ringkas, maksimal 80 karakter.
${TRANSFER_RULES}
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

  if (!text.trim()) throw new Error('Tulis dulu transaksinya.')
  const entry = readAiEntry(parsed as Record<string, unknown>, today)
  if (!entry) throw new Error('AI tidak dapat menentukan jenis atau nominal transaksi.')
  return entry
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
atau untuk transfer antar rekening:
{"reply":string,"transaction":{"type":"transfer","amount":number,"fromAccountName":string,"toAccountName":string,"occurredAt":"YYYY-MM-DD","note":string}}
Aturan:
- "reply" adalah jawaban untuk pengguna, maksimal 2 kalimat. Jangan menampilkan JSON di reply.
- Jika nominal atau jenis transaksi belum bisa disimpulkan, tanyakan satu klarifikasi singkat dan isi "transaction": null. Jangan mengarang nominal.
- Jika informasi sudah cukup atau pengguna mengonfirmasi, isi "transaction" dengan data final.
- "type" wajib "income" untuk pemasukan, "expense" untuk pengeluaran, "transfer" untuk pindah uang antar rekening sendiri.
- "amount" angka bulat positif dalam Rupiah, tanpa titik/koma.
- "categoryName" wajib salah satu dari daftar kategori sesuai type.
- "accountName" wajib salah satu dari daftar rekening.
- "occurredAt" format YYYY-MM-DD. Jika tidak disebut, gunakan ${today}.
- "note" ringkas, maksimal 80 karakter.
${TRANSFER_RULES}
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
  let transfer: AiTransferDraft | null = null

  if (rawDraft && typeof rawDraft === 'object' && !Array.isArray(rawDraft)) {
    const entry = readAiEntry(rawDraft as Record<string, unknown>, today)
    if (entry?.kind === 'transaction') draft = entry.draft
    if (entry?.kind === 'transfer') transfer = entry.transfer
  }

  if (!reply && !draft && !transfer) {
    throw new Error('AI tidak memberi jawaban. Coba kirim pesan lagi.')
  }

  return {
    reply: reply || 'Baik, transaksinya sudah siap. Periksa dulu sebelum disimpan.',
    draft,
    transfer,
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

/**
 * Ringkasan insight bulanan. Hanya angka agregat (total dan nama kategori) yang dikirim;
 * catatan, nama rekening, dan transaksi individual tidak pernah keluar dari perangkat.
 */
export async function summarizeInsightsWithGroq(options: {
  apiKey: string
  model: string
  facts: InsightFacts
  insights: string[]
}): Promise<string> {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'Kamu asisten keuangan pribadi berbahasa Indonesia. Tulis ringkasan 2-3 kalimat yang ramah dan konkret dari data yang diberikan, lalu satu saran praktis. Jangan mengarang angka yang tidak ada di data. Jangan memakai markdown.',
        },
        {
          role: 'user',
          content: JSON.stringify({ data: options.facts, temuan: options.insights }),
        },
      ],
    }),
  })

  if (!response.ok) throw new Error(await readGroqError(response))

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = body?.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('AI tidak mengembalikan ringkasan. Coba lagi.')
  return text.slice(0, 800)
}
