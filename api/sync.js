/**
 * Server sync pusat Omset-WarMad (Vercel Function + Neon Postgres).
 * Pengganti Code.gs: pembeli TIDAK perlu membuat Google Sheet / Apps Script sendiri.
 *
 * Protokol sama dengan Code.gs (verify, pull, syncAll, syncStaff, createAccess, setAccess, resetDevice),
 * ditambah aksi "register": pembeli Premium menukar kode lisensinya dengan Kode Pemilik secara otomatis.
 *
 * Variabel lingkungan (Vercel > Settings > Environment Variables):
 *   DATABASE_URL  dibuat otomatis oleh integrasi Neon (boleh juga DATABASE_POSTGRES_URL)
 * Lisensi dibaca langsung dari tabel wm_lisensi di database yang sama (lihat api/lisensi.js).
 * Tabel dibuat otomatis pada permintaan pertama; tidak ada yang perlu dijalankan di Neon.
 * Cek cepat dari browser: buka https://domain-kamu/api/sync  -> harus tampil {"ok":true,...}
 */
'use strict';
const { getStore, setStore } = require('../lib/db.js');
const lic = require('../lib/lic.js');

const KEYS = ['settings', 'cycleKontrakOptions', 'cycleJagaModes', 'cycleNames', 'cycleStok', 'cyclePenjaga'];
const STAFF_SETTINGS = ['nama', 'alamat', 'hp', 'pct', 'kontrak', 'boss', 'k1', 'k2', 'jml', 'defMode', 'foto'];
const MAX_WARUNG = 10, MAX_REC = 20000, MAX_VAL = 1500000;   // batas wajar; melindungi database gratis dari kiriman sampah

const SETUP_MSG = 'Kode akses tidak valid';
const GAGAL_MAKS = 30;

const clean = id => String(id || 'w1').replace(/[^\w]/g, '').slice(0, 40) || 'w1';
const pfx = id => id === 'w1' ? '' : id + ':';
const parse = (v, d) => { try { const x = JSON.parse(v); return x === null || x === undefined ? d : x; } catch (e) { return d; } };
const upper = lic.upper, randCode = lic.randCode;
function rec(r) {   // sama dengan rec_ di Code.gs, hasilnya objek
  const o = Number(r && r.omset);
  if (!r || !/^\d{4}-\d\d-\d\d$/.test(String(r.date)) || !isFinite(o) || o < 0 || o > 1e12) return null;
  return { tgl: String(r.date), siklus: Math.min(9999, Math.max(1, Math.round(Number(r.cycle)) || 1)), hari: Math.min(30, Math.max(1, Math.round(Number(r.day)) || 1)), omset: Math.round(o), pengeluaran: String(r.expense || '').slice(0, 200) };
}
const dedupe = rows => { const m = new Map(); for (const r of rows) m.set(r.tgl, r); return [...m.values()].sort((a, b) => a.tgl < b.tgl ? -1 : 1); };

/* =====================  logika protokol  ===================== */
async function oneWarung(db, tenant, id, pen, staff) {
  const p = pfx(id), st = parse(pen[p + 'settings'], {});
  const settings = staff ? STAFF_SETTINGS.reduce((o, k) => { if (st[k] !== undefined) o[k] = st[k]; return o; }, {}) : st;
  const recs = (await db.recs(tenant, id)).map(r => ({ date: r.tgl, cycle: r.siklus, day: r.hari, omset: r.omset, expense: r.pengeluaran }));
  return { id, records: recs, settings, cycleKontrakOptions: parse(pen[p + 'cycleKontrakOptions'], {}), cycleJagaModes: parse(pen[p + 'cycleJagaModes'], {}), cycleNames: parse(pen[p + 'cycleNames'], {}), cycleStok: parse(pen[p + 'cycleStok'], {}), cyclePenjaga: parse(pen[p + 'cyclePenjaga'], {}) };
}

async function authKey(db, b) {
  const a = await db.aksesByKode(upper(b.key));
  if (!a) return { error: SETUP_MSG };
  // Status lisensi dibaca langsung dari tabel lisensi: dicabut di panel admin = langsung berlaku, tanpa menunggu
  if (a.licStatus !== 'aktif') return { error: 'Lisensi pemilik tidak aktif', revoked: true };
  if (a.status !== 'aktif') return { error: 'Akses sudah dicabut', revoked: true };
  if (a.peran === 'karyawan') {   // satu kode = satu perangkat
    const d = String(b.device || '').slice(0, 40);
    if (!d) return { error: 'Perangkat tidak dikenali' };
    if (!a.perangkat) { await db.setPerangkat(a.kode, d); a.perangkat = d; }
    else if (a.perangkat !== d) return { error: 'Kode ini sudah dipakai di perangkat lain. Minta pemilik melepas perangkat lama.' };
  }
  return { a };
}

