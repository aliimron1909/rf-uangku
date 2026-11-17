-- RF Uangku: tabel notifikasi push (pengingat "belum mencatat hari ini").
-- Jalankan di Supabase SQL Editor setelah schema.sql. Aman dijalankan berulang.

create table if not exists public.push_subscriptions (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text        not null,
  p256dh     text        not null,
  auth       text        not null,
  user_agent text,
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint),
  constraint endpoint_size check (length(endpoint) <= 2000)
);

create table if not exists public.reminder_settings (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  enabled        boolean not null default false,
  remind_time    text    not null default '20:00' check (remind_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  timezone       text    not null default 'Asia/Jakarta' check (length(timezone) <= 64),
  last_sent_date date,
  updated_at     timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
alter table public.reminder_settings enable row level security;

drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Pengguna boleh mengubah jam/aktif/zona waktu, tetapi last_sent_date hanya diubah oleh Edge Function.
drop policy if exists "reminder_settings_own" on public.reminder_settings;
create policy "reminder_settings_own" on public.reminder_settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Penjadwal (pg_cron + pg_net). Ganti <ID-PROYEK> dan <CRON_SECRET> lalu jalankan SEKALI
-- (lihat docs/PUSH.md). Dibiarkan sebagai komentar karena berisi rahasia milikmu.
--
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
-- select cron.schedule(
--   'rf-uangku-daily-reminder',
--   '*/5 * * * *',
--   $$ select net.http_post(
--        url := 'https://<ID-PROYEK>.supabase.co/functions/v1/daily-reminder',
--        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
--        body := '{}'::jsonb
--      ) $$
-- );
