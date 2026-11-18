/**
 * Server panel admin Omset-WarMad (Vercel Function).
 *
 * Browser TIDAK PERNAH memegang kunci apa pun. Alurnya:
 *   admin.html -> /api/admin (login + cookie sesi) -> database Neon (DATABASE_URL, hanya ada di server)
 *
 * Variabel lingkungan (Vercel > Settings > Environment Variables), WAJIB kecuali yang diberi tanda:
 *   ADMIN_PASSWORD     kata sandi panel, minimal 12 karakter
 *   SESSION_SECRET     string acak, minimal 32 karakter (dipakai menandatangani cookie sesi)
 *   DATABASE_URL       dibuat otomatis oleh integrasi Neon
 *   ADMIN_TOTP_SECRET  (opsional) kunci 2FA base32 untuk aplikasi authenticator; bila diisi, login wajib kode 6 digit
 *   LICENSE_URL + ADMIN_KEY  (hanya untuk tombol "Pindahkan lisensi lama" satu kali; boleh dihapus setelah selesai)
 */
'use strict';
const crypto = require('crypto');
const { getStore, setStore } = require('../lib/db.js');
const lic = require('../lib/lic.js');

const COOKIE = '__Host-wm_admin';   // awalan __Host- = hanya HTTPS, tanpa Domain, path "/"
const TTL = 12 * 3600;              // sesi berlaku 12 jam
const MAX_GAGAL = 5, KUNCI_MS = 15 * 60 * 1000;
const gagal = new Map();            // ip -> { n, sampai } (upaya terbaik per instance; andalkan juga aturan Rate Limit di Vercel Firewall)

/* ---------- util kripto ---------- */
const b64u = x => Buffer.from(x).toString('base64url');
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const sama = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));   // dibandingkan lewat hash: waktu tetap, panjang tidak bocor
const tandai = (p, secret) => b64u(crypto.createHmac('sha256', secret).update(p).digest());
function buatToken(secret, now) { const p = b64u(JSON.stringify({ exp: now + TTL * 1000, n: crypto.randomBytes(8).toString('hex') })); return p + '.' + tandai(p, secret); }
function cekToken(tok, secret, now) {
  const [p, s] = String(tok || '').split('.');
  if (!p || !s) return false;
  const e = tandai(p, secret);
  if (e.length !== s.length || !crypto.timingSafeEqual(Buffer.from(e), Buffer.from(s))) return false;
  try { return JSON.parse(Buffer.from(p, 'base64url').toString()).exp > now; } catch (x) { return false; }
}
function b32(s) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = ''; const out = [];
  for (const c of String(s).toUpperCase().replace(/[\s=-]/g, '')) { const v = A.indexOf(c); if (v < 0) throw new Error('base32 tidak valid'); bits += v.toString(2).padStart(5, '0'); }
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
function totp(secret, t, step = 30, digits = 6) {   // RFC 6238
  const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(t / 1000 / step)));
  const h = crypto.createHmac('sha1', b32(secret)).update(ctr).digest(), o = h[h.length - 1] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** digits).padStart(digits, '0');
}
const totpOk = (secret, kode, now) => /^\d{6}$/.test(String(kode)) && [-1, 0, 1].map(d => sama(totp(secret, now + d * 30000), kode)).some(Boolean);

/* ---------- operasi yang diizinkan (daftar putih) + pembersihan masukan ---------- */
const str = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
const num = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const wajib = (cond, pesan) => { if (!cond) throw new Error(pesan); };   // masukan tidak valid = ditolak, tidak ditebak
const kodeOf = a => { const k = str(a.kode, 40).trim(); wajib(k, 'Kode wajib diisi'); return k; };
const OPS = {
  stats: () => ({ action: 'adm_stats' }),
  list: a => ({ action: 'adm_list', q: str(a.q, 60), status: a.status === 'aktif' || a.status === 'dicabut' ? a.status : '', limit: num(a.limit, 1, 50, 20), offset: num(a.offset, 0, 100000, 0) }),
  set: a => { wajib(a.status === 'aktif' || a.status === 'dicabut', 'Status tidak valid'); return { action: 'adm_set', kode: kodeOf(a), status: a.status }; },
  reset: a => ({ action: 'adm_reset', kode: kodeOf(a) }),
  maks: a => ({ action: 'adm_maks', kode: kodeOf(a), maks: num(a.maks, 1, 10, 3) }),
  create: a => ({ action: 'adm_create', n: num(a.n, 1, 20, 1), pembeli: str(a.pembeli, 60) }),
  orders: a => ({ action: 'adm_orders', limit: num(a.limit, 1, 50, 20) }),
  log: () => ({ action: 'adm_log' }),
  pembeli: a => ({ action: 'adm_pembeli', q: str(a.q, 60), limit: num(a.limit, 1, 50, 20), offset: num(a.offset, 0, 100000, 0) }),
  impor: a => ({ action: 'adm_impor', offset: num(a.offset, 0, 100000, 0) })
};