async function register(db, b) {
  const code = upper(b.code), dev = String(b.device || '').slice(0, 40);
  if (!lic.validCode(code) || !lic.validDevice(dev)) return { ok: false, error: 'Data tidak lengkap' };
  const j = lic.cek(await db.licGet(code), dev);   // aturan sama dengan aktivasi di aplikasi: kode ada, aktif, perangkat terdaftar
  if (!j.ok) return { ok: false, error: j.error, fail: true };
  let o = await db.ownerByLicense(code);
  if (!o) { await db.createTenant(code, randCode('PMK')); o = await db.ownerByLicense(code); }
  if (!o) return { ok: false, error: 'Gagal membuat akun' };
  return { ok: true, key: o.kode };
}

// Pemilik hanya boleh memakai akun cloud dari perangkat yang terdaftar di lisensinya (jatah perangkat berlaku juga di sini).
// Bila permintaan tidak membawa ID perangkat (mis. verifikasi dari HP karyawan), pemeriksaan ini dilewati; kode pemilik tetap rahasia.
function cekPerangkatPemilik(au, b) {
  const a = au.a, dev = String(b.device || '').slice(0, 40);
  if (a.peran !== 'pemilik' || !dev || a.licPerangkat.indexOf(dev) >= 0) return null;
  return { ok: false, error: 'Perangkat ini belum terdaftar untuk lisensi Anda. Aktifkan ulang kode lisensi.', revoked: true };
}

async function pull(db, au) {
  const a = au.a, pen = await db.pen(a.tenant), has = pen.warung !== undefined, ids = has ? parse(pen.warung, []) : [];
  if (a.peran === 'karyawan') {
    if (ids.indexOf(a.cabang) < 0) return { ok: false, error: 'Warung belum terdaftar. Minta pemilik menekan sync.' };
    await db.touch(a.kode);
    const pr = parse(pen.premium, {});   // Premium pemilik, berlaku 14 hari sejak sync terakhir pemilik
    return { ok: true, peran: 'karyawan', premium: !!(pr.on && Date.now() - pr.at < 14 * 864e5), warung: [await oneWarung(db, a.tenant, a.cabang, pen, true)] };
  }
  const list = await db.listAkses(a.tenant), warung = [];
  for (const id of ids) warung.push(await oneWarung(db, a.tenant, id, pen, false));
  return { ok: true, peran: 'pemilik', warung, akses: list.map(x => ({ kode: x.kode, peran: x.peran, cabang: x.cabang, nama: x.nama, status: x.status, terpasang: !!x.perangkat })) };
}

async function syncAll(db, au, b) {
  if (!Array.isArray(b.warung) || b.warung.length > MAX_WARUNG) return { ok: false, error: 'Data warung tidak valid' };
  const pen = {}, byWarung = {}, ids = [];
  for (const w of b.warung) {
    const id = clean(w && w.id);
    if (ids.indexOf(id) >= 0) continue;
    ids.push(id);
    const raw = Array.isArray(w.records) ? w.records : [];
    if (raw.length > MAX_REC) return { ok: false, error: 'Terlalu banyak catatan' };
    byWarung[id] = dedupe(raw.map(rec).filter(Boolean));
    for (const k of KEYS) {
      const v = JSON.stringify((w && w[k]) || {});
      if (v.length > MAX_VAL) return { ok: false, error: 'Data pengaturan terlalu besar (kecilkan foto/logo)' };
      pen[pfx(id) + k] = v;
    }
  }
  pen.warung = JSON.stringify(ids);
  pen.premium = JSON.stringify({ on: !!b.premium, at: Date.now() });
  await db.syncAll(au.a.tenant, pen, byWarung);
  return { ok: true, warung: ids.length };
}

async function syncStaff(db, au, b) {
  const cabang = au.a.cabang, w = (b.warung || []).find(x => clean(x && x.id) === cabang);
  if (!w) return { ok: false, error: 'Warung tidak sesuai akses' };
  const raw = Array.isArray(w.records) ? w.records : [];
  if (raw.length > MAX_REC) return { ok: false, error: 'Terlalu banyak catatan' };
  await db.upsertRecs(au.a.tenant, cabang, dedupe(raw.map(rec).filter(Boolean)));   // upsert, karyawan tidak bisa menghapus
  return { ok: true, count: (await db.recs(au.a.tenant, cabang)).length };
}

