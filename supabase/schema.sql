-- RF Uangku: skema sinkronisasi Supabase.
-- Jalankan sekali di Supabase Dashboard > SQL Editor.
-- Semua isi data terenkripsi di perangkat; server hanya menyimpan teks sandi.

create table if not exists public.sync_records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  record_key text        not null,
  payload    text,
  iv         text,
  deleted    boolean     not null default false,
  client_ts  bigint      not null,
  server_ts  timestamptz not null default clock_timestamp(),
  primary key (user_id, record_key),
  constraint record_key_format check (record_key ~ '^[A-Za-z]+\|.+$' and length(record_key) <= 200),
  constraint payload_size check (payload is null or length(payload) <= 2000000)
);

create index if not exists sync_records_user_server_ts_idx
  on public.sync_records (user_id, server_ts);

create table if not exists public.sync_profile (
  user_id       uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  salt          text not null,
  check_iv      text not null,
  check_payload text not null,
  created_at    timestamptz not null default now()
);

-- Versi lama tidak boleh menimpa versi yang lebih baru; server_ts diperbarui saat benar-benar berubah.
create or replace function public.sync_records_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.client_ts < old.client_ts then
      return old; -- abaikan kiriman yang lebih lama
    end if;
    new.server_ts := clock_timestamp();
  end if;
  return new;
end;
$$;

drop trigger if exists sync_records_guard on public.sync_records;
create trigger sync_records_guard
  before update on public.sync_records
  for each row execute function public.sync_records_guard();

alter table public.sync_records enable row level security;
alter table public.sync_profile enable row level security;

drop policy if exists "sync_records_own" on public.sync_records;
create policy "sync_records_own" on public.sync_records
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "sync_profile_own" on public.sync_profile;
create policy "sync_profile_own" on public.sync_profile
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