/* ---------- operasi admin: langsung ke database ---------- */
const kodeUp = p => lic.upper(p.kode);
const keAdmin = x => ({ kode: x.kode, pembeli: x.pembeli, status: x.status, maks: x.maks, perangkat: x.perangkat, aktif_pertama: x.aktifPertama, catatan: x.catatan });

async function imporLama(db, env, offset) {   // satu kali: salin lisensi dari Apps Script/Google Sheet lama ke Neon (aman diulang)
  if (!String(env.LICENSE_URL || '').startsWith('https://script.google.com/') || String(env.ADMIN_KEY || '').length < 32)
    return { ok: false, error: 'Impor butuh LICENSE_URL dan ADMIN_KEY lama di Vercel (yang dulu dipakai panel admin)' };
  const mulai = Date.now(); let off = offset, total = Infinity, masuk = 0, dibaca = 0;
  while (off < total && Date.now() - mulai < 18000) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
    let j;
    try {
      const r = await fetch(env.LICENSE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'adm_list', adminKey: env.ADMIN_KEY, limit: 50, offset: off }), signal: ctl.signal, redirect: 'follow' });
      j = JSON.parse(await r.text());
    } catch (x) { return { ok: false, error: 'Server lisensi lama tidak merespons. Coba lagi.', diproses: dibaca, masuk, lanjut: off }; } finally { clearTimeout(t); }
    if (!j || !j.ok) return { ok: false, error: (j && j.error) || 'Balasan server lama tidak valid', diproses: dibaca, masuk, lanjut: off };
    total = j.total; if (!j.items.length) break;
    const now = Date.now();
    masuk += await db.licInsert(j.items.map((x, i) => ({
      kode: lic.upper(x.kode), pembeli: String(x.pembeli || '').slice(0, 60), status: x.status === 'aktif' ? 'aktif' : 'dicabut', maks: Math.max(1, Math.min(10, Number(x.maks) || 3)),
      perangkat: Array.isArray(x.perangkat) ? x.perangkat.map(String).slice(0, 10) : [], aktifPertama: x.aktif_pertama || null, catatan: String(x.catatan || '').slice(0, 200),
      dibuat: new Date(now - (off + i) * 1000).toISOString()   // urutan lama (terbaru dulu) tetap terjaga
    })));
    dibaca += j.items.length; off += j.items.length;
  }
  return { ok: true, total, diproses: dibaca, masuk, selesai: off >= total, lanjut: off >= total ? null : off };
}

async function jalankan(db, p, env) {
  switch (p.action) {
    case 'adm_stats': {
      const L = await db.licStats(), O = await db.ordStats(), T = await db.tenantStats();
      return { ok: true, lisensi: { total: L.total, aktif: L.aktif, dicabut: L.total - L.aktif, perangkat: L.perangkat },
        penjualan: { semua: O.semua, hari_ini: O.hari_ini, tujuh_hari: O.tujuh_hari, tiga_puluh_hari: O.tiga_puluh_hari }, pesanan: { pending: O.pending, gagal: O.gagal }, cloud: T };
    }
    case 'adm_list': { const r = await db.licList({ q: p.q, status: p.status, limit: p.limit, offset: p.offset }); return { ok: true, total: r.total, items: r.items.map(keAdmin) }; }
    case 'adm_set': case 'adm_reset': case 'adm_maks': {
      return db.licTx(kodeUp(p), row => {
        if (!row) return { result: { ok: false, error: 'Kode tidak ditemukan' } };
        const patch = p.action === 'adm_set' ? { status: p.status } : p.action === 'adm_reset' ? { perangkat: [] } : { maks: Math.max(1, Math.min(10, Math.round(Number(p.maks)) || lic.MAKS_DEFAULT)) };
        return { patch, result: { ok: true } };
      });
    }
    case 'adm_create': {
      const kode = Array.from({ length: p.n }, () => lic.randCode('WARMAD'));
      const n = await db.licInsertBaru(kode, p.pembeli);
      return n === kode.length ? { ok: true, kode } : { ok: false, error: 'Bentrok kode acak, coba lagi' };
    }
    case 'adm_orders': return { ok: true, items: (await db.ordList(p.limit)).map(o => ({ order_id: o.id, device: o.device, status: o.status, jumlah: o.jumlah, dibuat: o.dibuat, dibayar: o.dibayar, kode: o.kode, status_midtrans: o.statusMidtrans })) };
    case 'adm_log': return { ok: true, items: await db.logList(30) };
    case 'adm_pembeli': return { ok: true, ...(await db.tenantList({ q: p.q, limit: p.limit, offset: p.offset })) };
    case 'adm_impor': return imporLama(db, env, p.offset);
  }
  return { ok: false, error: 'Aksi admin tidak dikenal' };
}

