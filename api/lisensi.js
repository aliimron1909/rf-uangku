/**
 * Server lisensi + pembayaran Midtrans Omset-WarMad (Vercel Function + Neon Postgres).
 * Pengganti Lisensi.gs / Google Sheet milik penjual. Protokol dengan aplikasi tidak berubah:
 *   createOrder, checkOrder, activate, check  (+ notifikasi Midtrans sebagai jalur cadangan)
 *
 * Variabel lingkungan (Vercel > Settings > Environment Variables, Production), lalu Redeploy:
 *   DATABASE_URL         dibuat otomatis oleh integrasi Neon
 *   MIDTRANS_SERVER_KEY  server key Midtrans (JANGAN ditaruh di kode / index.html)
 *   MIDTRANS_ENV         sandbox  (ganti production saat siap jualan)
 *   HARGA                harga Premium dalam rupiah, mis. 100000 (ditentukan di server, WAJIB diisi)
 * Notification URL di dashboard Midtrans (opsional, jalur cadangan): https://domain-kamu/api/lisensi
 */
'use strict';
const crypto = require('crypto');
const { getStore } = require('../lib/db.js');
const lic = require('../lib/lic.js');

const MAKS_ORDER_DEV = 5;     // pesanan baru per perangkat per 24 jam (pembeli asli memakai ulang pesanan yang masih pending)
const MAKS_ORDER_JAM = 40;    // pesanan baru untuk seluruh server per jam (penjualan nyata jauh di bawah ini)
const GAGAL_MAKS = 30;        // kode salah per IP per 10 menit

/* ---------- Midtrans ---------- */
function cfg(env) {
  const prod = env.MIDTRANS_ENV === 'production';
  return {
    key: String(env.MIDTRANS_SERVER_KEY || '').trim(), harga: Math.round(Number(env.HARGA)) || 0,
    snap: prod ? 'https://app.midtrans.com/snap/v1/transactions' : 'https://app.sandbox.midtrans.com/snap/v1/transactions',
    api: prod ? 'https://api.midtrans.com/v2/' : 'https://api.sandbox.midtrans.com/v2/'
  };
}
async function mt(url, method, body, c) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { method, signal: ctl.signal, headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(c.key + ':').toString('base64') }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let data = {}; try { data = JSON.parse(text); } catch (e) {}
    return { status: r.status, data, text };
  } finally { clearTimeout(t); }
}
const lunas = d => d.transaction_status === 'settlement' || (d.transaction_status === 'capture' && d.fraud_status !== 'deny' && d.fraud_status !== 'challenge');
const nominalSama = (gross, harga) => Math.round(parseFloat(gross)) === Number(harga);

function orderId() {   // WM-yyMMddHHmmss-XXXX, jam Jakarta
  const w = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(/\D/g, '').slice(2, 14);
  return 'WM-' + w + '-' + crypto.randomBytes(3).toString('hex').slice(0, 4).toUpperCase();
}

/* ---------- pesanan ---------- */
async function createOrder(db, env, b) {
  const c = cfg(env), dev = String(b.device || '').slice(0, 40);
  if (!c.key) return { ok: false, error: 'Server pembayaran belum diatur' };
  if (!c.harga) return { ok: false, error: 'Harga Premium belum diatur di server' };
  if (!lic.validDevice(dev)) return { ok: false, error: 'Data tidak lengkap' };
  await db.ordCleanup();   // hapus pesanan belum dibayar yang lebih dari 7 hari
  const ulang = await db.ordReusable(dev, 30 * 60000);   // pakai ulang pesanan pending < 30 menit
  if (ulang) return { ok: true, order: ulang.id, url: ulang.url };
  if ((await db.ordCount(dev, 864e5)) >= MAKS_ORDER_DEV) return { ok: false, error: 'Terlalu banyak percobaan pesanan dari perangkat ini. Coba lagi besok atau hubungi admin.' };
  if ((await db.ordCount(null, 36e5)) >= MAKS_ORDER_JAM) {
    await db.logAdd('Pembuatan pesanan melewati ' + MAKS_ORDER_JAM + ' per jam, ditahan', 36e5);
    return { ok: false, error: 'Pembayaran sedang padat. Coba lagi beberapa menit lagi atau hubungi admin.' };
  }
  const id = orderId();
  const r = await mt(c.snap, 'POST', {
    transaction_details: { order_id: id, gross_amount: c.harga },
    item_details: [{ id: 'premium', price: c.harga, quantity: 1, name: 'Omset-WarMad Premium' }],
    expiry: { unit: 'minutes', duration: 60 }
  }, c);
  if (!r.data.redirect_url) {
    const m = (r.data.error_messages || []).join(', ') || r.data.status_message || String(r.text || '').replace(/\s+/g, ' ').slice(0, 120);
    return { ok: false, error: 'Midtrans (' + r.status + '): ' + m };
  }
  await db.ordInsert({ id, device: dev, jumlah: c.harga, url: r.data.redirect_url });
  return { ok: true, order: id, url: r.data.redirect_url };
}

