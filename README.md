# RF Uangku

Aplikasi PWA keuangan pribadi yang **local-first**: semua data tersimpan di HP, tanpa server, tanpa akun, dan tanpa langganan. Cocok untuk satu perangkat Android.

> Versi ini adalah **Paket A — Uangku Lite v1.1**: data lokal + backup JSON/CSV + PIN/fingerprint + AI Groq + budget bulanan + transaksi berulang. Google Sheets tidak dipakai sebagai database.

---

## Fitur

- **Dashboard** — total saldo, pemasukan, pengeluaran, selisih, grafik tren, rincian kategori, saldo per rekening.
- **Transaksi** — tambah, edit, hapus, cari, filter jenis/rekening/kategori/tanggal, pagination.
- **Isi cepat AI (Groq)** — tulis “makan siang 25rb pakai Gopay”, AI mengisi form. Tetap bisa diperiksa sebelum disimpan. Model chat aktif bisa dicari langsung dari Groq (butuh internet).
- **Chat AI transaksi** — ngobrol dengan AI untuk menyiapkan transaksi. AI bisa bertanya balik jika nominal/jenis belum jelas, lalu draft bisa diperiksa di form atau disimpan langsung.
- **Budget bulanan** — atur limit per kategori pengeluaran, lihat progres, status aman/hampir penuh/terlampaui, dan ringkasan di dashboard.
- **Transaksi berulang** — aturan harian/mingguan/bulanan/tahunan dengan interval, tanggal mulai, dan tanggal selesai opsional. Transaksi otomatis dibuat saat aplikasi dibuka/dilanjutkan.
- **Laporan** — periode harian/mingguan/bulanan/tahunan/kustom, filter jenis & rekening, ekspor **PDF** dan **CSV**.
- **Master data** — tambah, edit, arsip, atau hapus rekening dan kategori langsung dari **Pengaturan → Rekening & Kategori**.
- **PIN 4–6 digit + fingerprint** — PIN tetap menjadi fallback; fingerprint memakai WebAuthn platform authenticator dan hanya membuka tampilan aplikasi, bukan enkripsi database.
- **Profil lokal** — ganti nama dan foto profil; dipakai di sapaan dashboard, avatar, dan PDF.
- **Tema terang/gelap/sistem**.
- **PWA** — bisa dipasang di layar utama, bekerja offline setelah dibuka pertama kali.
- **Backup & restore JSON v2** — unduh rekening, kategori, transaksi, budget, aturan berulang, dan profil, lalu pulihkan kapan saja. Backup v1 lama tetap bisa dipulihkan.
- **Ekspor CSV** — untuk dibuka di Excel/Google Sheets.
- **Mobile-first** — navigasi bawah di HP, sidebar di desktop.

---

## Teknologi

- React 19 + TypeScript + Vite 7
- Tailwind CSS v4
- Dexie (IndexedDB)
- Recharts
- jsPDF + jspdf-autotable
- vite-plugin-pwa (Workbox)
- date-fns
- lucide-react

---

## Mulai Cepat

### 1. Pastikan Node.js sudah terpasang

Disarankan **Node.js 20.19+ atau 22.12+** (syarat Vite 7). Cek dengan:

```bash
node -v
npm -v
```

### 2. Masuk ke folder proyek

```bash
cd "RF Uangku"
```

### 3. Pasang dependency

```bash
npm install
```

### 4. Jalankan mode pengembangan

```bash
npm run dev
```

Buka alamat yang muncul di terminal, biasanya:

```text
http://localhost:5173
```

Pada pembukaan pertama, aplikasi akan meminta Anda membuat PIN 4–6 digit.

### 5. Build untuk produksi

```bash
npm run build
```

Hasil build ada di folder `dist/`. Untuk mencoba hasil build secara lokal:

```bash
npm run preview
```

Jika muncul error `JavaScript heap out of memory`, jalankan build dengan heap lebih besar:

```bash
NODE_OPTIONS=--max-old-space-size=2048 npm run build
```

---

## Cara Pakai Harian

### Menambah transaksi

1. Tekan tombol **+** di kanan bawah (HP) atau **Tambah Transaksi** (desktop).
2. Pilih **Pemasukan** atau **Pengeluaran**.
3. Isi nominal, rekening, kategori, tanggal, dan catatan.
4. Tekan **Simpan transaksi**.

### Isi cepat dengan AI