async function createAccess(db, au, b) {
  const pen = await db.pen(au.a.tenant), ids = parse(pen.warung, []), cabang = clean(b.cabang), nama = String(b.nama || '').trim().slice(0, 60);
  if (ids.indexOf(cabang) < 0) return { ok: false, error: 'Warung belum tersinkron. Tekan sync dulu.' };
  if (!nama) return { ok: false, error: 'Nama karyawan kosong' };
  const kode = randCode('KRY');
  await db.addAkses(au.a.tenant, kode, cabang, nama);
  return { ok: true, kode };
}
async function karyawan(db, au, b) {
  const code = upper(b.code), x = (await db.listAkses(au.a.tenant)).find(y => y.kode === code);
  return x && x.peran === 'karyawan' ? x : null;
}

async function dispatch(db, b, au) {
  const a = au.a;
  if (b.action === 'verify') return { ok: true, peran: a.peran };
  if (b.action === 'pull') return cekPerangkatPemilik(au, b) || pull(db, au);
  if (b.action === 'syncAll') {
    if (a.peran !== 'pemilik' || !Array.isArray(b.warung)) return { ok: false, error: 'Hanya pemilik yang boleh sync penuh' };
    return cekPerangkatPemilik(au, b) || syncAll(db, au, b);
  }
  if (b.action === 'syncStaff') return a.peran !== 'karyawan' ? { ok: false, error: 'Bukan akun karyawan' } : syncStaff(db, au, b);
  if (b.action === 'createAccess' || b.action === 'setAccess' || b.action === 'resetDevice') {
    if (a.peran !== 'pemilik') return { ok: false, error: 'Hanya pemilik yang boleh mengatur akses' };
    if (b.action === 'createAccess') return createAccess(db, au, b);
    const x = await karyawan(db, au, b);
    if (!x) return { ok: false, error: 'Kode karyawan tidak ditemukan' };
    if (b.action === 'resetDevice') await db.setPerangkat(x.kode, '');
    else await db.setStatusAkses(a.tenant, x.kode, b.status === 'dicabut' ? 'dicabut' : 'aktif');
    return { ok: true };
  }
  return { ok: false, error: 'Aksi tidak dikenal' };
}

/* =====================  handler HTTP  ===================== */
async function handler(req, res) {
  const out = (code, obj) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');   // aman: otentikasi memakai kode di body, bukan cookie
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end(JSON.stringify(obj));
  };
  const hd = req.headers || {}, env = process.env;
  if (req.method === 'OPTIONS') return out(204, {});
  let db;
  try { db = getStore(env); await db.init(); } catch (e) { console.error('sync: database', e && e.message); return out(500, { ok: false, error: 'Database belum siap. Cek integrasi Neon di Vercel.' }); }
  if (req.method === 'GET') { try { await db.ping(); return out(200, { ok: true, server: 'Omset-WarMad sync', db: true }); } catch (e) { return out(500, { ok: false, error: 'Database tidak merespons' }); } }
  if (req.method !== 'POST') return out(405, { ok: false, error: 'Metode tidak diizinkan' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b !== 'object') return out(400, { ok: false, error: 'Permintaan tidak valid' });
  const ip = String(hd['x-real-ip'] || hd['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '?').split(',')[0].trim().slice(0, 64);

  try {
    if ((await db.gagalHitung(ip)) >= GAGAL_MAKS) return out(429, { ok: false, error: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' });

    if (b.action === 'register') {
      const r = await register(db, b);
      if (r.fail) await db.gagalCatat(ip);
      return out(200, { ok: r.ok, key: r.key, error: r.error });
    }

    const au = await authKey(db, b);
    if (au.error) {
      if (!au.revoked) await db.gagalCatat(ip);
      return out(200, { ok: false, error: au.error, revoked: !!au.revoked });
    }
    return out(200, await dispatch(db, b, au));
  } catch (e) {
    console.error('sync: error', e && e.stack || e);
    return out(500, { ok: false, error: 'Server sedang bermasalah. Data di HP tetap aman, coba lagi nanti.' });
  }
}

module.exports = handler;
module.exports._t = { setStore, randCode, rec, dedupe, clean, handler };
