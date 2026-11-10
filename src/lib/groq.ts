export interface ParsedAiTransaction {
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  category?: string;
  account?: string;
  fromAccount?: string;
  toAccount?: string;
  date?: string;
  note?: string;
}

export function buildGroqSystemPrompt(
  accountNames: string[],
  categoryNames: string[]
): string {
  const today = new Date().toISOString().split('T')[0];

  return `Kamu adalah asisten pencatat keuangan pribadi.
Tugasmu menganalisis teks transaksi dan mengembalikan JSON valid.

Daftar Rekening: ${accountNames.join(', ')}
Daftar Kategori: ${categoryNames.join(', ')}
Tanggal Hari Ini: ${today}

Aturan Parsing:
1. Pemasukan/Pengeluaran Biasa:
   - "makan siang 25rb pakai Gopay" -> type: "expense", account: "Gopay", category: "Makan / Minum Harian", amount: 25000

2. Transfer / Tarik Tunai / Top Up:
   - "tarik tunai 100rb dari BCA" -> type: "transfer", fromAccount: "BCA", toAccount: "Tunai", amount: 100000
   - "topup Gopay 50rb dari BCA" -> type: "transfer", fromAccount: "BCA", toAccount: "Gopay", amount: 50000
   - "transfer 200rb dari BCA ke BRI" -> type: "transfer", fromAccount: "BCA", toAccount: "BRI", amount: 200000

Format JSON Output:
- Transfer: {"type": "transfer", "amount": 100000, "fromAccount": "BCA", "toAccount": "Tunai", "date": "${today}", "note": "Tarik tunai"}
- Biasa: {"type": "expense", "amount": 25000, "account": "Gopay", "category": "Makan / Minum Harian", "date": "${today}", "note": "Makan siang"}`;
}

export async function parseTransactionWithGroq(
  apiKey: string,
  model: string,
  userPrompt: string,
  accounts: string[],
  categories: string[]
): Promise<ParsedAiTransaction> {
  const systemPrompt = buildGroqSystemPrompt(accounts, categories);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Groq Error Status: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('AI tidak memberikan respon');
  }

  return JSON.parse(content) as ParsedAiTransaction;
}
eadGroqError(response))
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
