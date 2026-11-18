/**
 * Omset-WarMad - SERVER LISENSI + PEMBAYARAN OTOMATIS MIDTRANS (milik PENJUAL)
 *
 * Pasang di Google Sheet TERPISAH milik Anda: Extensions > Apps Script > tempel > Save.
 * Project Settings (ikon gerigi) > Script properties > tambahkan:
 *    MIDTRANS_SERVER_KEY = server key Midtrans (JANGAN ditaruh di kode / index.html)
 *    MIDTRANS_ENV        = sandbox   (ganti production saat siap jualan)
 *    HARGA               = 50000     (harga Premium dalam rupiah, ditentukan di server)
 * Deploy > New deployment > Web app | Execute as: Me | Who has access: Anyone
 * Salin URL /exec ke LICENSE_URL di index.html.
 *
 * Alur: aplikasi minta pesanan > server buat transaksi Midtrans (Snap) > pembeli bayar QRIS >
 * aplikasi cek status ke server > server cek ke Midtrans > bila lunas, kode lisensi dibuat otomatis.
 * (Opsional) Notification URL Midtrans = URL /exec ini, sebagai jalur cadangan.
 *
 * Sheet otomatis: "Lisensi" (kode) dan "Pesanan" (riwayat pembayaran).
 */
const TZ = 'Asia/Jakarta';
const H_LIC = ['kode', 'pembeli', 'status', 'maks_perangkat', 'perangkat', 'aktif_pertama', 'catatan'];
const H_ORD = ['order_id', 'device', 'status', 'jumlah', 'dibuat', 'dibayar', 'kode', 'status_midtrans', 'url'];
const MAKS_DEFAULT = 3;
const MAKS_ORDER_DEV = 5;    // pesanan baru per perangkat per 24 jam (pembeli asli memakai ulang pesanan yang masih pending)
const MAKS_ORDER_JAM = 40;   // pesanan baru untuk seluruh server per jam (penjualan nyata jauh di bawah ini)

function sh_(name, head) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const s = ss.getSheetByName(name) || ss.insertSheet(name);
  if (s.getLastRow() === 0) { s.appendRow(head); s.setFrozenRows(1); }
  return s;
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function parse_(v) { try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; } }

/* ---------- konfigurasi & Midtrans ---------- */
function cfg_() {
  const p = PropertiesService.getScriptProperties().getProperties();
  const prod = p.MIDTRANS_ENV === 'production';
  return {
    key: String(p.MIDTRANS_SERVER_KEY || '').trim(), harga: Number(p.HARGA) || 50000,
    snap: prod ? 'https://app.midtrans.com/snap/v1/transactions' : 'https://app.sandbox.midtrans.com/snap/v1/transactions',
    api: prod ? 'https://api.midtrans.com/v2/' : 'https://api.sandbox.midtrans.com/v2/'
  };
}
function mt_(url, method, body, c) {
  const opt = {
    method: method, contentType: 'application/json', muteHttpExceptions: true,
    headers: { Accept: 'application/json', Authorization: 'Basic ' + Utilities.base64Encode(c.key + ':') }
  };
  if (body) opt.payload = JSON.stringify(body);
  const r = UrlFetchApp.fetch(url, opt);
  const txt = r.getContentText();
  let d = {}; try { d = JSON.parse(txt); } catch (e) {}
  return { status: r.getResponseCode(), data: d, text: txt };
}
function hex_(bytes) { return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join(''); }
function randCode_(prefix, parts) {   // kode acak aman (SHA-256 dari UUID acak), 5 bit per karakter tanpa bias
  const ch = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // tepat 32 karakter, tanpa I/O/0/1 agar tidak tertukar
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid());
  const out = [];
  for (let p = 0; p < parts; p++) { let t = ''; for (let i = 0; i < 4; i++) t += ch[d[p * 4 + i] & 31]; out.push(t); }
  return prefix + '-' + out.join('-');
}
// Catat percobaan aktivasi dengan kode salah. Apps Script tidak bisa melihat IP, jadi tidak ada kunci total
// (penyerang bisa mengunci pembeli asli). Perlindungan utamanya kode panjang acak; di sini hanya pencatatan di sheet "Log".
function gagal_(apa) {
  apa = apa || 'aktivasi kode';
  const c = CacheService.getScriptCache(), key = 'bad_' + apa, n = (Number(c.get(key)) || 0) + 1;
  c.put(key, String(n), 600);
  if (n === 30) sh_('Log', ['waktu', 'kejadian']).appendRow([new Date(), '30 percobaan ' + apa + ' salah dalam 10 menit']);
}

