/* Panel admin Omset-WarMad. Tidak menyimpan kunci apa pun; sesi berupa cookie HttpOnly dari /api/admin.
   Semua data dari server dirender dengan textContent (fungsi h), tidak pernah innerHTML. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const h = (tag, props, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : String(c));
    return e;
  };
  const rp = n => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
  const tgl = v => v ? new Date(v).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
  let toastT;
  const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 2600); };

  async function api(op, args) {
    let r;
    try {
      r = await fetch('/api/admin', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-WM-Admin': '1' }, body: JSON.stringify({ op, args: args || {} }) });
    } catch (e) { return { ok: false, error: 'Tidak ada koneksi internet' }; }
    let j; try { j = await r.json(); } catch (e) { j = { ok: false, error: 'Server admin tidak merespons dengan benar (HTTP ' + r.status + '). Periksa api/admin.js dan pengaturan Vercel.' }; }
    if (r.status === 401 && j.login) showLogin();
    return j;
  }
  function showLogin() { $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); $('#pw').value = ''; $('#otp').value = ''; $('#pw').focus(); }
  function showApp() { $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); loadStats(); loadList(true); loadBuyers(true); }

  /* ----- login ----- */
  async function doLogin() {
    const btn = $('#loginBtn'); $('#loginErr').textContent = ''; btn.disabled = true;
    let r, j;
    try {
      r = await fetch('/api/admin', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-WM-Admin': '1' }, body: JSON.stringify({ op: 'login', password: $('#pw').value, kode: $('#otp').value.trim() }) });
      try { j = await r.json(); } catch (e) { j = { ok: false, error: 'Server admin tidak merespons dengan benar (HTTP ' + r.status + '). Periksa api/admin.js dan pengaturan Vercel.' }; }
    } catch (e) { j = { ok: false, error: 'Tidak ada koneksi internet' }; }
    btn.disabled = false;
    if (j.ok) { $('#pw').value = ''; $('#otp').value = ''; showApp(); } else $('#loginErr').textContent = j.error || 'Login gagal';
  }

  /* ----- ringkasan ----- */
  async function loadStats() {
    const j = await api('stats'); const box = $('#stats'); box.replaceChildren();
    if (!j.ok) { box.append(h('div', { class: 'mut' }, j.error || 'Gagal memuat')); return; }
    const c = (judul, nilai, ket) => h('div', { class: 'stat' }, h('b', {}, nilai), h('span', {}, judul + (ket ? ' · ' + ket : '')));
    box.append(
      c('Lisensi aktif', j.lisensi.aktif, 'dari ' + j.lisensi.total), c('Dicabut', j.lisensi.dicabut),
      c('Terjual hari ini', rp(j.penjualan.hari_ini.total), j.penjualan.hari_ini.jumlah + ' pesanan'), c('7 hari', rp(j.penjualan.tujuh_hari.total), j.penjualan.tujuh_hari.jumlah + ' pesanan'),
      c('30 hari', rp(j.penjualan.tiga_puluh_hari.total), j.penjualan.tiga_puluh_hari.jumlah + ' pesanan'), c('Total', rp(j.penjualan.semua.total), j.penjualan.semua.jumlah + ' pesanan'),
      c('Pending (24 jam)', j.pesanan.pending), c('Gagal (24 jam)', j.pesanan.gagal),
      c('Akun cloud', j.cloud.akun, j.cloud.aktif_7_hari + ' sync 7 hari'), c('Catatan omset', new Intl.NumberFormat('id-ID').format(j.cloud.catatan), 'di server')
    );
  }

  /* ----- daftar lisensi ----- */
  let offset = 0, memuat = false;
  const salin = async t => { try { await navigator.clipboard.writeText(t); toast('Disalin'); } catch (e) { toast('Gagal menyalin'); } };
  async function aksi(op, args, konfirmasi, sukses) {
    if (konfirmasi && !confirm(konfirmasi)) return;
    const j = await api(op, args);
    if (j.ok) { toast(sukses || 'Berhasil'); loadStats(); loadList(true); } else toast(j.error || 'Gagal');
  }
  function kartu(x) {
    const dicabut = x.status !== 'aktif';
    return h('div', { class: 'lic' },
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { class: 'code' }, x.kode), h('span', { class: 'chip ' + (dicabut ? 'dicabut' : 'aktif') }, x.status || '-')),
      h('div', { class: 'mut' }, (x.pembeli || 'Tanpa nama') + ' · perangkat ' + x.perangkat.length + '/' + x.maks + (x.catatan ? ' · ' + x.catatan : '')),
      x.perangkat.length ? h('div', { class: 'dev mut' }, x.perangkat.join('  ')) : null,
      h('div', { class: 'mut' }, 'Aktivasi pertama: ' + tgl(x.aktif_pertama)),
      h('div', { class: 'row', style: 'margin-top:6px' },
        h('button', { onclick: () => salin(x.kode) }, 'Salin'),
        h('button', { class: dicabut ? '' : 'bad', onclick: () => aksi('set', { kode: x.kode, status: dicabut ? 'aktif' : 'dicabut' }, dicabut ? 'Aktifkan kembali ' + x.kode + '?' : 'Cabut lisensi ' + x.kode + '? Pengguna kehilangan Premium saat pengecekan berikutnya.', dicabut ? 'Diaktifkan' : 'Dicabut') }, dicabut ? 'Aktifkan' : 'Cabut'),
        h('button', { onclick: () => aksi('reset', { kode: x.kode }, 'Reset semua perangkat untuk ' + x.kode + '?', 'Perangkat direset') }, 'Reset HP'),
        h('button', { onclick: () => { const v = prompt('Jatah perangkat (1-10):', String(x.maks)); if (v !== null) aksi('maks', { kode: x.kode, maks: Number(v) }, null, 'Jatah diubah'); } }, 'Jatah'))
    );
  }
  async function loadList(reset) {
    if (memuat) return; memuat = true;
    if (reset) offset = 0;
    const j = await api('list', { q: $('#q').value.trim(), status: $('#st').value, limit: 20, offset });
    memuat = false;
    const box = $('#list'); if (reset) box.replaceChildren();
    if (!j.ok) { box.append(h('div', { class: 'mut' }, j.error || 'Gagal memuat')); return; }
    if (reset && !j.items.length) box.append(h('div', { class: 'mut' }, 'Tidak ada lisensi yang cocok.'));
    j.items.forEach(x => box.append(kartu(x)));
    offset += j.items.length;
    $('#more').classList.toggle('hidden', offset >= j.total);
  }

  /* ----- pembeli & data cloud (hanya ringkasan) ----- */
  let pOff = 0, pMemuat = false;
  const kapan = v => { if (!v) return 'belum pernah'; const m = Math.round((Date.now() - new Date(v).getTime()) / 60000); return m < 1 ? 'baru saja' : m < 60 ? m + ' menit lalu' : m < 1440 ? Math.round(m / 60) + ' jam lalu' : Math.round(m / 1440) + ' hari lalu'; };
  function kartuPembeli(x) {
    return h('div', { class: 'lic' },
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { class: 'code' }, x.license), h('span', { class: 'chip ' + (x.status === 'aktif' ? 'aktif' : 'dicabut') }, x.status)),
      h('div', { class: 'mut' }, (x.pembeli || 'Tanpa nama') + (x.warung.length ? ' · ' + x.warung.join(', ') : ' · belum ada warung')),
      h('div', { class: 'mut' }, new Intl.NumberFormat('id-ID').format(x.catatan) + ' catatan · omset ' + rp(x.omset) + (x.terakhir_catatan ? ' · catatan terakhir ' + x.terakhir_catatan : '')),
      h('div', { class: 'mut' }, 'Sync terakhir: ' + kapan(x.sync_at) + (x.karyawan ? ' · ' + x.karyawan + ' karyawan' : '')),
      h('div', { class: 'row', style: 'margin-top:6px' }, h('button', { onclick: () => { $('#q').value = x.license; loadList(true); $('#q').scrollIntoView({ behavior: 'smooth' }); } }, 'Lihat lisensi')));
  }
  async function loadBuyers(reset) {
    if (pMemuat) return; pMemuat = true;
    if (reset) pOff = 0;
    const j = await api('pembeli', { q: $('#pq').value.trim(), limit: 20, offset: pOff });
    pMemuat = false;
    const box = $('#pList'); if (reset) box.replaceChildren();
    if (!j.ok) { box.append(h('div', { class: 'mut' }, j.error || 'Gagal memuat')); return; }
    if (reset && !j.items.length) box.append(h('div', { class: 'mut' }, 'Belum ada pembeli yang memakai sync cloud.'));
    j.items.forEach(x => box.append(kartuPembeli(x)));
    pOff += j.items.length;
    $('#pMore').classList.toggle('hidden', pOff >= j.total);
  }

  /* ----- pindahkan lisensi lama ----- */
  async function impor() {
    const out = $('#impOut'), btn = $('#impBtn'); btn.disabled = true; out.textContent = 'Memproses... (bisa sampai 20 detik)';
    let off = 0, masuk = 0, baca = 0;
    for (let i = 0; i < 40; i++) {
      const j = await api('impor', { offset: off });
      if (!j.ok) { out.textContent = (j.error || 'Gagal') + (baca ? ' (sudah diproses ' + baca + ' baris, ' + masuk + ' masuk; tekan lagi untuk melanjutkan)' : ''); btn.disabled = false; return; }
      masuk += j.masuk; baca += j.diproses;
      if (j.selesai) { out.textContent = 'Selesai. Dari ' + j.total + ' lisensi lama, ' + masuk + ' baru disalin (sisanya sudah ada).'; btn.disabled = false; loadStats(); loadList(true); return; }
      off = j.lanjut; out.textContent = 'Memproses... ' + off + ' dari ' + j.total;
    }
    btn.disabled = false;
  }

  /* ----- buat kode ----- */
  async function buatKode() {
    const j = await api('create', { n: Number($('#cN').value) || 1, pembeli: $('#cName').value.trim() });
    const out = $('#cOut'); out.replaceChildren();
    if (!j.ok) { toast(j.error || 'Gagal'); return; }
    j.kode.forEach(k => out.append(h('div', {}, k + ' ', h('button', { onclick: () => salin(k) }, 'Salin'))));
    loadStats(); loadList(true);
  }

  /* ----- pesanan & log (dimuat saat dibuka) ----- */
  async function loadOrders() {
    const j = await api('orders', { limit: 30 }), box = $('#ord'); box.replaceChildren();
    if (!j.ok) { box.append(h('div', { class: 'mut' }, j.error || 'Gagal memuat')); return; }
    if (!j.items.length) box.append(h('div', { class: 'mut' }, 'Belum ada pesanan.'));
    j.items.forEach(o => box.append(h('div', { class: 'lic' },
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { class: 'code' }, o.order_id), h('span', { class: 'chip ' + o.status }, o.status)),
      h('div', { class: 'mut' }, rp(o.jumlah) + ' · ' + tgl(o.dibuat)),
      h('div', { class: 'dev mut' }, 'Perangkat ' + o.device + (o.kode ? ' · ' + o.kode : '') + (o.status_midtrans ? ' · ' + o.status_midtrans : '')))));
  }
  async function loadLog() {
    const j = await api('log'), box = $('#log'); box.replaceChildren();
    if (!j.ok) { box.append(h('div', { class: 'mut' }, j.error || 'Gagal memuat')); return; }
    if (!j.items.length) box.append(h('div', { class: 'mut' }, 'Tidak ada catatan. Itu kabar baik.'));
    j.items.forEach(l => box.append(h('div', { class: 'lic' }, h('div', {}, l.kejadian), h('div', { class: 'mut' }, tgl(l.waktu)))));
  }

  /* ----- pasang event & mulai ----- */
  $('#loginBtn').addEventListener('click', doLogin);
  $('#pw').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  $('#otp').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  $('#logout').addEventListener('click', async () => { await api('logout'); showLogin(); });
  let deb; $('#q').addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(() => loadList(true), 300); });
  $('#st').addEventListener('change', () => loadList(true));
  $('#more').addEventListener('click', () => loadList(false));
  $('#cBtn').addEventListener('click', buatKode);
  let dep; $('#pq').addEventListener('input', () => { clearTimeout(dep); dep = setTimeout(() => loadBuyers(true), 300); });
  $('#pMore').addEventListener('click', () => loadBuyers(false));
  $('#impBtn').addEventListener('click', impor);
  $('#dOrd').addEventListener('toggle', e => { if (e.target.open) loadOrders(); });
  $('#dLog').addEventListener('toggle', e => { if (e.target.open) loadLog(); });
  api('me').then(j => { if (j.ok) showApp(); else showLogin(); });
})();
