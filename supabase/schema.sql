-- RF Uangku: skema sinkronisasi Supabase.
-- Jalankan di Supabase Dashboard > SQL Editor. Aman dijalankan berulang.
-- Data disimpan sebagai JSON biasa (tanpa enkripsi) di akun Supabase milikmu sendiri;
-- keamanan dijaga lewat login Google + Row Level Security (hanya pemilik yang bisa baca/tulis).

create table if not exists public.sync_records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  record_key text        not null,
  data       jsonb,
  deleted    boolean     not null default false,
  client_ts  bigint      not null,
  server_ts  timestamptz not null default clock_timestamp(),
  primary key (user_id, record_key),
  constraint record_key_format check (record_key ~ '^[A-Za-z]+\|.+$' and length(record_key) <= 200)
);

-- Migrasi dari versi terenkripsi: hapus data cloud lama (tidak bisa dibaca tanpa frasa sandi),
-- buang kolom lama, lalu unggah ulang dari HP. Data di perangkat tidak disentuh.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sync_records' and column_name = 'payload'
  ) then
    delete from public.sync_records;
    alter table public.sync_records drop column payload;
    alter table public.sync_records drop column if exists iv;
    alter table public.sync_records add column if not exists data jsonb;
  end if;
end $$;

drop table if exists public.sync_profile;

create index if not exists sync_records_user_server_ts_idx
  on public.sync_records (user_id, server_ts);

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

drop policy if exists "sync_records_own" on public.sync_records;
create policy "sync_records_own" on public.sync_records
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