/* ---------- pesanan ---------- */
function findOrder_(s, id) {
  const v = s.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (String(v[i][0]) === id) return { row: i + 1, v: v[i] };
  return null;
}
function newCode_(buyer, device) {
  const s = sh_('Lisensi', H_LIC), used = s.getDataRange().getValues().map(r => String(r[0]));
  let code; do { code = randCode_('WARMAD', 3); } while (used.indexOf(code) >= 0);   // 12 karakter acak
  s.appendRow([code, buyer, 'aktif', MAKS_DEFAULT, JSON.stringify([device]), new Date(), 'otomatis']);
  return code;
}
function markPaid_(s, o, midStatus) { // idempotent
  if (o.v[2] === 'paid' && o.v[6]) return o.v[6];
  const code = newCode_('Midtrans ' + o.v[0], o.v[1]);
  s.getRange(o.row, 3, 1, 6).setValues([['paid', o.v[3], o.v[4], new Date(), code, midStatus]]);
  return code;
}
function lunas_(d) { return d.transaction_status === 'settlement' || (d.transaction_status === 'capture' && d.fraud_status !== 'deny' && d.fraud_status !== 'challenge'); }

function bersih_(s) {   // hapus pesanan belum dibayar yang lebih dari 7 hari, paling sering sekali per 6 jam
  const c = CacheService.getScriptCache();
  if (c.get('bersih')) return;
  c.put('bersih', '1', 21600);
  const v = s.getDataRange().getValues(), batas = Date.now() - 7 * 864e5;
  for (let i = v.length - 1; i >= 1; i--) {
    const st = String(v[i][2]), t = new Date(v[i][4]).getTime();
    if ((st === 'pending' || st === 'gagal') && t < batas) s.deleteRow(i + 1);
  }
}

function createOrder_(b) {
  const c = cfg_(), dev = String(b.device || '').slice(0, 40);
  if (!c.key) return { ok: false, error: 'Server pembayaran belum diatur' };
  if (!/^[A-Za-z0-9]{6,40}$/.test(dev)) return { ok: false, error: 'Data tidak lengkap' };
  const s = sh_('Pesanan', H_ORD);
  bersih_(s);
  const v = s.getDataRange().getValues();
  for (let i = v.length - 1; i >= 1; i--) { // pakai ulang pesanan pending < 30 menit
    if (v[i][1] === dev && v[i][2] === 'pending' && v[i][8] && (new Date() - new Date(v[i][4])) < 30 * 60000)
      return { ok: true, order: v[i][0], url: v[i][8] };
  }
  // batas per perangkat (24 jam)
  const sehari = Date.now() - 864e5;
  let nDev = 0;
  for (let i = 1; i < v.length; i++) if (v[i][1] === dev && new Date(v[i][4]).getTime() > sehari) nDev++;
  if (nDev >= MAKS_ORDER_DEV) return { ok: false, error: 'Terlalu banyak percobaan pesanan dari perangkat ini. Coba lagi besok atau hubungi admin.' };
  // batas seluruh server per jam (jendela tetap per jam, bukan geser, agar serangan tidak mengunci selamanya)
  const ch = CacheService.getScriptCache(), kj = 'ord' + Math.floor(Date.now() / 36e5), tot = (Number(ch.get(kj)) || 0) + 1;
  ch.put(kj, String(tot), 7200);
  if (tot > MAKS_ORDER_JAM) {
    if (tot === MAKS_ORDER_JAM + 1) sh_('Log', ['waktu', 'kejadian']).appendRow([new Date(), 'Pembuatan pesanan melewati ' + MAKS_ORDER_JAM + ' per jam, ditahan']);
    return { ok: false, error: 'Pembayaran sedang padat. Coba lagi beberapa menit lagi atau hubungi admin.' };
  }
  const id = 'WM-' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const r = mt_(c.snap, 'post', {
    transaction_details: { order_id: id, gross_amount: c.harga },
    item_details: [{ id: 'premium', price: c.harga, quantity: 1, name: 'Omset-WarMad Premium' }],
    expiry: { unit: 'minutes', duration: 60 }
  }, c);
  if (!r.data.redirect_url) {
    const m = (r.data.error_messages || []).join(', ') || r.data.status_message || String(r.text || '').replace(/\s+/g, ' ').slice(0, 120);
    return { ok: false, error: 'Midtrans (' + r.status + '): ' + m };
  }
  s.appendRow([id, dev, 'pending', c.harga, new Date(), '', '', '', r.data.redirect_url]);
  return { ok: true, order: id, url: r.data.redirect_url };
}

