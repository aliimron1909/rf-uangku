/**
 * Omset-WarMad - Backend Google Sheets (Multi Warung + Akses Karyawan)
 *
 * PASANG: Google Sheet > Extensions > Apps Script > tempel kode ini > Save > muat ulang Sheet.
 * SIAPKAN AKSES: menu "Omset-WarMad" > "Siapkan akses (buat kode pemilik)". Salin kode pemilik
 *   ke aplikasi (Pengaturan > Profil > Kode Pemilik).
 * DEPLOY: Deploy > New deployment > Web app | Execute as: Me | Who has access: Anyone
 *   (setelah ganti kode: Deploy > Manage deployments > Edit > New version).
 *
 * Sheet otomatis:
 *  - "Akses"   : kode | peran | cabang_id | nama | status | dibuat | terakhir_dipakai | perangkat (1 kode = 1 perangkat; kosongkan kolom ini untuk melepas)
 *                peran: pemilik / karyawan. status: aktif / dicabut. Boleh diketik manual di sini.
 *  - "Penjaga" : mode penjaga, potongan kontrak, dan nama karyawan per siklus (ringkasan, diperbarui saat sync).
 *  - "Cabang"  : ringkasan daftar warung (id dipakai di kolom cabang_id). Diperbarui otomatis saat sync.
 *  - "Pengaturan" dan "OmsetHarian" / "OmsetHarian_<id>": data seperti sebelumnya.
 * Sebelum menu "Siapkan akses" dijalankan, server MENOLAK semua permintaan (tidak ada lagi mode tanpa kode).
 * Semua permintaan (termasuk tarik data) memakai POST; kode akses tidak lagi dikirim lewat URL.
 */
const TZ = 'Asia/Jakarta';
const H = ['date', 'cycle', 'day', 'omset', 'expense'];
const KEYS = ['settings', 'cycleKontrakOptions', 'cycleJagaModes', 'cycleNames', 'cycleStok', 'cyclePenjaga'];
const H_PJ = ['warung_id', 'warung', 'siklus', 'mode_penjaga', 'potongan_kontrak', 'porsi_pemilik', 'penjaga', 'stok_awal', 'stok_akhir', 'selisih_stok'];
const H_AKSES = ['kode', 'peran', 'cabang_id', 'nama', 'status', 'dibuat', 'terakhir_dipakai', 'perangkat'];
const H_CAB = ['id', 'nama', 'alamat', 'hp', 'pct', 'kontrak', 'jumlah_catatan'];
const STAFF_SETTINGS = ['nama', 'alamat', 'hp', 'pct', 'kontrak', 'boss', 'k1', 'k2', 'jml', 'defMode', 'foto']; // untuk ringkasan Rekap & PDF karyawan

const clean_ = id => String(id || 'w1').replace(/[^\w]/g, '').slice(0, 40) || 'w1';
const sname_ = id => id === 'w1' ? 'OmsetHarian' : 'OmsetHarian_' + id;
const pfx_ = id => id === 'w1' ? '' : id + ':';

function sheet_(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const s = ss.getSheetByName(name) || ss.insertSheet(name);
  if (s.getLastRow() === 0) s.appendRow(header);
  return s;
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function dstr_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v).slice(0, 10); }
function parse_(v, d) { try { return JSON.parse(v); } catch (e) { return d; } }

