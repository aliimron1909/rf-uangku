// Edge Function Supabase: kirim notifikasi push "belum mencatat hari ini".
// Dipanggil pg_cron tiap 5 menit (header x-cron-secret) atau oleh aplikasi untuk tes (JWT pengguna).
// Deploy: supabase functions deploy daily-reminder --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { isReminderDue } from './logic.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const PAYLOAD = (today: string) =>
  JSON.stringify({
    title: 'Pengingat catat uang',
    body: 'Belum ada catatan hari ini. Yuk catat pemasukan dan pengeluaranmu.',
    tag: `daily-${today}`,
    url: '/transactions?new=1',
  })

interface Sub {
  endpoint: string
  p256dh: string
  auth: string
}

/** Mengirim ke semua perangkat; mengembalikan jumlah sukses dan membuang langganan yang sudah mati. */
async function sendToUser(userId: string, payload: string): Promise<number> {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint,p256dh,auth')
    .eq('user_id', userId)
  let sent = 0
  for (const sub of (subs ?? []) as Sub[]) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 60 * 60 * 3, urgency: 'normal' },
      )
      sent += 1
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', sub.endpoint)
      } else {
        console.error('push gagal', status, (error as Error).message)
      }
    }
  }
  return sent
}

async function hasEntryOn(userId: string, date: string): Promise<boolean> {
  for (const table of ['transactions', 'transfers']) {
    const { data } = await supabase
      .from('sync_records')
      .select('record_key')
      .eq('user_id', userId)
      .eq('deleted', false)
      .like('record_key', `${table}|%`)
      .eq('data->>occurredAt', date)
      .limit(1)
    if ((data ?? []).length > 0) return true
  }
  return false
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const cronSecret = Deno.env.get('CRON_SECRET')
  const isCron = Boolean(cronSecret) && request.headers.get('x-cron-secret') === cronSecret

  if (!isCron) {
    // Tes dari aplikasi: harus membawa token login pengguna.
    const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data } = token ? await supabase.auth.getUser(token) : { data: { user: null } }
    if (!data.user) return new Response('Unauthorized', { status: 401 })
    const sent = await sendToUser(
      data.user.id,
      JSON.stringify({
        title: 'Tes notifikasi RF Uangku',
        body: 'Notifikasi push berfungsi di perangkat ini.',
        tag: 'test',
        url: '/',
      }),
    )
    return Response.json({ test: true, sent })
  }

  const now = new Date()
  const { data: settings, error } = await supabase
    .from('reminder_settings')
    .select('user_id,remind_time,timezone,last_sent_date')
    .eq('enabled', true)
  if (error) return new Response(error.message, { status: 500 })

  let notified = 0
  for (const row of settings ?? []) {
    const { due, today } = isReminderDue({
      enabled: true,
      remindTime: row.remind_time,
      timeZone: row.timezone,
      lastSentDate: row.last_sent_date,
      now,
    })
    if (!due) continue
    if (await hasEntryOn(row.user_id, today)) {
      // Sudah mencatat: tandai agar tidak diperiksa ulang sampai besok.
      await supabase.from('reminder_settings').update({ last_sent_date: today }).eq('user_id', row.user_id)
      continue
    }
    const sent = await sendToUser(row.user_id, PAYLOAD(today))
    if (sent > 0) {
      await supabase.from('reminder_settings').update({ last_sent_date: today }).eq('user_id', row.user_id)
      notified += 1
    }
  }
  return Response.json({ checked: settings?.length ?? 0, notified })
})