function checkOrder_(b) {
  const c = cfg_(), s = sh_('Pesanan', H_ORD), id = String(b.order || ''), o = findOrder_(s, id);
  if (!o || o.v[1] !== String(b.device)) return { ok: false, error: 'Pesanan tidak ditemukan' };
  if (o.v[2] === 'paid' && o.v[6]) return { ok: true, paid: true, code: o.v[6] };
  if (o.v[2] === 'gagal') return { ok: true, paid: false, failed: true };
  const r = mt_(c.api + encodeURIComponent(id) + '/status', 'get', null, c);
  if (r.status === 404 || !r.data.transaction_status) return { ok: true, paid: false, pending: true };
  const d = r.data;
  if (lunas_(d)) {
    if (Math.round(parseFloat(d.gross_amount)) !== Number(o.v[3])) return { ok: false, error: 'Nominal tidak sesuai' };
    return { ok: true, paid: true, code: markPaid_(s, o, d.transaction_status) };
  }
  if (['expire', 'cancel', 'deny', 'failure'].indexOf(d.transaction_status) >= 0) {
    s.getRange(o.row, 3).setValue('gagal'); s.getRange(o.row, 8).setValue(d.transaction_status);
    return { ok: true, paid: false, failed: true };
  }
  return { ok: true, paid: false, pending: true };
}

// Jalur cadangan: notifikasi (webhook) dari Midtrans, diverifikasi dengan signature
function webhook_(b) {
  const c = cfg_(), s = sh_('Pesanan', H_ORD), o = findOrder_(s, String(b.order_id || ''));
  const sig = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_512, String(b.order_id) + b.status_code + b.gross_amount + c.key));
  if (!o || sig !== b.signature_key) return 'ignored';
  if (lunas_(b) && Math.round(parseFloat(b.gross_amount)) === Number(o.v[3])) markPaid_(s, o, b.transaction_status);
  return 'OK';
}

/* ---------- lisensi ---------- */
function license_(b) {
  const code = String(b.code || '').trim().toUpperCase(), dev = String(b.device || '').slice(0, 40);
  if (!code || !dev) return { ok: false, error: 'Data tidak lengkap' };
  const s = sh_('Lisensi', H_LIC), vals = s.getDataRange().getValues();
  let row = -1;
  for (let i = 1; i < vals.length; i++) if (String(vals[i][0]).trim().toUpperCase() === code) { row = i; break; }
  if (row < 0) { if (b.action === 'activate') gagal_(); return { ok: false, revoked: b.action === 'check', error: 'Kode tidak ditemukan' }; }
  const r = vals[row];
  if (String(r[2]).trim().toLowerCase() !== 'aktif') return { ok: false, revoked: true, error: 'Lisensi sudah dicabut' };
  const list = parse_(r[4]), maks = Number(r[3]) || MAKS_DEFAULT;
  if (b.action === 'check') {   // perangkat harus pernah diaktifkan, agar batas maks_perangkat tidak bisa dilewati
    if (list.indexOf(dev) < 0) return { ok: false, revoked: true, error: 'Perangkat ini belum terdaftar untuk kode tersebut' };
    return { ok: true, buyer: r[1] };
  }
  if (b.action !== 'activate') return { ok: false, error: 'Aksi tidak dikenal' };
  if (list.indexOf(dev) < 0) {
    if (list.length >= maks) return { ok: false, error: 'Kode sudah dipakai di ' + maks + ' perangkat. Hubungi admin.' };
    list.push(dev);
    s.getRange(row + 1, 5).setValue(JSON.stringify(list));
    if (!r[5]) s.getRange(row + 1, 6).setValue(new Date());
  }
  return { ok: true, buyer: r[1] };
}