1. Buka **Pengaturan → AI Groq**.
2. Buat API key gratis di [console.groq.com/keys](https://console.groq.com/keys).
3. Tempel key, lalu tekan **Cari model aktif** untuk mengambil daftar model chat yang masih aktif langsung dari Groq. Fitur ini **membutuhkan koneksi internet**.
4. Pilih model dari daftar (default `llama-3.3-70b-versatile`), lalu **Simpan pengaturan AI**.
5. Tekan **Tes koneksi** untuk memastikan key dan model bekerja.
6. Saat menambah transaksi, tulis kalimat seperti:
   - `makan siang 25rb pakai Gopay`
   - `gaji 5jt masuk BCA`
   - `bensin 50rb Tunai`
7. Tekan **Isi form**, lalu periksa hasilnya sebelum menyimpan.

### Chat AI saat mau transaksi

1. Buka **Transaksi**, lalu tekan **Chat AI**. Bisa juga dari tombol **Chat AI** di dashboard, sidebar desktop, atau shortcut PWA.
2. Ceritakan transaksi dengan bahasa sehari-hari, misalnya `makan siang 25rb pakai Gopay`.
3. Jika nominal atau jenis transaksi belum jelas, AI akan bertanya balik. Jawab di kolom chat.
4. Setelah draft muncul, pilih:
   - **Periksa di form** — buka form transaksi dengan data terisi, lalu edit bila perlu.
   - **Simpan langsung** — simpan transaksi tanpa membuka form.
5. Gunakan **Mulai ulang** untuk membersihkan percakapan.

Chat memakai API key dan model Groq yang sama dengan isi cepat. Percakapan hanya ada di memori selama halaman terbuka dan tidak ikut backup.

> API key hanya disimpan di IndexedDB perangkat ini dan dikirim langsung dari browser ke Groq saat fitur AI dipakai. Jangan memakai aplikasi ini di perangkat bersama.

### Mengatur profil

1. Buka **Pengaturan → Profil**.
2. Isi nama yang ingin dipakai, lalu pilih foto profil bila perlu.
3. Tekan **Simpan profil**.

Nama profil dipakai untuk sapaan dashboard, avatar di topbar, dan nama pemilik pada PDF laporan. Foto diperkecil otomatis ke 256×256 dan disimpan lokal di perangkat. Foto profil **tidak** mengganti ikon aplikasi/APK.

### Budget dan transaksi berulang

Buka menu **Rencana**:

- Tab **Budget** — pilih kategori pengeluaran, isi limit bulanan, lalu simpan. Progres dihitung dari transaksi bulan berjalan. Status: **Aman** (<80%), **Hampir penuh** (80–99%), **Terlampaui** (≥100%).
- Tab **Berulang** — buat aturan pemasukan/pengeluaran dengan frekuensi harian, mingguan, bulanan, atau tahunan, interval, tanggal mulai, dan tanggal selesai opsional. Aturan bisa dijeda/dilanjutkan.

Transaksi berulang dibuat otomatis saat aplikasi dibuka atau dilanjutkan. Tidak ada proses background saat aplikasi tertutup, jadi transaksi yang jatuh tempo akan dibuat saat aplikasi dibuka kembali. Transaksi hasil generate tetap bisa diedit/dihapus dan tidak dibuat ulang setelah dihapus.

> Budget v1.1 menyimpan satu limit per kategori untuk semua bulan. Mengubah limit akan memengaruhi tampilan bulan lain karena riwayat limit per bulan belum disimpan.

### Laporan PDF/CSV

1. Buka menu **Laporan**.
2. Pilih periode (Hari Ini, Minggu Ini, Bulan Ini, Tahun Ini, atau Kustom).
3. Pilih jenis transaksi dan rekening bila perlu.
4. Tekan **Unduh PDF** atau **CSV**.

PDF dibuat di perangkat, tanpa upload ke server.

### Backup dan restore

Data lokal bisa hilang jika Anda menghapus data browser, memakai mode incognito, atau mengganti HP. **Lakukan backup rutin.**

1. Buka **Pengaturan → Backup & Data**.
2. Tekan **Unduh Backup JSON**.
3. Simpan file di Google Drive, penyimpanan HP, atau kirim ke diri sendiri.
4. Untuk memulihkan: tekan **Pulihkan dari Backup**, pilih file JSON, lalu konfirmasi.

> Restore akan **mengganti rekening, kategori, transaksi, budget, dan aturan berulang lokal** dengan isi file. Profil ikut dipulihkan jika tersedia di file backup. Unduh backup terbaru dulu jika ragu.

Backup JSON v2 berisi rekening, kategori, transaksi, budget, aturan berulang, dan profil (nama + foto). Backup v1 dari versi sebelumnya tetap bisa dipulihkan; tabel budget/berulang akan dikosongkan. PIN, fingerprint, tema, dan API key Groq **tidak** ikut ke dalam file backup (agar rahasia perangkat tidak ikut tersebar).

**Ekspor CSV** berguna untuk melihat data di Excel/Google Sheets, tetapi CSV bukan backup lengkap. Gunakan JSON untuk backup/restore.

---

## PIN dan Keamanan

- PIN disimpan sebagai hash + salt di `localStorage`, bukan sebagai teks biasa.
- PIN adalah **privasi tampilan**, bukan enkripsi database. Seseorang yang menguasai perangkat dan alat developer masih bisa membuka IndexedDB.
- Fingerprint memakai WebAuthn platform authenticator. Yang disimpan hanya metadata credential dan public key, bukan data biometrik. Fingerprint juga hanya membuka tampilan aplikasi, bukan mengenkripsi database.
- Fingerprint terikat pada origin/domain. Credential dari Vercel tidak berlaku di Netlify atau localhost. Di APK/TWA, fingerprint perlu diuji langsung di perangkat.
- Jika lupa PIN: di layar kunci pilih **Lupa PIN?** → **Reset PIN**. Data transaksi tetap ada. Reset PIN juga menghapus credential fingerprint lokal.
- Saat membuat PIN pertama kali, Anda bisa langsung mengaktifkan fingerprint. Saat aplikasi dimuat ulang, browser tetap membutuhkan gestur pengguna, jadi tekan tombol **Buka dengan fingerprint**.
- Pada deployment HTTPS, PIN memakai SHA-256. Pada akses HTTP di jaringan lokal, aplikasi memakai fallback hash sederhana agar tetap bisa dipakai.
- Untuk keamanan lebih baik, pasang aplikasi lewat HTTPS (misalnya hasil deploy Vercel) dan aktifkan kunci layar HP.

---

## PWA: Pasang di HP

PWA membutuhkan **HTTPS** atau `localhost`. Jika dibuka lewat `http://192.168.x.x`, tombol install mungkin tidak muncul dan beberapa fitur browser dibatasi.

### Android / Chrome

1. Buka aplikasi di Chrome.
2. Tekan menu **⋮** → **Tambahkan ke layar utama** / **Install app**.
3. Atau tunggu banner “Pasang RF Uangku di HP” di dalam aplikasi.

### iPhone / Safari

1. Buka di Safari.
2. Tekan tombol **Bagikan**.
3. Pilih **Tambahkan ke Layar Utama**.

---

## Deploy

Karena aplikasi ini hanya berisi file statis, Anda bisa meng-host folder `dist/` di layanan gratis seperti Vercel, Netlify, Cloudflare Pages, atau GitHub Pages.

### Vercel (disarankan)

1. Import folder proyek ke Vercel.
2. Framework preset: **Vite**.
3. Build command: `NODE_OPTIONS=--max-old-space-size=2048 npm run build`.
4. Output directory: `dist`.
5. Deploy, lalu buka `https://rf-uangku.vercel.app`.

Atau lewat CLI:

```bash
npx vercel login
npx vercel --prod
```

File `vercel.json` sudah disiapkan untuk build, header MIME `manifest.webmanifest`/`sw.js`/`assetlinks.json`, cache aset, dan fallback SPA. Setelah deploy, cek:

- `/` memuat aplikasi.
- `/manifest.webmanifest` disajikan sebagai `application/manifest+json`.
- `/sw.js` dan ikon bisa dibuka.
- `/.well-known/assetlinks.json` mengembalikan JSON, bukan HTML.
- `/transactions` tetap memuat aplikasi saat di-refresh.

Produksi saat ini: **https://rf-uangku.vercel.app**

### Netlify (fallback)

Netlify masih bisa dipakai, tetapi paket gratis menampilkan badge **“Powered by Netlify”** yang tidak bisa disembunyikan. Untuk APK final, gunakan URL Vercel.

1. Jalankan `npm run build`.
2. Buka [app.netlify.com/drop](https://app.netlify.com/drop).
3. Seret folder `dist` ke halaman tersebut.
4. Buka URL HTTPS yang diberikan, lalu pasang di HP.

File `public/_headers` sudah disiapkan agar `manifest.webmanifest` disajikan sebagai `application/manifest+json`. File `public/_redirects` menjaga fallback SPA saat halaman di-refresh.

### Membuat APK Android (PWABuilder/TWA)

1. Pastikan situs Vercel sudah aktif di HTTPS dan `manifest.webmanifest` serta `sw.js` bisa dibuka tanpa 404.
2. Buka [pwabuilder.com](https://www.pwabuilder.com), masukkan URL Vercel, lalu pilih **Android**.
3. Unduh paket APK. Di dalamnya ada `assetlinks.json` dan file keystore untuk update aplikasi.
4. Ambil `assetlinks.json` dari paket APK. Ganti `public/.well-known/assetlinks.json` jika package atau fingerprint berbeda, lalu build dan deploy ulang.
5. Pasang APK di HP, buat PIN, lalu restore backup JSON.

### Paket Android yang sudah dibuat

- `android/rf-uangku.apk` — APK yang bisa dipasang di HP.
- `android/rf-uangku.aab` — paket untuk Google Play Console.
- `android/signing.keystore` — keystore signing; **simpan jangan sampai hilang**.
- `android/signing-key-info.txt` — alias dan password keystore; **rahasia**.
- `android/rf-uangku-pwabuilder.zip` — paket asli dari PWABuilder.

Detail TWA:

- Package: `com.rf_uangku.twa`
- URL: `https://rf-uangku.vercel.app`
- Fingerprint SHA-256: `1F:8C:C0:53:4A:86:08:24:89:51:23:34:BF:EB:DE:9B:93:2C:ED:35:22:96:80:25:41:CB:8D:B2:5B:F1:D3:F1`

File `public/.well-known/assetlinks.json` sudah memakai fingerprint tersebut. File ini harus bisa diakses di `/.well-known/assetlinks.json` sebagai JSON agar APK tampil full-screen tanpa address bar.

### GitHub Pages

Jika di-host di sub-path (misalnya `https://username.github.io/rf-uangku/`), atur `base` di `vite.config.ts`:

```ts
export default defineConfig({
  base: '/rf-uangku/',
  // ...
})
```

Lalu build ulang. Untuk domain utama/Netlify, `base` tidak perlu diubah.

---

## Struktur Proyek

```text
RF Uangku/
├─ android/                  # APK, AAB, keystore, kredensial signing
├─ public/
│  ├─ .well-known/
│  │  └─ assetlinks.json     # verifikasi TWA Android
│  ├─ logo.svg
│  ├─ _redirects             # fallback SPA untuk Netlify
│  ├─ _headers               # MIME manifest untuk Netlify
│  └─ icons/                 # ikon PWA
├─ scripts/
│  ├─ generate-icons.mjs     # pembuat ikon dari logo.svg
│  └─ verify-data.ts         # cek cepat logika data (npm run verify)
├─ src/
│  ├─ components/
│  │  ├─ charts/             # grafik Recharts
│  │  ├─ dashboard/          # kartu ringkasan, transaksi terbaru, budget overview
│  │  ├─ layout/             # sidebar, bottom nav, topbar
│  │  ├─ planning/           # budget & transaksi berulang
│  │  ├─ pwa/                # prompt install/update/offline
│  │  ├─ reports/            # tabel laporan
│  │  ├─ settings/           # pengelolaan rekening & kategori
│  │  ├─ transactions/       # form, filter, tabel, kartu, chat AI
│  │  └─ ui/                 # tombol, input, modal, dll.
│  ├─ contexts/              # tema, toast, PIN/fingerprint lock
│  ├─ db/                    # Dexie, seed, backup, CRUD transaksi/budget/berulang
│  ├─ hooks/                 # live query & data dashboard
│  ├─ lib/                   # format, tanggal, analitik, Groq, PDF, PIN, biometric
│  ├─ pages/                 # Dashboard, Transaksi, Rencana, Laporan, Pengaturan
│  ├─ types/                 # tipe TypeScript
│  ├─ App.tsx
│  ├─ index.css
│  └─ main.tsx
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vercel.json               # build, header, dan fallback SPA untuk Vercel
└─ vite.config.ts
```

---

## Master Data Bawaan

**Rekening:** Tunai, BCA, BRI, Seabank, Blue BCA, Bank Jago, Gopay, Shopee Pay, Dana.

**Kategori pemasukan:** Bagi Hasil / Jaga Toko, Pendapatan Ojol / Gojek, Gaji Utama, Lain-lain.

**Kategori pengeluaran:** Makan / Minum Harian, Kebutuhan Keluarga dan Anak, Tagihan, Renovasi Rumah, Hiburan Keluarga, Sedekah, Lain-lain.

Rekening dan kategori bisa ditambah, diedit, diarsipkan, atau dihapus dari **Pengaturan → Rekening & Kategori**. Data yang sudah dipakai transaksi tidak bisa dihapus; gunakan **arsip** agar riwayat tetap aman. Data yang diarsipkan tidak muncul di form transaksi baru, tetapi tetap muncul di riwayat, laporan, dan saldo.

Untuk mengubah daftar **bawaan** (seed), edit `src/db/seed.ts` lalu reset data dari **Pengaturan → Backup & Data → Reset ke data awal** (hati-hati: transaksi ikut terhapus).

---

## Perintah Berguna

```bash
npm run dev        # jalankan server pengembangan
npm run build      # typecheck + build produksi ke dist/
npm run preview    # coba hasil build
npm run typecheck  # cek TypeScript saja
npm run verify     # cek cepat logika data (butuh fake-indexeddb + tsx)
npm run icons      # buat ulang ikon PWA dari public/logo.svg
```

---

## Troubleshooting

### Halaman kosong setelah `npm run dev`

- Pastikan Node.js versi 20.19+ atau 22.12+.
- Hapus `node_modules` dan `package-lock.json`, lalu `npm install` ulang.
- Buka console browser (F12) untuk melihat error.

### PIN tidak bisa dibuat

- Pastikan membuka lewat `localhost` atau HTTPS.
- Pada HTTP jaringan lokal, aplikasi memakai fallback hash; jika tetap gagal, coba lewat HTTPS.

### AI Groq error 401

API key salah atau sudah dihapus. Buat key baru di Groq Console, lalu simpan ulang di Pengaturan.

### AI Groq error 429

Kuota/rate limit Groq tercapai. Tunggu beberapa saat atau ganti model.

### Model Groq tidak tersedia atau error 404

Model mungkin sudah dinonaktifkan Groq. Buka **Pengaturan → AI Groq**, tekan **Cari model aktif** (butuh internet), pilih model yang muncul, lalu simpan dan tes koneksi.

### AI mengembalikan format tidak valid

Tulis transaksi lebih jelas, misalnya: `pengeluaran makan malam 35.000 pakai Tunai tanggal 9 November 2026`. Di **Chat AI**, jawab pertanyaan AI dengan nominal dan jenis transaksi yang jelas.

### Fingerprint tidak muncul atau gagal

- Pastikan perangkat punya sensor fingerprint dan sudah mendaftarkan sidik jari di pengaturan Android.
- Buka lewat HTTPS atau `localhost`; WebAuthn tidak berjalan di HTTP biasa.
- Fingerprint terikat origin. Credential Vercel tidak berlaku di Netlify/localhost, dan sebaliknya.
- Di APK/TWA, uji langsung di perangkat. Jika gagal, tetap gunakan PIN sebagai fallback.
- Reset PIN akan menghapus credential fingerprint. Aktifkan ulang dari **Pengaturan → Keamanan**.

### PWA tidak muncul tombol install

- Harus HTTPS atau `localhost`.
- Buka di Chrome Android (bukan browser dalam aplikasi lain).
- Coba menu browser → “Tambahkan ke layar utama”.
- Setelah install, aplikasi tetap butuh koneksi untuk fitur AI Groq, tetapi pencatatan dan laporan tetap jalan offline.

### Data hilang

Data IndexedDB bisa terhapus jika:
- membersihkan “Site data”/“Cookies and site data” di browser,
- memakai mode incognito,
- mengganti HP/browser,
- memakai domain/port yang berbeda.

Karena itu, **unduh backup JSON secara rutin**. Jika belum pernah backup, data yang terhapus tidak bisa dipulihkan.

### PDF tidak terunduh

- Pastikan ada transaksi pada periode yang dipilih.
- Coba browser Chrome terbaru.
- Jika memakai pemblokir pop-up, izinkan unduhan dari situs ini.

---

## Catatan Privasi

- Tidak ada backend, tidak ada akun, tidak ada analytics.
- Data transaksi dan foto profil tidak dikirim ke mana pun.
- Teks yang Anda masukkan ke fitur **Isi cepat AI** dan **Chat AI** dikirim ke Groq untuk diproses. Jangan menulis informasi sensitif di kolom AI.
- Saat menekan **Cari model aktif**, aplikasi mengirim API key ke Groq untuk mengambil daftar model. Proses ini membutuhkan koneksi internet.
- Riwayat **Chat AI** hanya disimpan di memori halaman dan tidak masuk backup.
- API key Groq tersimpan lokal dan hanya dipakai untuk memanggil Groq dari browser Anda.

---

## Lisensi

Dibuat untuk pemakaian pribadi. Silakan modifikasi sesuai kebutuhan.
