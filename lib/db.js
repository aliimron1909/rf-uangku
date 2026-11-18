/**
 * Penyimpanan Postgres (Neon) bersama untuk api/sync.js, api/lisensi.js, dan api/admin.js.
 * Skema dibuat otomatis (create table if not exists) pada permintaan pertama.
 * Semua kueri memakai parameter ($1, $2, ...); tidak ada string yang digabung ke SQL.
 */
'use strict';

const GAGAL_MENIT = 10;

const SCHEMA = [
  // --- akun cloud pembeli (sync) ---
  `create table if not exists wm_tenant(id bigserial primary key, license text unique not null, status text not null default 'aktif', checked_at timestamptz not null default now(), created_at timestamptz not null default now())`,
  `alter table wm_tenant add column if not exists sync_at timestamptz`,
  `create table if not exists wm_akses(kode text primary key, tenant_id bigint not null references wm_tenant(id) on delete cascade, peran text not null, cabang text not null default '', nama text not null default '', status text not null default 'aktif', dibuat timestamptz not null default now(), terakhir timestamptz, perangkat text not null default '')`,
  `create index if not exists wm_akses_tenant on wm_akses(tenant_id)`,
  `create table if not exists wm_pen(tenant_id bigint not null references wm_tenant(id) on delete cascade, k text not null, v text not null, primary key(tenant_id, k))`,
  `create table if not exists wm_catatan(tenant_id bigint not null references wm_tenant(id) on delete cascade, warung text not null, tgl text not null, siklus int not null, hari int not null, omset bigint not null, pengeluaran text not null default '', primary key(tenant_id, warung, tgl))`,
  `create table if not exists wm_gagal(ip text not null, waktu timestamptz not null default now())`,
  `create index if not exists wm_gagal_ip on wm_gagal(ip, waktu)`,
  // --- lisensi dan pembayaran (pengganti Lisensi.gs / Google Sheet) ---
  `create table if not exists wm_lisensi(kode text primary key, pembeli text not null default '', status text not null default 'aktif', maks int not null default 3, perangkat jsonb not null default '[]', aktif_pertama timestamptz, catatan text not null default '', dibuat timestamptz not null default now())`,
  `create table if not exists wm_pesanan(order_id text primary key, device text not null, status text not null default 'pending', jumlah int not null, dibuat timestamptz not null default now(), dibayar timestamptz, kode text not null default '', status_midtrans text not null default '', url text not null default '')`,
  `create index if not exists wm_pesanan_dev on wm_pesanan(device, dibuat)`,
  `create index if not exists wm_pesanan_dibuat on wm_pesanan(dibuat)`,
  `create table if not exists wm_log(waktu timestamptz not null default now(), kejadian text not null)`
];

const ms = v => v ? new Date(v).getTime() : 0;
const iso = v => v ? new Date(v).toISOString() : '';
const like = q => '%' + String(q).replace(/[\\%_]/g, '\\$&') + '%';