/* ---------- endpoint ---------- */
function doGet() { return ContentService.createTextOutput('Server lisensi Omset-WarMad aktif'); }

function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Permintaan tidak valid' }); }
  if (!b || typeof b !== 'object') return json_({ ok: false, error: 'Permintaan tidak valid' });
  const adm = typeof b.action === 'string' && b.action.indexOf('adm_') === 0;
  if (adm && !adminOk_(b.adminKey)) { gagal_('kunci admin'); return json_({ ok: false, error: 'Tidak diizinkan' }); }   // tolak cepat, tanpa antre di lock
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    if (b.signature_key && b.order_id) return ContentService.createTextOutput(webhook_(b));
    if (adm) return json_(admin_(b));
    if (b.action === 'createOrder') return json_(createOrder_(b));
    if (b.action === 'checkOrder') return json_(checkOrder_(b));
    return json_(license_(b));
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally { try { lock.releaseLock(); } catch (x) {} }
}

/* ---------- PANEL ADMIN: hanya dipanggil oleh server Vercel (api/admin.js) ---------- */
// Wajib: Script properties > ADMIN_KEY (minimal 32 karakter acak, sama persis dengan ADMIN_KEY di Vercel). Tanpa itu semua aksi adm_* ditolak.
function adminOk_(k) {
  const real = String(PropertiesService.getScriptProperties().getProperty('ADMIN_KEY') || '');
  if (real.length < 32 || typeof k !== 'string') return false;
  const h = x => hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, x));
  return h(k) === h(real);   // dibandingkan lewat hash agar tidak bocor lewat waktu respons
}
function iso_(v) { const d = v instanceof Date ? v : (v ? new Date(v) : null); return d && !isNaN(d) ? d.toISOString() : ''; }
function admin_(b) {
  const lim = (n, def, max) => Math.max(1, Math.min(max, Math.round(Number(n)) || def));
  const code = () => String(b.kode || '').trim().toUpperCase();
  const ls = sh_('Lisensi', H_LIC);
  const rowOf = kode => { const v = ls.getDataRange().getValues(); for (let i = 1; i < v.length; i++) if (String(v[i][0]).trim().toUpperCase() === kode) return i + 1; return -1; };
  const lic = () => ls.getDataRange().getValues().slice(1);
  const ord = () => sh_('Pesanan', H_ORD).getDataRange().getValues().slice(1);
  switch (b.action) {
    case 'adm_stats': {
      const L = lic(), O = ord(), paid = O.filter(r => String(r[2]) === 'paid'), today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
      const sum = rows => ({ jumlah: rows.length, total: rows.reduce((a, r) => a + (Number(r[3]) || 0), 0) });
      const dalam = hari => paid.filter(r => new Date(r[5]).getTime() > Date.now() - hari * 864e5);
      const aktif = L.filter(r => String(r[2]).trim().toLowerCase() === 'aktif').length;
      return { ok: true,
        lisensi: { total: L.length, aktif: aktif, dicabut: L.length - aktif, perangkat: L.reduce((a, r) => a + parse_(r[4]).length, 0) },
        penjualan: { semua: sum(paid), hari_ini: sum(paid.filter(r => r[5] && Utilities.formatDate(new Date(r[5]), TZ, 'yyyy-MM-dd') === today)), tujuh_hari: sum(dalam(7)), tiga_puluh_hari: sum(dalam(30)) },
        pesanan: { pending: O.filter(r => String(r[2]) === 'pending' && Date.now() - new Date(r[4]).getTime() < 864e5).length, gagal: O.filter(r => String(r[2]) === 'gagal' && Date.now() - new Date(r[4]).getTime() < 864e5).length } };
    }
    case 'adm_list': {
      const q = String(b.q || '').trim().toLowerCase().slice(0, 60), st = b.status === 'aktif' || b.status === 'dicabut' ? b.status : '';
      const limit = lim(b.limit, 20, 50), off = Math.max(0, Math.round(Number(b.offset)) || 0);
      let rows = lic().map(r => ({ kode: String(r[0]), pembeli: String(r[1]), status: String(r[2]).trim().toLowerCase(), maks: Number(r[3]) || MAKS_DEFAULT, perangkat: parse_(r[4]), aktif_pertama: iso_(r[5]), catatan: String(r[6] || '') })).reverse();
      if (st) rows = rows.filter(x => x.status === st);
      if (q) rows = rows.filter(x => (x.kode + ' ' + x.pembeli + ' ' + x.catatan + ' ' + x.perangkat.join(' ')).toLowerCase().indexOf(q) >= 0);
      return { ok: true, total: rows.length, items: rows.slice(off, off + limit) };
    }
    case 'adm_set': case 'adm_reset': case 'adm_maks': {
      const row = rowOf(code()); if (row < 0) return { ok: false, error: 'Kode tidak ditemukan' };
      if (b.action === 'adm_set') { if (b.status !== 'aktif' && b.status !== 'dicabut') return { ok: false, error: 'Status tidak valid' }; ls.getRange(row, 3).setValue(b.status); }
      else if (b.action === 'adm_reset') ls.getRange(row, 5).setValue('[]');
      else ls.getRange(row, 4).setValue(Math.max(1, Math.min(10, Math.round(Number(b.maks)) || MAKS_DEFAULT)));
      return { ok: true };
    }
    case 'adm_create': {
      const n = lim(b.n, 1, 20), pembeli = String(b.pembeli || '').slice(0, 60), used = ls.getDataRange().getValues().map(r => String(r[0])), rows = [];
      for (let i = 0; i < n; i++) { let c; do { c = randCode_('WARMAD', 3); } while (used.indexOf(c) >= 0); used.push(c); rows.push([c, pembeli, 'aktif', MAKS_DEFAULT, '[]', '', 'manual-admin']); }
      ls.getRange(ls.getLastRow() + 1, 1, n, H_LIC.length).setValues(rows);
      return { ok: true, kode: rows.map(r => r[0]) };
    }
    case 'adm_orders': {
      const items = ord().reverse().slice(0, lim(b.limit, 20, 50)).map(r => ({ order_id: String(r[0]), device: String(r[1]), status: String(r[2]), jumlah: Number(r[3]) || 0, dibuat: iso_(r[4]), dibayar: iso_(r[5]), kode: String(r[6] || ''), status_midtrans: String(r[7] || '') }));
      return { ok: true, items: items };
    }
    case 'adm_log': {
      const v = sh_('Log', ['waktu', 'kejadian']).getDataRange().getValues().slice(1).reverse().slice(0, 30);
      return { ok: true, items: v.map(r => ({ waktu: iso_(r[0]), kejadian: String(r[1]) })) };
    }
  }
  return { ok: false, error: 'Aksi admin tidak dikenal' };
}

/* ---------- menu admin: buat kode manual (mis. untuk hadiah / pembeli transfer) ---------- */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Lisensi').addItem('Buat 1 kode manual', 'buat1').addItem('Buat 10 kode manual', 'buat10').addToUi();
}
function buat1() { buat_(1); }
function buat10() { buat_(10); }
function buat_(n) {
  const s = sh_('Lisensi', H_LIC), used = s.getDataRange().getValues().map(r => String(r[0])), rows = [];
  for (let i = 0; i < n; i++) {
    let code; do { code = randCode_('WARMAD', 3); } while (used.indexOf(code) >= 0);
    used.push(code);
    rows.push([code, '', 'aktif', MAKS_DEFAULT, '[]', '', 'manual']);
  }
  s.getRange(s.getLastRow() + 1, 1, n, H_LIC.length).setValues(rows);
}