async function lunasi(db, o, statusMidtrans) {   // idempotent, satu transaksi
  return db.markPaid(o.id, statusMidtrans, lic.randCode('WARMAD'));
}

async function checkOrder(db, env, b) {
  const c = cfg(env), id = String(b.order || ''), o = await db.ordGet(id);
  if (!o || o.device !== String(b.device)) return { ok: false, error: 'Pesanan tidak ditemukan' };
  if (o.status === 'paid' && o.kode) return { ok: true, paid: true, code: o.kode };
  if (o.status === 'gagal') return { ok: true, paid: false, failed: true };
  if (!c.key) return { ok: false, error: 'Server pembayaran belum diatur' };
  const r = await mt(c.api + encodeURIComponent(id) + '/status', 'GET', null, c);
  if (r.status === 404 || !r.data.transaction_status) return { ok: true, paid: false, pending: true };
  const d = r.data;
  if (lunas(d)) {
    if (!nominalSama(d.gross_amount, o.jumlah)) return { ok: false, error: 'Nominal tidak sesuai' };
    return { ok: true, paid: true, code: await lunasi(db, o, d.transaction_status) };
  }
  if (['expire', 'cancel', 'deny', 'failure'].indexOf(d.transaction_status) >= 0) {
    await db.ordSet(id, 'gagal', d.transaction_status);
    return { ok: true, paid: false, failed: true };
  }
  return { ok: true, paid: false, pending: true };
}

// Jalur cadangan: notifikasi (webhook) dari Midtrans, diverifikasi dengan signature (SHA-512)
async function webhook(db, env, b) {
  const c = cfg(env), o = await db.ordGet(String(b.order_id || ''));
  if (!o || !c.key) return 'ignored';
  const sig = crypto.createHash('sha512').update(String(b.order_id) + b.status_code + b.gross_amount + c.key).digest('hex');
  const a = Buffer.from(sig), z = Buffer.from(String(b.signature_key || ''));
  if (a.length !== z.length || !crypto.timingSafeEqual(a, z)) return 'ignored';
  if (lunas(b) && nominalSama(b.gross_amount, o.jumlah)) await lunasi(db, o, b.transaction_status);
  return 'OK';
}

/* ---------- lisensi ---------- */
async function license(db, b) {
  const code = lic.upper(b.code), dev = String(b.device || '').slice(0, 40);
  if (!code || !dev) return { ok: false, error: 'Data tidak lengkap' };
  if (b.action === 'check') return lic.cek(await db.licGet(code), dev);   // perangkat harus pernah diaktifkan, agar batas maks_perangkat tidak bisa dilewati
  if (b.action !== 'activate') return { ok: false, error: 'Aksi tidak dikenal' };
  return db.licTx(code, row => lic.aktivasi(row, dev));
}

/* ---------- HTTP ---------- */
async function handler(req, res) {
  const send = (code, obj, text) => {
    res.statusCode = code; res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (text !== undefined) { res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end(text); } else { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); }
  };
  const hd = req.headers || {}, env = process.env;
  if (req.method === 'OPTIONS') return send(204, {});
  let db;
  try { db = getStore(env); await db.init(); } catch (e) { console.error('lisensi: database', e && e.message); return send(500, { ok: false, error: 'Database belum siap. Cek integrasi Neon di Vercel.' }); }
  if (req.method === 'GET') return send(200, { ok: true, server: 'Server lisensi Omset-WarMad aktif' });
  if (req.method !== 'POST') return send(405, { ok: false, error: 'Metode tidak diizinkan' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b !== 'object') return send(400, { ok: false, error: 'Permintaan tidak valid' });
  const ip = String(hd['x-real-ip'] || hd['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '?').split(',')[0].trim().slice(0, 64);

  try {
    if (b.signature_key && b.order_id) return send(200, null, await webhook(db, env, b));   // Midtrans butuh balasan teks "OK"
    if (b.action === 'createOrder') return send(200, await createOrder(db, env, b));
    if (b.action === 'checkOrder') return send(200, await checkOrder(db, env, b));
    if (b.action === 'activate' || b.action === 'check') {
      if (b.action === 'activate' && (await db.gagalHitung(ip)) >= GAGAL_MAKS) return send(429, { ok: false, error: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' });
      const r = await license(db, b);
      if (r.gagal) { await db.gagalCatat(ip); delete r.gagal; }
      return send(200, r);
    }
    return send(200, { ok: false, error: 'Aksi tidak dikenal' });
  } catch (e) {
    console.error('lisensi: error', e && e.stack || e);
    return send(500, { ok: false, error: 'Server sedang bermasalah. Coba lagi nanti.' });
  }
}

module.exports = handler;
module.exports._t = { handler, orderId, cfg };
  