/* ---------- akses ---------- */
function akses_() {
  return sheet_('Akses', H_AKSES).getDataRange().getValues().slice(1).map((r, i) => ({
    row: i + 2, kode: String(r[0]).trim().toUpperCase(), peran: String(r[1]).trim().toLowerCase(),
    cabang: String(r[2]).trim(), nama: String(r[3]), status: String(r[4]).trim().toLowerCase() || 'aktif', perangkat: String(r[7] || '').trim()
  })).filter(a => a.kode);
}
function auth_(k, dev) {
  const list = akses_();
  if (!list.some(a => a.peran === 'pemilik')) return { error: SETUP_MSG };   // belum disiapkan: tolak, jangan buka akses
  const a = list.find(x => x.kode === String(k || '').trim().toUpperCase());
  if (!a) return { error: 'Kode akses tidak valid' };
  if (a.status !== 'aktif') return { error: 'Akses sudah dicabut', revoked: true };
  if (a.peran === 'karyawan') {   // satu kode = satu perangkat
    const d = String(dev || '').slice(0, 40);
    if (!d) return { error: 'Perangkat tidak dikenali' };
    if (!a.perangkat) { sheet_('Akses', H_AKSES).getRange(a.row, 8).setValue(d); a.perangkat = d; }
    else if (a.perangkat !== d) return { error: 'Kode ini sudah dipakai di perangkat lain. Minta pemilik melepas perangkat lama.' };
  }
  return { peran: a.peran, cabang: a.cabang, a: a, list: list };
}
const SETUP_MSG = 'Server belum disiapkan. Pemilik: di Google Sheet pilih menu Omset-WarMad > Siapkan akses.';
function randCode_(prefix, parts) {   // kode acak aman (SHA-256 dari UUID acak), 5 bit per karakter tanpa bias
  const ch = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // tepat 32 karakter, tanpa I/O/0/1 agar tidak tertukar
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid());
  const out = [];
  for (let p = 0; p < parts; p++) { let t = ''; for (let i = 0; i < 4; i++) t += ch[d[p * 4 + i] & 31]; out.push(t); }
  return prefix + '-' + out.join('-');
}
function gen_(prefix, list) {
  let k; do { k = randCode_(prefix, 3); } while (list.some(a => a.kode === k));   // 12 karakter acak
  return k;
}
// Catat percobaan kode salah. Apps Script tidak bisa melihat IP, jadi tidak ada kunci total (penyerang bisa mengunci pemilik).
// Perlindungan utamanya kode panjang yang acak; di sini hanya pencatatan di sheet "Log" bila ada lonjakan.
function gagal_() {
  const c = CacheService.getScriptCache(), n = (Number(c.get('bad')) || 0) + 1;
  c.put('bad', String(n), 600);
  if (n === 30) sheet_('Log', ['waktu', 'kejadian']).appendRow([new Date(), '30 percobaan kode salah dalam 10 menit']);
}
// Tolak cepat kode yang jelas salah SEBELUM antre di lock, supaya banjir permintaan sampah tidak menghambat pengguna asli.
function quick_(k) {
  const list = akses_();
  if (!list.some(a => a.peran === 'pemilik')) return json_({ ok: false, error: SETUP_MSG });
  const key = String(k || '').trim().toUpperCase();
  if (list.some(a => a.kode === key)) return null;
  if (key) gagal_();
  return json_({ ok: false, error: 'Kode akses tidak valid' });
}

/* ---------- data ---------- */
function readPen_() {
  const pen = {};
  sheet_('Pengaturan', ['key', 'value']).getDataRange().getValues().slice(1).forEach(r => pen[r[0]] = r[1]);
  return pen;
}
function readRecs_(id) {
  return sheet_(sname_(id), H).getDataRange().getValues().slice(1).filter(r => r[0] !== '' && r[3] !== '')
    .map(r => ({ date: dstr_(r[0]), cycle: Number(r[1]), day: Number(r[2]), omset: Number(r[3]), expense: r[4] || '' }));
}
function writeRecs_(id, rows) {
  const s = sheet_(sname_(id), H);
  s.clearContents();
  s.getRange(1, 1, 1, H.length).setValues([H]);
  if (rows.length) {
    s.getRange(2, 1, rows.length, 1).setNumberFormat('@'); // tanggal sebagai teks yyyy-mm-dd
    s.getRange(2, 1, rows.length, H.length).setValues(rows);
  }
}
function one_(id, pen, staff) {
  const p = pfx_(id), st = parse_(pen[p + 'settings'], {});
  const settings = staff ? STAFF_SETTINGS.reduce((o, k) => { if (st[k] !== undefined) o[k] = st[k]; return o; }, {}) : st;
  return {
    id: id, records: readRecs_(id), settings: settings,
    cycleKontrakOptions: parse_(pen[p + 'cycleKontrakOptions'], {}),
    cycleJagaModes: parse_(pen[p + 'cycleJagaModes'], {}),
    cycleNames: parse_(pen[p + 'cycleNames'], {}),
    cycleStok: parse_(pen[p + 'cycleStok'], {}),
    cyclePenjaga: parse_(pen[p + 'cyclePenjaga'], {})
  };
}

/* ---------- GET: tidak lagi dipakai (kode akses tidak boleh lewat URL) ---------- */
function doGet() {
  return json_({ ok: false, error: 'Aplikasi perlu diperbarui. Tutup lalu buka ulang aplikasi untuk memakai versi terbaru.' });
}

/* ---------- tarik data (lewat POST) ---------- */
function pull_(au) {
  const pen = readPen_(), ids = parse_(pen.warung, ['w1']);
  if (au.peran === 'karyawan') {
    if (ids.indexOf(au.cabang) < 0) return { ok: false, error: 'Warung belum terdaftar. Minta pemilik menekan sync.' };
    sheet_('Akses', H_AKSES).getRange(au.a.row, 7).setValue(new Date());
    const pr = parse_(pen.premium, {});   // Premium pemilik, berlaku 14 hari sejak sync terakhir pemilik
    return { ok: true, peran: 'karyawan', premium: !!(pr.on && Date.now() - pr.at < 14 * 864e5), warung: [one_(au.cabang, pen, true)] };
  }
  return {
    ok: true, peran: 'pemilik', warung: ids.map(id => one_(id, pen, false)),
    akses: au.list.map(a => ({ kode: a.kode, peran: a.peran, cabang: a.cabang, nama: a.nama, status: a.status, terpasang: !!a.perangkat }))
  };
}