function sqlStore(url) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: url, max: 1, idleTimeoutMillis: 10000, connectionTimeoutMillis: 15000 });
  const q = async (text, params, c) => (await (c || pool).query(text, params)).rows;
  let ready = null;

  const mapAkses = r => r && ({ kode: r.kode, tenant: Number(r.tenant_id), peran: r.peran, cabang: r.cabang, nama: r.nama, status: r.status, perangkat: r.perangkat, tenantStatus: r.tenant_status, license: r.license, checkedAt: ms(r.checked_at), licStatus: r.lic_status === null || r.lic_status === undefined ? null : r.lic_status, licPerangkat: Array.isArray(r.lic_perangkat) ? r.lic_perangkat : [] });
  const mapLic = r => r && ({ kode: r.kode, pembeli: r.pembeli, status: r.status, maks: r.maks, perangkat: Array.isArray(r.perangkat) ? r.perangkat : [], aktifPertama: iso(r.aktif_pertama), catatan: r.catatan, dibuat: iso(r.dibuat) });
  const mapOrd = r => r && ({ id: r.order_id, device: r.device, status: r.status, jumlah: Number(r.jumlah), dibuat: iso(r.dibuat), dibayar: iso(r.dibayar), kode: r.kode, statusMidtrans: r.status_midtrans, url: r.url });
  const AK = `select a.*, t.status as tenant_status, t.license, t.checked_at, l.status as lic_status, l.perangkat as lic_perangkat from wm_akses a join wm_tenant t on t.id=a.tenant_id left join wm_lisensi l on l.kode=t.license`;
  const BULK = `select $1::bigint, $2::text, x.tgl, x.siklus, x.hari, x.omset, x.pengeluaran from jsonb_to_recordset($3::jsonb) as x(tgl text, siklus int, hari int, omset bigint, pengeluaran text)`;

  async function tx(fn) {
    const c = await pool.connect();
    try { await c.query('begin'); const r = await fn(c); await c.query('commit'); return r; }
    catch (e) { await c.query('rollback').catch(() => {}); throw e; }
    finally { c.release(); }
  }

  return {
    async init() {
      if (!ready) ready = (async () => { for (const s of SCHEMA) await q(s); })().catch(e => { ready = null; throw e; });
      return ready;
    },
    async ping() { await q('select 1'); },

    /* ---------- akun cloud ---------- */
    async aksesByKode(kode) { return mapAkses((await q(`${AK} where a.kode=$1`, [kode]))[0]); },
    async ownerByLicense(license) { return mapAkses((await q(`${AK} where t.license=$1 and a.peran='pemilik' limit 1`, [license]))[0]); },
    async createTenant(license, ownerKode) {   // idempotent: license unik, pemilik hanya satu
      await tx(async c => {
        await c.query(`insert into wm_tenant(license) values($1) on conflict(license) do nothing`, [license]);
        const t = (await c.query(`select id from wm_tenant where license=$1`, [license])).rows[0];
        await c.query(`insert into wm_akses(kode, tenant_id, peran, cabang, nama) select $1::text, $2::bigint, 'pemilik', '*', 'Pemilik' where not exists (select 1 from wm_akses where tenant_id=$2::bigint and peran='pemilik')`, [ownerKode, t.id]);
      });
    },
    async listAkses(tenant) { return (await q(`select * from wm_akses where tenant_id=$1 order by dibuat`, [tenant])).map(r => ({ kode: r.kode, peran: r.peran, cabang: r.cabang, nama: r.nama, status: r.status, perangkat: r.perangkat })); },
    async setPerangkat(kode, dev) { await q(`update wm_akses set perangkat=$2 where kode=$1`, [kode, dev]); },
    async touch(kode) { await q(`update wm_akses set terakhir=now() where kode=$1`, [kode]); },
    async addAkses(tenant, kode, cabang, nama) { await q(`insert into wm_akses(kode, tenant_id, peran, cabang, nama) values($1,$2,'karyawan',$3,$4)`, [kode, tenant, cabang, nama]); },
    async setStatusAkses(tenant, kode, status) { await q(`update wm_akses set status=$3 where tenant_id=$1 and kode=$2 and peran='karyawan'`, [tenant, kode, status]); },
    async pen(tenant) { const m = {}; (await q(`select k, v from wm_pen where tenant_id=$1`, [tenant])).forEach(r => m[r.k] = r.v); return m; },
    async recs(tenant, warung) { return (await q(`select tgl, siklus, hari, omset, pengeluaran from wm_catatan where tenant_id=$1 and warung=$2 order by tgl`, [tenant, warung])).map(r => ({ tgl: r.tgl, siklus: r.siklus, hari: r.hari, omset: Number(r.omset), pengeluaran: r.pengeluaran })); },
    async upsertRecs(tenant, warung, rows) {
      if (!rows.length) return;
      await q(`insert into wm_catatan(tenant_id, warung, tgl, siklus, hari, omset, pengeluaran) ${BULK} on conflict(tenant_id, warung, tgl) do update set siklus=excluded.siklus, hari=excluded.hari, omset=excluded.omset, pengeluaran=excluded.pengeluaran`, [tenant, warung, JSON.stringify(rows)]);
      await q(`update wm_tenant set sync_at=now() where id=$1`, [tenant]);
    },
    async syncAll(tenant, pen, byWarung) {   // satu transaksi: gagal di tengah = tidak ada yang berubah
      await tx(async c => {
        await c.query(`select id from wm_tenant where id=$1 for update`, [tenant]);   // serialisasi sync dari beberapa HP
        await c.query(`delete from wm_pen where tenant_id=$1`, [tenant]);
        if (Object.keys(pen).length) await c.query(`insert into wm_pen(tenant_id, k, v) select $1::bigint, e.key, e.value from jsonb_each_text($2::jsonb) as e`, [tenant, JSON.stringify(pen)]);
        for (const id of Object.keys(byWarung)) {
          await c.query(`delete from wm_catatan where tenant_id=$1 and warung=$2`, [tenant, id]);
          if (byWarung[id].length) await c.query(`insert into wm_catatan(tenant_id, warung, tgl, siklus, hari, omset, pengeluaran) ${BULK}`, [tenant, id, JSON.stringify(byWarung[id])]);
        }
        await c.query(`update wm_tenant set sync_at=now() where id=$1`, [tenant]);
      });
    },
    async gagalCatat(ip) { await q(`insert into wm_gagal(ip) values($1)`, [ip]); await q(`delete from wm_gagal where waktu < now() - interval '1 day'`); },
    async gagalHitung(ip) { return Number((await q(`select count(*)::int as n from wm_gagal where ip=$1 and waktu > now() - make_interval(mins => $2::int)`, [ip, GAGAL_MENIT]))[0].n); },

    /* ---------- lisensi ---------- */
    async licGet(kode) { return mapLic((await q(`select * from wm_lisensi where kode=$1`, [kode]))[0]); },
    // fn(row|null) -> { patch?, result }. Baris dikunci selama fn berjalan, jadi batas perangkat tidak bisa dilewati lewat permintaan serentak.
    async licTx(kode, fn) {
      return tx(async c => {
        const row = mapLic((await c.query(`select * from wm_lisensi where kode=$1 for update`, [kode])).rows[0]);
        const out = fn(row);
        const p = out.patch;
        if (row && p) {
          const sets = [], vals = [kode];
          const add = (col, v, cast) => { vals.push(v); sets.push(`${col}=$${vals.length}${cast || ''}`); };
          if (p.status !== undefined) add('status', p.status);
          if (p.maks !== undefined) add('maks', p.maks, '::int');
          if (p.perangkat !== undefined) add('perangkat', JSON.stringify(p.perangkat), '::jsonb');
          if (p.catatan !== undefined) add('catatan', p.catatan);
          if (p.aktifPertama) sets.push('aktif_pertama=coalesce(aktif_pertama, now())');
          if (sets.length) await c.query(`update wm_lisensi set ${sets.join(', ')} where kode=$1`, vals);
        }
        return out.result;
      });
    },
    async licInsert(rows) {   // abaikan kode yang sudah ada; mengembalikan jumlah yang benar-benar masuk
      let n = 0;
      for (const r of rows) {
        const res = await pool.query(`insert into wm_lisensi(kode, pembeli, status, maks, perangkat, aktif_pertama, catatan, dibuat) values($1,$2,$3,$4::int,$5::jsonb,$6::timestamptz,$7,coalesce($8::timestamptz, now())) on conflict(kode) do nothing`, [r.kode, r.pembeli || '', r.status || 'aktif', r.maks || 3, JSON.stringify(r.perangkat || []), r.aktifPertama || null, r.catatan || '', r.dibuat || null]);
        n += res.rowCount;
      }
      return n;
    },
    async licList({ q: cari, status, limit, offset }) {
      const w = [], p = [];
      if (status) { p.push(status); w.push(`status=$${p.length}`); }
      if (cari) { p.push(like(cari)); w.push(`(kode ilike $${p.length} or pembeli ilike $${p.length} or catatan ilike $${p.length} or perangkat::text ilike $${p.length})`); }
      const where = w.length ? 'where ' + w.join(' and ') : '';
      const total = Number((await q(`select count(*)::int as n from wm_lisensi ${where}`, p))[0].n);
      const items = (await q(`select * from wm_lisensi ${where} order by dibuat desc, kode limit $${p.length + 1}::int offset $${p.length + 2}::int`, [...p, limit, offset])).map(mapLic);
      return { total, items };
    },
    async licStats() {
      const r = (await q(`select count(*)::int as total, (count(*) filter (where status='aktif'))::int as aktif, coalesce(sum(jsonb_array_length(perangkat)),0)::int as perangkat from wm_lisensi`))[0];
      return { total: r.total, aktif: r.aktif, perangkat: r.perangkat };
    },
    async licInsertBaru(kodes, pembeli) {   // kode manual dari admin
      return this.licInsert(kodes.map(k => ({ kode: k, pembeli, status: 'aktif', maks: 3, perangkat: [], catatan: 'manual-admin' })));
    },

    /* ---------- pesanan (Midtrans) ---------- */
    async ordGet(id) { return mapOrd((await q(`select * from wm_pesanan where order_id=$1`, [id]))[0]); },
    async ordInsert(o) { await q(`insert into wm_pesanan(order_id, device, status, jumlah, url) values($1,$2,'pending',$3::int,$4)`, [o.id, o.device, o.jumlah, o.url]); },
    async ordReusable(dev, sinceMs) { return mapOrd((await q(`select * from wm_pesanan where device=$1 and status='pending' and url<>'' and dibuat > now() - make_interval(secs => $2::int) order by dibuat desc limit 1`, [dev, Math.round(sinceMs / 1000)]))[0]); },
    async ordCount(dev, sinceMs) { return Number((await q(`select count(*)::int as n from wm_pesanan where ($1::text is null or device=$1::text) and dibuat > now() - make_interval(secs => $2::int)`, [dev, Math.round(sinceMs / 1000)]))[0].n); },
    async ordCleanup() { await q(`delete from wm_pesanan where status in ('pending','gagal') and dibuat < now() - interval '7 days'`); },
    async ordSet(id, status, statusMidtrans) { await q(`update wm_pesanan set status=$2, status_midtrans=$3 where order_id=$1 and status<>'paid'`, [id, status, statusMidtrans]); },
    // Idempotent: pesanan yang sudah lunas selalu mengembalikan kode yang sama; lisensi dan pesanan berubah dalam satu transaksi.
    async markPaid(id, statusMidtrans, kode) {
      return tx(async c => {
        const o = mapOrd((await c.query(`select * from wm_pesanan where order_id=$1 for update`, [id])).rows[0]);
        if (!o) return null;
        if (o.status === 'paid' && o.kode) return o.kode;
        await c.query(`insert into wm_lisensi(kode, pembeli, status, maks, perangkat, aktif_pertama, catatan) values($1,$2,'aktif',3,$3::jsonb, now(),'otomatis')`, [kode, 'Midtrans ' + id, JSON.stringify([o.device])]);
        await c.query(`update wm_pesanan set status='paid', dibayar=now(), kode=$2, status_midtrans=$3 where order_id=$1`, [id, kode, statusMidtrans]);
        return kode;
      });
    },
    async ordList(limit) { return (await q(`select * from wm_pesanan order by dibuat desc limit $1::int`, [limit])).map(mapOrd); },
    async ordStats() {
      const r = (await q(`select
        count(*) filter (where status='paid')::int as n_all, coalesce(sum(jumlah) filter (where status='paid'),0)::bigint as s_all,
        count(*) filter (where status='paid' and dibayar >= date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta')::int as n_day,
        coalesce(sum(jumlah) filter (where status='paid' and dibayar >= date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'),0)::bigint as s_day,
        count(*) filter (where status='paid' and dibayar > now() - interval '7 days')::int as n_7, coalesce(sum(jumlah) filter (where status='paid' and dibayar > now() - interval '7 days'),0)::bigint as s_7,
        count(*) filter (where status='paid' and dibayar > now() - interval '30 days')::int as n_30, coalesce(sum(jumlah) filter (where status='paid' and dibayar > now() - interval '30 days'),0)::bigint as s_30,
        count(*) filter (where status='pending' and dibuat > now() - interval '1 day')::int as pending,
        count(*) filter (where status='gagal' and dibuat > now() - interval '1 day')::int as gagal
        from wm_pesanan`))[0];
      const o = (n, s) => ({ jumlah: r[n], total: Number(r[s]) });
      return { semua: o('n_all', 's_all'), hari_ini: o('n_day', 's_day'), tujuh_hari: o('n_7', 's_7'), tiga_puluh_hari: o('n_30', 's_30'), pending: r.pending, gagal: r.gagal };
    },

    /* ---------- log keamanan ---------- */
    async logAdd(kejadian, dedupeMs) {
      if (dedupeMs && (await q(`select 1 from wm_log where kejadian=$1 and waktu > now() - make_interval(secs => $2::int) limit 1`, [kejadian, Math.round(dedupeMs / 1000)])).length) return;
      await q(`insert into wm_log(kejadian) values($1)`, [kejadian]);
    },
    async logList(n) { return (await q(`select waktu, kejadian from wm_log order by waktu desc limit $1::int`, [n])).map(r => ({ waktu: iso(r.waktu), kejadian: r.kejadian })); },

    /* ---------- untuk panel admin: data cloud pembeli ---------- */
    async tenantStats() {
      const r = (await q(`select count(*)::int as akun, (count(*) filter (where sync_at > now() - interval '7 days'))::int as aktif7 from wm_tenant`))[0];
      const c = Number((await q(`select count(*)::bigint as n from wm_catatan`))[0].n);
      return { akun: r.akun, aktif_7_hari: r.aktif7, catatan: c };
    },
    async tenantList({ q: cari, limit, offset }) {
      const p = [], w = [];
      if (cari) { p.push(like(cari)); w.push(`(t.license ilike $${p.length} or l.pembeli ilike $${p.length})`); }
      const where = w.length ? 'where ' + w.join(' and ') : '', from = `from wm_tenant t left join wm_lisensi l on l.kode=t.license ${where}`;
      const total = Number((await q(`select count(*)::int as n ${from}`, p))[0].n);
      const rows = await q(`select t.id, t.license, t.sync_at, t.created_at, l.pembeli, l.status as lic_status,
        (select count(*)::int from wm_catatan c where c.tenant_id=t.id) as catatan,
        (select coalesce(sum(omset),0)::bigint from wm_catatan c where c.tenant_id=t.id) as omset,
        (select max(tgl) from wm_catatan c where c.tenant_id=t.id) as terakhir,
        (select count(*)::int from wm_akses a where a.tenant_id=t.id and a.peran='karyawan') as karyawan
        ${from} order by coalesce(t.sync_at, t.created_at) desc, t.id desc limit $${p.length + 1}::int offset $${p.length + 2}::int`, [...p, limit, offset]);
      const ids = rows.map(r => r.id), nama = {};
      if (ids.length) (await q(`select tenant_id, (v::jsonb)->>'nama' as nama from wm_pen where tenant_id = any($1::bigint[]) and (k='settings' or k like '%:settings') order by k`, [ids])).forEach(r => { if (r.nama) (nama[r.tenant_id] = nama[r.tenant_id] || []).push(r.nama); });
      return { total, items: rows.map(r => ({ id: Number(r.id), license: r.license, pembeli: r.pembeli || '', status: r.lic_status || 'tidak ada', warung: nama[r.id] || [], catatan: r.catatan, omset: Number(r.omset), terakhir_catatan: r.terakhir || '', karyawan: r.karyawan, sync_at: iso(r.sync_at), dibuat: iso(r.created_at) })) };
    }
  };
}

let STORE = null;
function getStore(env) {
  if (STORE) return STORE;
  const url = (env || process.env).DATABASE_URL || (env || process.env).DATABASE_POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL belum ada. Hubungkan Neon ke proyek ini di Vercel > Storage.');
  return (STORE = sqlStore(url));
}
const setStore = s => { STORE = s; };

module.exports = { sqlStore, getStore, setStore, SCHEMA, GAGAL_MENIT };
