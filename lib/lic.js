/**
 * Logika lisensi murni (tanpa database), dipakai bersama oleh api/lisensi.js dan api/sync.js.
 * Perilaku dan teks galat sama dengan Lisensi.gs lama supaya aplikasi di HP tidak perlu berubah.
 */
'use strict';
const crypto = require('crypto');

const MAKS_DEFAULT = 3;
const upper = v => String(v || '').trim().toUpperCase();

function randCode(prefix) {   // 12 karakter acak (60 bit), tanpa I/O/0/1 agar tidak tertukar
  const ch = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = crypto.randomBytes(12), out = [];
  for (let p = 0; p < 3; p++) { let t = ''; for (let i = 0; i < 4; i++) t += ch[b[p * 4 + i] & 31]; out.push(t); }
  return prefix + '-' + out.join('-');
}

/** Pemeriksaan baca saja (aksi "check"). row = baris lisensi atau null. */
function cek(row, dev) {
  if (!row) return { ok: false, revoked: true, error: 'Kode tidak ditemukan' };
  if (row.status !== 'aktif') return { ok: false, revoked: true, error: 'Lisensi sudah dicabut' };
  if (row.perangkat.indexOf(dev) < 0) return { ok: false, revoked: true, error: 'Perangkat ini belum terdaftar untuk kode tersebut' };
  return { ok: true, buyer: row.pembeli };
}

/** Aktivasi: dipakai sebagai fn di db.licTx(kode, fn). Mengembalikan { patch?, result }. */
function aktivasi(row, dev) {
  if (!row) return { result: { ok: false, revoked: false, error: 'Kode tidak ditemukan', gagal: true } };
  if (row.status !== 'aktif') return { result: { ok: false, revoked: true, error: 'Lisensi sudah dicabut' } };
  const list = row.perangkat.slice(), maks = Number(row.maks) || MAKS_DEFAULT;
  if (list.indexOf(dev) >= 0) return { result: { ok: true, buyer: row.pembeli } };
  if (list.length >= maks) return { result: { ok: false, error: 'Kode sudah dipakai di ' + maks + ' perangkat. Hubungi admin.' } };
  list.push(dev);
  return { patch: { perangkat: list, aktifPertama: true }, result: { ok: true, buyer: row.pembeli } };
}

const validDevice = d => /^[A-Za-z0-9]{6,40}$/.test(String(d || ''));
const validCode = c => /^[A-Z0-9-]{6,40}$/.test(c);

module.exports = { MAKS_DEFAULT, upper, randCode, cek, aktivasi, validDevice, validCode };
