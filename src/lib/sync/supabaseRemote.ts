import type { PushRow, RemoteRow, SyncRemote } from './engine'
import type { SupabaseConfig } from './config'

const PAGE_SIZE = 500

export class SyncAuthError extends Error {
  constructor(message = 'Sesi login berakhir. Masuk lagi dengan Google.') {
    super(message)
    this.name = 'SyncAuthError'
  }
}

interface ServerRow {
  record_key: string
  data: unknown | null
  deleted: boolean
  client_ts: number | string
  server_ts: string
}

/** Klien REST Supabase (PostgREST) tanpa SDK; token dari login Google. */
export class SupabaseRemote implements SyncRemote {
  constructor(
    private readonly config: SupabaseConfig,
    private readonly getToken: () => Promise<string>,
  ) {}

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.getToken()
    const response = await fetch(`${this.config.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: this.config.anonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    })
    if (response.status === 401 || response.status === 403) throw new SyncAuthError()
    if (!response.ok) {
      let detail = ''
      try {
        const body = (await response.json()) as { message?: string }
        detail = body.message ?? ''
      } catch {
        // abaikan
      }
      if (response.status === 404 || /relation .* does not exist|schema cache/i.test(detail)) {
        throw new Error('Tabel belum dibuat di Supabase. Jalankan supabase/schema.sql dan supabase/push.sql.')
      }
      throw new Error(`Server sinkronisasi error (${response.status})${detail ? `: ${detail}` : ''}`)
    }
    return response
  }

  async pull(since: string | null): Promise<RemoteRow[]> {
    const rows: RemoteRow[] = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const filter = since ? `&server_ts=gte.${encodeURIComponent(since)}` : ''
      const response = await this.request(
        `sync_records?select=record_key,data,deleted,client_ts,server_ts${filter}` +
          `&order=server_ts.asc,record_key.asc&limit=${PAGE_SIZE}&offset=${offset}`,
      )
      const page = (await response.json()) as ServerRow[]
      for (const row of page) {
        rows.push({
          key: row.record_key,
          data: row.data,
          deleted: row.deleted,
          clientTs: Number(row.client_ts),
          serverTs: row.server_ts,
        })
      }
      if (page.length < PAGE_SIZE) return rows
    }
  }

  async push(rows: PushRow[]): Promise<void> {
    if (rows.length === 0) return
    await this.request('sync_records?on_conflict=user_id,record_key', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(
        rows.map((row) => ({
          record_key: row.key,
          data: row.data,
          deleted: row.deleted,
          client_ts: row.clientTs,
        })),
      ),
    })
  }

  async upsertPushSubscription(sub: {
    endpoint: string
    p256dh: string
    auth: string
    userAgent: string
  }): Promise<void> {
    await this.request('push_subscriptions?on_conflict=user_id,endpoint', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        user_agent: sub.userAgent.slice(0, 200),
      }),
    })
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    await this.request(`push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    })
  }

  async saveReminderSettings(value: {
    enabled: boolean
    remindTime: string
    timezone: string
  }): Promise<void> {
    await this.request('reminder_settings?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        enabled: value.enabled,
        remind_time: value.remindTime,
        timezone: value.timezone,
        updated_at: new Date().toISOString(),
      }),
    })
  }

  /** Menghapus seluruh data cloud milik pengguna (untuk memulai ulang). */
  async deleteAll(): Promise<void> {
    await this.request('sync_records?record_key=not.is.null', {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    })
  }
}