/* ---------- POST ---------- */
function syncAll_(b) {
  const rows = [['key', 'value']], ids = [], cab = [];
  b.warung.forEach(w => {
    const id = clean_(w.id); ids.push(id);
    const recs = (w.records || []).slice().sort((a, c) => a.date.localeCompare(c.date));
    writeRecs_(id, recs.map(r => [r.date, r.cycle, r.day, r.omset, r.expense || '']));
    KEYS.forEach(k => rows.push([pfx_(id) + k, JSON.stringify(w[k] || {})]));
    const s = w.settings || {};
    cab.push([id, s.nama || '', s.alamat || '', s.hp || '', s.pct || '', s.kontrak || '', recs.length]);
  });
  rows.splice(1, 0, ['warung', JSON.stringify(ids)], ['premium', JSON.stringify({ on: !!b.premium, at: Date.now() })]);
  const p = sheet_('Pengaturan', ['key', 'value']);
  p.clearContents();
  p.getRange(1, 1, rows.length, 2).setNumberFormat('@').setValues(rows);
  const c = sheet_('Cabang', H_CAB);
  c.clearContents();
  c.getRange(1, 1, 1, H_CAB.length).setValues([H_CAB]);
  if (cab.length) c.getRange(2, 1, cab.length, H_CAB.length).setValues(cab);
  const pj = [];   // ringkasan penjaga per siklus (hanya dibaca; ubah lewat aplikasi)
  b.warung.forEach(w => {
    const id = clean_(w.id), nm = (w.settings && w.settings.nama) || '', jm = w.cycleJagaModes || {}, cn = w.cycleNames || {}, ko = w.cycleKontrakOptions || {}, sk = w.cycleStok || {}, pg = w.cyclePenjaga || {};
    Object.keys(Object.assign({}, jm, cn, ko, sk, pg)).map(Number).filter(n => n > 0).sort((a, c2) => a - c2)
      .forEach(c2 => pj.push([id, nm, c2, jm[c2] || '', ko[c2] || 'zero', pjPorsi_(jm[c2], pg[c2]), pjText_(jm[c2], cn[c2], pg[c2]), skA_(sk[c2]), skZ_(sk[c2]), skS_(sk[c2])]));
  });
  const ps = sheet_('Penjaga', H_PJ);
  ps.clearContents();
  ps.getRange(1, 1, 1, H_PJ.length).setValues([H_PJ]);
  if (pj.length) ps.getRange(2, 1, pj.length, H_PJ.length).setValues(pj);
  return { ok: true, warung: ids.length };
}
const PORSI_ = { pemilik_suami_istri: 100, pemilik_1_karyawan: 75, karyawan_suami_istri: 50, dua_karyawan: 50, suami_istri_gaji: 100 };
function pjPorsi_(m, p) { return m === 'kustom' ? ((p && p.pp !== undefined) ? Number(p.pp) : 50) : (PORSI_[m] !== undefined ? PORSI_[m] : ''); }
function pjText_(m, cn, p) {   // ringkasan penjaga untuk dibaca di Sheet
  cn = cn || {}; const l = (p && p.list) || [];
  if (m === 'pemilik_suami_istri') return '-';
  if (m === 'pemilik_1_karyawan' || m === 'karyawan_suami_istri') return cn.k1 || '';
  if (m === 'dua_karyawan') return [cn.k1, cn.k2].filter(Boolean).join('; ');
  if (m === 'suami_istri_gaji') return l[0] ? (l[0].n || '') + ' (gaji ' + (Number(l[0].g) || 0) + ')' : '';
  return l.map(x => (x.n || 'Penjaga') + (x.t === 'gaji' ? ' (gaji ' + (Number(x.g) || 0) + ')' : ' (bagi hasil)')).join('; ');
}
const skOk_ = s => s && s.awal !== '' && s.akhir !== '' && isFinite(Number(s.awal)) && isFinite(Number(s.akhir)) && s.awal !== undefined && s.akhir !== undefined;
const skA_ = s => skOk_(s) ? Number(s.awal) : '', skZ_ = s => skOk_(s) ? Number(s.akhir) : '', skS_ = s => skOk_(s) ? Number(s.akhir) - Number(s.awal) : '';
function rec_(r) {
  const o = Number(r && r.omset);
  if (!r || !/^\d{4}-\d\d-\d\d$/.test(String(r.date)) || !isFinite(o) || o < 0) return null;
  return [String(r.date), Math.round(Number(r.cycle)) || 1, Math.min(30, Math.max(1, Math.round(Number(r.day)) || 1)), Math.round(o), String(r.expense || '').slice(0, 200)];
}
function syncStaff_(b, cabang) {
  const w = (b.warung || []).find(x => clean_(x.id) === cabang);
  if (!w) return { ok: false, error: 'Warung tidak sesuai akses' };
  const map = {};
  readRecs_(cabang).forEach(r => map[r.date] = [r.date, r.cycle, r.day, r.omset, r.expense]);
  (w.records || []).forEach(r => { const x = rec_(r); if (x) map[x[0]] = x; });   // upsert, karyawan tidak bisa menghapus
  const rows = Object.keys(map).sort().map(k => map[k]);
  writeRecs_(cabang, rows);
  return { ok: true, count: rows.length };
}
function createAccess_(b, au) {
  const ids = parse_(readPen_().warung, ['w1']), cabang = clean_(b.cabang), nama = String(b.nama || '').trim().slice(0, 60);
  if (ids.indexOf(cabang) < 0) return { ok: false, error: 'Warung belum tersinkron. Tekan sync dulu.' };
  if (!nama) return { ok: false, error: 'Nama karyawan kosong' };
  const kode = gen_('KRY', au.list);
  sheet_('Akses', H_AKSES).appendRow([kode, 'karyawan', cabang, nama, 'aktif', new Date(), '']);
  return { ok: true, kode: kode };
}
function setAccess_(b, au) {
  const code = String(b.code || '').trim().toUpperCase(), st = b.status === 'dicabut' ? 'dicabut' : 'aktif';
  const a = au.list.find(x => x.kode === code);
  if (!a || a.peran !== 'karyawan') return { ok: false, error: 'Kode karyawan tidak ditemukan' };
  sheet_('Akses', H_AKSES).getRange(a.row, 5).setValue(st);
  return { ok: true };
}
function resetDevice_(b, au) {
  const code = String(b.code || '').trim().toUpperCase(), a = au.list.find(x => x.kode === code);
  if (!a || a.peran !== 'karyawan') return { ok: false, error: 'Kode karyawan tidak ditemukan' };
  sheet_('Akses', H_AKSES).getRange(a.row, 8).setValue('');
  return { ok: true };
}
function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Permintaan tidak valid' }); }
  const quick = quick_(b && b.key);
  if (quick) return quick;
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    const au = auth_(b.key, b.device);
    if (au.error) return json_({ ok: false, error: au.error, revoked: !!au.revoked });
    if (b.action === 'verify') return json_({ ok: true, peran: au.peran });   // verifikasi kode saja
    if (b.action === 'pull') return json_(pull_(au));
    if (b.action === 'syncAll') {
      if (au.peran !== 'pemilik' || !Array.isArray(b.warung)) return json_({ ok: false, error: 'Hanya pemilik yang boleh sync penuh' });
      return json_(syncAll_(b));
    }
    if (b.action === 'syncStaff') {
      if (au.peran !== 'karyawan') return json_({ ok: false, error: 'Bukan akun karyawan' });
      return json_(syncStaff_(b, au.cabang));
    }
    if (b.action === 'createAccess' || b.action === 'setAccess' || b.action === 'resetDevice') {
      if (au.peran !== 'pemilik') return json_({ ok: false, error: 'Hanya pemilik yang boleh mengatur akses' });
      return json_(b.action === 'createAccess' ? createAccess_(b, au) : b.action === 'resetDevice' ? resetDevice_(b, au) : setAccess_(b, au));
    }
    return json_({ ok: false, error: 'Aksi tidak dikenal' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally { try { lock.releaseLock(); } catch (x) {} }
}

/* ---------- menu di Google Sheet ---------- */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Omset-WarMad')
    .addItem('Siapkan akses (buat kode pemilik)', 'siapkanAkses')
    .addItem('Tambah baris kode karyawan (isi manual)', 'kodeKaryawanBaru').addToUi();
}
function siapkanAkses() {
  const s = sheet_('Akses', H_AKSES), list = akses_();
  let kode = (list.find(a => a.peran === 'pemilik') || {}).kode;
  if (!kode) { kode = gen_('PMK', list); s.appendRow([kode, 'pemilik', '*', 'Pemilik', 'aktif', new Date(), '']); }
  SpreadsheetApp.getUi().alert('Kode Pemilik Anda:\n\n' + kode + '\n\nMasukkan di aplikasi: Pengaturan > Profil > Kode Pemilik. Lalu buat deployment versi baru.');
}
function kodeKaryawanBaru() {
  const s = sheet_('Akses', H_AKSES), kode = gen_('KRY', akses_());
  s.appendRow([kode, 'karyawan', '', '', 'aktif', new Date(), '']);
  SpreadsheetApp.getUi().alert('Kode ' + kode + ' ditambahkan di sheet Akses. Isi kolom cabang_id (lihat sheet Cabang) dan nama.');
}