const wait = ms => new Promise(r => setTimeout(r, ms));
const bacaCookie = h => { for (const c of String(h || '').split(/;\s*/)) { const i = c.indexOf('='); if (i > 0 && c.slice(0, i) === COOKIE) return c.slice(i + 1); } return ''; };

async function handler(req, res) {
  const out = (code, obj, extra) => {
    res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
    for (const k in (extra || {})) res.setHeader(k, extra[k]);
    res.end(JSON.stringify(obj));
  };
  const hd = req.headers || {}, now = Date.now(), env = process.env;

  if (req.method !== 'POST') return out(405, { ok: false, error: 'Metode tidak diizinkan' }, { Allow: 'POST' });
  // Perlindungan CSRF berlapis: cookie SameSite=Strict + header khusus + cek Origin
  if (hd['x-wm-admin'] !== '1') return out(403, { ok: false, error: 'Permintaan ditolak' });
  if (hd.origin) { let host = ''; try { host = new URL(hd.origin).host; } catch (x) {} if (host !== hd.host) return out(403, { ok: false, error: 'Permintaan ditolak' }); }

  const ok = String(env.ADMIN_PASSWORD || '').length >= 12 && String(env.SESSION_SECRET || '').length >= 32;
  if (!ok) { console.error('Panel admin belum dikonfigurasi lengkap (cek variabel lingkungan)'); return out(500, { ok: false, error: 'Panel admin belum dikonfigurasi' }); }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (x) { body = null; } }
  if (!body || typeof body !== 'object') return out(400, { ok: false, error: 'Permintaan tidak valid' });
  const op = typeof body.op === 'string' ? body.op : '';

  if (op === 'login') {
    const ip = String(hd['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '?').split(',')[0].trim(), g = gagal.get(ip) || { n: 0, sampai: 0 };
    if (g.sampai > now) return out(429, { ok: false, error: 'Terlalu banyak percobaan. Coba lagi nanti.' });
    const pw = str(body.password, 200), kode = str(body.kode, 10);
    const benar = sama(pw, env.ADMIN_PASSWORD) & (env.ADMIN_TOTP_SECRET ? totpOk(env.ADMIN_TOTP_SECRET, kode, now) : true);   // & (bukan &&): kedua faktor selalu dihitung
    if (!benar) {
      g.n++; if (g.n >= MAX_GAGAL) { g.n = 0; g.sampai = now + KUNCI_MS; } gagal.set(ip, g);
      await wait(Number(env.ADMIN_FAIL_DELAY_MS ?? 800));
      return out(401, { ok: false, error: 'Login gagal' });
    }
    gagal.delete(ip);
    return out(200, { ok: true }, { 'Set-Cookie': COOKIE + '=' + buatToken(env.SESSION_SECRET, now) + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=' + TTL });
  }
  if (op === 'logout') return out(200, { ok: true }, { 'Set-Cookie': COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' });

  if (!cekToken(bacaCookie(hd.cookie), env.SESSION_SECRET, now)) return out(401, { ok: false, login: true, error: 'Sesi berakhir, silakan masuk lagi' });
  if (op === 'me') return out(200, { ok: true });

  const bangun = OPS[op];
  if (!bangun) return out(400, { ok: false, error: 'Operasi tidak dikenal' });
  let payload;
  try { payload = bangun(body.args && typeof body.args === 'object' ? body.args : {}); } catch (x) { return out(400, { ok: false, error: x.message }); }
  let hasil;
  try { const db = getStore(env); await db.init(); hasil = await jalankan(db, payload, env); }
  catch (x) { console.error('admin: error', x && x.stack || x); return out(500, { ok: false, error: 'Database bermasalah. Cek integrasi Neon di Vercel.' }); }
  return out(200, hasil && typeof hasil === 'object' ? hasil : { ok: false, error: 'Balasan tidak valid' });
}

module.exports = handler;
module.exports._t = { totp, b32, buatToken, cekToken, gagal, COOKIE, OPS, setStore };
