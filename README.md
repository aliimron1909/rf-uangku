# Omset-WarMad

## 1. Upload ke GitHub Pages
1. Buat repo publik bernama `Omset-WarMad`, upload semua file (termasuk folder `.well-known`).
2. Settings > Pages > Source: branch `main`, folder `/ (root)`.
3. Buka `https://<username>.github.io/Omset-WarMad/`.
> Penting: GitHub Pages memakai Jekyll yang mengabaikan folder berawalan titik. File kosong `.nojekyll` di root repo (sudah disertakan) membuat `.well-known/` ikut terbit. Jangan dihapus.

## 2a. Semua di Neon: sync, lisensi, pembayaran, admin (tanpa Google Sheet, cukup dari HP) - DISARANKAN
Sejak versi 3.3.0 tidak ada lagi Google Sheet atau Apps Script yang wajib dipakai. Satu database Neon menyimpan data omset pembeli (`api/sync.js`), lisensi dan pesanan Midtrans (`api/lisensi.js`), serta dibaca panel admin (`api/admin.js`). Kode bersama ada di `lib/`.

**Pemasangan baru (urut, semua dari HP):**
1. **Vercel > Storage > Create > Neon**, hubungkan ke proyek ini (Production + Preview). `DATABASE_URL` terisi otomatis. Semua tabel dibuat otomatis (awalan `wm_`), tidak ada SQL yang dijalankan manual.
2. **Vercel > Settings > Environment Variables** (Production), isi:

   | Nama | Isi |
   |---|---|
   | `MIDTRANS_SERVER_KEY` | server key Midtrans (salin dari Script properties lama bila sudah punya) |
   | `MIDTRANS_ENV` | `sandbox` atau `production` |
   | `HARGA` | harga Premium dalam rupiah, mis. `100000` (WAJIB; samakan dengan `PREMIUM_PRICE` di `index.html`) |
   | `ADMIN_PASSWORD`, `SESSION_SECRET`, `ADMIN_TOTP_SECRET` | untuk panel admin, lihat bagian Panel Admin |
3. **Redeploy** (Deployments > titik tiga > Redeploy), supaya fungsi baru dan `package.json` terpasang.
4. Cek dari browser: buka `https://domain-kamu/api/sync` (harus `"db":true`) dan `https://domain-kamu/api/lisensi` (harus `"ok":true`). Kalau `ok:false`, cek integrasi Neon lalu redeploy.
5. Jika aplikasi dihosting di domain lain (mis. GitHub Pages), isi `API_BASE` di `index.html` dengan alamat Vercel Anda, mis. `https://omset-warmad.vercel.app`. Kosongkan bila aplikasi dan API satu domain.

**Pindah dari Google Sheet lama (penjual yang sudah punya pembeli):**
1. Lakukan langkah 1 sampai 4 di atas. `LICENSE_URL` dan `ADMIN_KEY` lama **jangan dihapus dulu**.
2. Buka panel admin > **Pindahkan lisensi lama** > Mulai pindahkan. Semua lisensi (status, daftar perangkat, jatah, tanggal aktivasi) disalin ke Neon. Aman diulang; yang sudah ada tidak ditimpa. Riwayat pesanan lama tidak ikut disalin (tetap ada di Sheet).
3. Di dashboard Midtrans, ubah **Notification URL** menjadi `https://domain-kamu/api/lisensi` (jalur cadangan; jalur utama tetap pengecekan dari aplikasi).
4. Uji di Sandbox: **Bayar Premium via QRIS** sampai Premium aktif, lalu pastikan pesanan dan lisensi muncul di panel admin.
5. Aplikasi versi lama di HP pembeli tetap bicara ke Apps Script lama sampai mereka membuka versi baru. Biarkan Apps Script lama hidup beberapa minggu. Lisensi yang diaktifkan **setelah** pindah hanya ada di Neon, jadi pembeli yang belum memperbarui aplikasi tidak bisa mengaktifkannya sampai aplikasinya diperbarui.
6. Setelah semua pengguna aktif memakai versi baru: hapus `LICENSE_URL` dan `ADMIN_KEY` dari Vercel dan matikan deployment Apps Script. `Lisensi.gs` dan `Code.gs` tetap di repo hanya sebagai cadangan.

**Cara kerja bagi pembeli:** setelah membeli atau memasukkan kode lisensi, aplikasi otomatis menyiapkan sync cloud (Kode Pemilik dan URL terisi sendiri). Tidak ada langkah lain. Pasang di HP baru: masukkan kode lisensi yang sama, data kembali. Akses karyawan dan tautan undangan bekerja seperti sebelumnya.

**Pengguna lama yang memakai Google Sheet sendiri tidak diubah** (URL mereka tetap dipakai). Mereka bisa pindah dengan mengosongkan kolom URL dan Kode Pemilik di Pengaturan, lalu Simpan; data lokal di HP akan terunggah ke server pusat. Data di Sheet pribadi mereka tidak otomatis dipindah.

**Keamanan dan batas:**
- Tiap pembeli punya akun terpisah (satu akun per kode lisensi), data dipisah lewat `tenant_id`. Ada tes isolasi di `tests/server.js`.
- Lisensi dicabut/direset di panel admin berlaku seketika untuk aplikasi, sync, dan akses karyawan. Data tetap ada dan aktif kembali bila lisensi dipulihkan.
- Jatah perangkat dijaga dengan kunci baris database: aktivasi serentak dari banyak HP tetap tidak bisa melewati batas.
- Harga ditentukan server (`HARGA`), nominal pembayaran dicocokkan dengan pesanan, notifikasi Midtrans diverifikasi dengan signature SHA-512.
- Tebak-tebakan kode: satu IP yang salah 30 kali dalam 10 menit ditahan sementara. Pembuatan pesanan dibatasi 5 per perangkat per 24 jam dan 40 per jam untuk seluruh server.
- Anda memegang data usaha pembeli. Siapkan kebijakan privasi (UU PDP), backup rutin (Neon: branch/restore), dan pantau pemakaian Neon. Paket gratis berbatas 1 GB; bila penuh, penulisan baru gagal sampai Anda menambah ruang.
- Kode akses disimpan apa adanya di tabel `wm_akses` (agar pemilik bisa melihat dan membagikan kode karyawan). Siapa pun yang punya akses ke database bisa membacanya, jadi aktifkan 2FA di akun Neon, Vercel, dan GitHub.

**Melihat data di Neon:** Vercel > Storage > database > Open in Neon > SQL Editor. Tabel: `wm_lisensi`, `wm_pesanan`, `wm_tenant`, `wm_akses`, `wm_pen`, `wm_catatan`, `wm_log`, `wm_gagal`. Untuk sehari-hari cukup pakai panel admin (ringkasan pembeli tanpa isi catatan).

## 2b. Alternatif lama: Google Apps Script milik sendiri
1. Buat Google Sheet baru > Extensions > Apps Script, tempel isi `Code.gs`.
2. Deploy > New deployment > Web app: Execute as **Me**, access **Anyone**.
3. Di Google Sheet, muat ulang halaman, lalu pilih menu **Omset-WarMad > Siapkan akses (buat kode pemilik)** dan salin kode `PMK-...`. **Wajib:** server menolak semua permintaan sebelum langkah ini dijalankan.
4. Salin URL `/exec` ke Pengaturan > URL Web App, isi **Kode Pemilik** di kartu Profil, lalu tekan **Simpan Pengaturan & Sync Sheet**.
5. Setelah mengubah kode, buat deployment versi baru.

## 3. Build APK tanpa address bar (TWA)
Domain `https://<username>.github.io` dipakai bersama semua repo, jadi file Digital Asset Links harus ada di `https://<username>.github.io/.well-known/assetlinks.json` (repo khusus `<username>.github.io`). Alternatif: pakai custom domain untuk repo ini.
1. Buka pwabuilder.com, masukkan URL aplikasi, pilih **Android** (atau pakai `bubblewrap init --manifest=<url>/manifest.json`).
2. Isi package id, mis. `io.github.username.warmad`. Buat/unduh signing key.
3. Ambil **SHA-256 fingerprint** key (`keytool -list -v -keystore android.keystore`).
4. Edit `.well-known/assetlinks.json`: ganti `package_name` dan fingerprint, lalu publikasikan di lokasi pada langkah awal bagian ini.
5. Build APK, pasang di HP. Jika verifikasi berhasil, aplikasi tampil full-screen tanpa address bar.
6. Ikon: `icon-192.png` dan `icon-512.png` sudah disertakan (versi any & maskable) untuk PWABuilder/Bubblewrap.

## Catatan
- Notifikasi 09:00 andal saat aplikasi terbuka; saat tertutup bergantung dukungan Periodic Background Sync browser.
- Sidik jari (WebAuthn) butuh HTTPS dan kunci layar perangkat aktif.

## Multi Warung
- Pilih/ganti warung lewat menu di header; pilih "+ Tambah Warung" untuk menambah (gratis: 1 warung; Premium: sampai 5, lihat `FREE_WARUNG` dan `MAX_WARUNG` di `index.html`).
- Data lama otomatis menjadi warung pertama (id `w1`). Sheet lama `OmsetHarian` tetap dipakai.
- Tiap warung punya sheet sendiri (`OmsetHarian_<id>`). PIN, sidik jari, notifikasi, dan URL Apps Script dipakai bersama.
- Menghapus warung di aplikasi tidak menghapus sheet-nya di Google Sheets.
- **Wajib:** tempel `Code.gs` terbaru lalu buat deployment versi baru.
- Status Premium sementara diatur lewat tombol uji di Pengaturan kartu 5, nanti diganti aktivasi kode lisensi.

## Paket Gratis vs Premium
- **Gratis:** 1 warung, input & rekap, dashboard + grafik harian, PIN, backup JSON/CSV, PDF berwatermark (maks 1x/bulan, tanpa logo).
- **Premium:** sampai 5 warung, Sync Google Sheets, PDF tanpa watermark & tanpa batas dengan logo, sidik jari, notifikasi 09:00, grafik per siklus, foto/logo warung.

## Pembayaran Otomatis (Midtrans) & Lisensi - cara lama (Google Sheet)
> Sejak 3.3.0 lisensi dan pembayaran berjalan di Neon (bagian 2a). Langkah di bawah hanya untuk yang masih memakai `Lisensi.gs`.

1. Daftar akun Midtrans sebagai perorangan, lalu pastikan QRIS bisa diaktifkan di akun Anda dan tanyakan tarif untuk produk digital. Mulai dengan mode **Sandbox**.
2. Buat Google Sheet **terpisah milik Anda**, tempel `Lisensi.gs`. Di Project Settings > Script properties isi `MIDTRANS_SERVER_KEY`, `MIDTRANS_ENV` (`sandbox` atau `production`), dan `HARGA` (mis. `50000`). Server key hanya disimpan di sini, jangan di `index.html`.
3. Deploy Web app (Anyone), salin URL `/exec`.
4. Di bagian atas script `index.html` isi `LICENSE_URL`, `ADMIN_WA` (bantuan), dan `PREMIUM_PRICE` (hanya tampilan; harga asli ditentukan `HARGA` di server, samakan keduanya).
5. Uji di Sandbox: tekan **Bayar Premium via QRIS**, selesaikan pembayaran uji, kembali ke aplikasi. Premium aktif otomatis dan kode tercatat di sheet `Lisensi`; riwayat di sheet `Pesanan`.
6. Siap jualan: ganti server key produksi dan `MIDTRANS_ENV=production`, buat deployment versi baru.
7. (Opsional) Isi Notification URL di dashboard Midtrans dengan URL `/exec` sebagai jalur cadangan. Jalur utama tetap pengecekan status dari aplikasi.
- Satu kode untuk maksimal 3 perangkat (kolom `maks_perangkat`); reset kolom `perangkat` menjadi `[]` bila pembeli kehabisan jatah. Pengecekan berkala (tiap 7 hari) kini juga memastikan perangkat itu pernah mengaktifkan kode; perangkat yang belum terdaftar kehilangan Premium. Jadi jika pembeli menghapus data aplikasi (ID perangkat baru), ia perlu memasukkan kodenya lagi dan itu memakai 1 dari 3 jatah. Cabut lisensi: ubah `status` menjadi `dicabut` (dicek ulang tiap 7 hari saat online).
- Menu **Lisensi** di sheet tetap bisa membuat kode manual (hadiah, pembeli transfer).
- Setiap ganti kode `Lisensi.gs`, buat deployment versi baru.

## Akses Karyawan lewat Sheet (Tahap 2)
**Pemasangan (sekali, oleh pemilik)**
1. Tempel `Code.gs` terbaru di Apps Script Sheet Anda, Save, lalu muat ulang Sheet.
2. Menu **Omset-WarMad > Siapkan akses (buat kode pemilik)**. Salin kode `PMK-...` yang muncul.
3. Deploy > Manage deployments > Edit > **New version** (URL `/exec` tetap sama).
4. Di aplikasi: Pengaturan > Profil > isi **Kode Pemilik** > Simpan Pengaturan & Sync Sheet.
- Server selalu menolak permintaan tanpa kode yang valid. Sebelum langkah 2 dijalankan, semua permintaan ditolak (tidak ada lagi mode lama tanpa kode).

**Membuat akses karyawan**
- Dari aplikasi: Pengaturan > **Akses Karyawan** > pilih warung, isi nama > Buat Kode Karyawan > **Kirim Tautan** (WhatsApp).
- Atau langsung di Sheet **Akses**: tambah baris `kode | karyawan | cabang_id | nama | aktif` (lihat `cabang_id` di sheet **Cabang**), atau pakai menu "Tambah baris kode karyawan".
- Cabut akses: tombol **Cabut** di aplikasi, atau ubah kolom `status` menjadi `dicabut`.

**Di HP karyawan**: pasang aplikasi, buka tautan dari pemilik (atau isi URL dan kode di layar sambutan). Karyawan hanya melihat satu warung, tab Input dan Rekap. Di Rekap karyawan melihat ringkasan bagi hasil yang sama dengan pemilik, dan bisa kirim slip WhatsApp serta download PDF (PDF mengikuti status Premium pemilik). Karyawan bisa input dan edit omset, tapi tidak bisa menghapus atau mengubah potongan kontrak. Tombol **Keluar akun karyawan** ada di bagian bawah.

**Batasan**: pengamanan berbasis kode. Catatan yang dihapus pemilik bisa muncul lagi jika HP karyawan masih menyimpannya. Perubahan pemilik pada catatan lama tidak otomatis menimpa salinan di HP karyawan.

**1 kode = 1 perangkat**: kode terikat ke HP yang pertama memakainya (kolom `perangkat` di sheet Akses). HP lain ditolak. Untuk pindah HP: tombol **Lepas HP** di aplikasi (kartu Akses Karyawan) atau kosongkan kolom `perangkat` di sheet. Menghapus data aplikasi di HP karyawan juga membuat ID perangkat baru, jadi pemilik perlu melepasnya dulu.
**Wajib**: tempel `Code.gs` terbaru dan buat deployment versi baru. Status Premium pemilik diteruskan ke karyawan selama pemilik masih sync (berlaku 14 hari sejak sync terakhir).

## Nama Karyawan per Siklus & Harga
- Pengaturan > Penjaga & Pengingat: tiap siklus punya mode penjaga dan nama karyawan sendiri. Siklus baru otomatis mengikuti siklus terakhir. Kolom "Nama Karyawan 1/2 (default)" di Profil hanya dipakai untuk siklus yang belum punya nama sendiri.
- Nama per siklus dipakai di Dashboard (kartu per orang, "Semua Siklus" menjumlahkan per nama), Rekap, slip WhatsApp, dan PDF.
- Tersimpan di Sheet: sheet **Penjaga** (ringkasan: warung, siklus, mode, potongan kontrak, karyawan 1 dan 2) dan sheet **Pengaturan** (sumber data aplikasi). Sheet Penjaga hanya untuk dibaca; ubah lewat aplikasi.
- Harga Premium 100 ribu: ubah juga `HARGA` di Script Properties server lisensi menjadi `100000` (harga asli ditentukan server). Tampilan di aplikasi memakai `PREMIUM_PRICE`.

## Cek Stok Serah Terima (selisih stok per siklus)
- Rekap > kartu **Cek Stok Serah Terima**: isi nilai stok akhir saat ganti karyawan. Stok awal otomatis diambil dari stok akhir siklus sebelumnya (bisa diubah). Selisih = akhir - awal.
- **Plus**: dibagi seperti bagi hasil (25/75, 50/50, 25/25/50) langsung dari nilai selisih, tanpa potongan kontrak. Mode pemilik saja: seluruhnya ke pemilik.
- **Minus**: ditanggung karyawan yang ganti (suami istri atau 1 karyawan 100%, 2 karyawan masing-masing 50%). Bagian pemilik tidak berubah. Bila minus lebih besar dari bagian karyawan, angkanya tampil negatif dengan keterangan "Kurang bayar ke pemilik".
- Tampil di Dashboard (kartu Selisih Stok, rincian "Bagi hasil + Stok" per orang), Rekap, slip WhatsApp, dan PDF. Karyawan hanya melihat hasilnya; input hanya untuk pemilik.
- Tersimpan di sheet Pengaturan (`cycleStok`) dan sheet Penjaga (kolom stok_awal, stok_akhir, selisih_stok). Ikut Backup JSON. Tempel `Code.gs` terbaru dan buat deployment versi baru.

## Sistem Penjaga Fleksibel (gaji, bagi hasil, tanpa batas jumlah)
- Pengaturan > Pengingat & Penjaga Warung > **Penjaga per siklus**. Mode baru: **Pemilik Suami Istri + 1 Karyawan (Gaji)** dan **Kustom (Bebas)**. Mode lama tidak berubah.
- Mode Kustom: tambah penjaga sebanyak apa pun. Tiap penjaga punya nama dan sistem **Gaji** atau **Bagi hasil**. Ada kolom **porsi pemilik (%)** untuk penjaga bagi hasil; 0% berarti seluruh bagi hasil untuk penjaga dan pemilik hanya menerima kontrak.
- Tabungan = omset x persentase tabungan (bawaan warung baru **10%**).
- **Gaji** dihitung prorata untuk siklus kurang dari 30 hari (gaji x hari / 30), dipotong dari tabungan, tanpa potongan kontrak.
- **Kontrak** (Rp 0 / prorata / full) hanya berlaku bila ada minimal satu penjaga bagi hasil, dan dipotong dari sisa tabungan.
- Pemilik = porsi% x (tabungan - gaji - kontrak) + kontrak. Penjaga bagi hasil = sisa porsi dibagi rata. Tanpa penjaga bagi hasil: pemilik = tabungan - gaji.
- **Selisih stok**: plus dibagi ke pemilik dan penjaga bagi hasil sesuai porsi (penjaga bergaji tidak ikut); minus dibagi rata ke semua penjaga, pada sistem gaji memotong gaji.
- Siklus baru otomatis menyalin daftar penjaga siklus terakhir; mengubah siklus baru tidak mengubah siklus lama.
- Tampil di Dashboard, Rekap, slip WhatsApp, dan PDF (satu baris per penjaga). Tersimpan di Sheet (Pengaturan `cyclePenjaga`, ringkasan di sheet Penjaga) dan ikut Backup JSON dan HP karyawan. Karyawan yang melihat Rekap juga melihat gaji penjaga lain di siklus itu.
- Tempel `Code.gs` terbaru dan buat deployment versi baru.

## Keamanan (versi 3.1.6)
- **Server menolak semua permintaan tanpa kode.** Sebelumnya, sebelum menu "Siapkan akses" dijalankan, siapa pun yang tahu URL `/exec` bisa membaca dan menimpa seluruh data omset.
- **Kode akses tidak lagi dikirim lewat URL.** Tarik data dan verifikasi memakai POST, jadi kode tidak tersimpan di riwayat browser atau log. Tautan undangan karyawan tetap memuat kode; aplikasi menghapusnya dari address bar begitu formulir terisi. Kirim tautan hanya ke karyawan yang dituju.
- **Kode baru dibuat dengan pembangkit acak yang aman** dan lebih panjang: `PMK-XXXX-XXXX-XXXX`, `KRY-XXXX-XXXX-XXXX`, `WARMAD-XXXX-XXXX-XXXX` (12 karakter acak). Kode lama tetap berlaku dan tidak perlu diganti.
- **Pembatasan percobaan:** Google Apps Script tidak bisa melihat alamat IP, jadi tidak ada kunci total (penyerang justru bisa mengunci pemilik). Sebagai gantinya, kode yang jelas salah ditolak cepat tanpa antre, dan lonjakan 30 percobaan salah dalam 10 menit dicatat di sheet **Log**. Periksa sheet ini sesekali; bila ada catatan, ganti kode yang bersangkutan.
- **Wajib setelah memperbarui:** tempel `Code.gs` dan `Lisensi.gs` terbaru, lalu buat **deployment versi baru** di masing-masing Apps Script. Aplikasi versi lama tidak bisa sync sampai dibuka ulang (jaringan tersambung) agar memuat versi 3.1.6.

## Perubahan versi 3.1.7
- **Batas pembuatan pesanan** (`Lisensi.gs`): maksimal 5 pesanan baru per perangkat per 24 jam dan 40 pesanan baru per jam untuk seluruh server (penjualan nyata jauh di bawah itu). Pesanan yang belum dibayar lebih dari 7 hari dibersihkan otomatis. Bila batas global tercapai, sheet **Log** mencatatnya; pembeli bisa meminta kode manual lewat tombol bantuan WhatsApp.
- **Batas 3 perangkat kini benar-benar berlaku:** sebelumnya hanya dicek saat aktivasi, sehingga kode yang dibagikan bisa dipakai di perangkat tak terbatas lewat pengecekan berkala.
- **Cap waktu pengecekan lisensi di masa depan** tidak lagi menunda pengecekan selamanya.
- **Tailwind dikunci ke versi 3.4.17.** Sebelumnya tanpa versi sehingga isinya bisa berubah sewaktu-waktu di luar kendali kita.
- **Tes otomatis** (`tests/run.js`) dan pengecekan otomatis di GitHub (tab **Actions**, centang hijau = lulus). Jalankan lokal dengan `node tests/run.js` (butuh Node.js 18+, tanpa instalasi paket). Jalankan juga sebelum mengunggah perubahan.
- **`.gitignore`** mencegah kunci tanda tangan Android (`*.keystore`, `*.jks`) dan file rahasia ikut ter-commit.
- Naikkan nomor versi di `sw.js` (`warmad-vX.Y.Z`) setiap kali `index.html` berubah agar HP memuat versi terbaru.

## Batasan yang perlu diketahui
- **Premium adalah pagar lunak.** Kode aplikasi berjalan di HP pengguna dan repo ini publik, sehingga orang yang paham teknis bisa membuat salinan aplikasi tanpa pembatasan Premium. Yang tidak bisa ditembus hanyalah hal yang dicek server: aktivasi kode, batas 3 perangkat, dan pencabutan lisensi.
- **Pustaka CDN** (Chart.js, jsPDF, Font Awesome, Tailwind) sudah dikunci ke versi tertentu tetapi belum memakai SRI atau salinan sendiri (self-host); keduanya perlu akses internet untuk menghitung hash/mengunduh file. Tailwind Play CDN juga memang ditujukan untuk pengembangan; mengganti ke CSS hasil build sebaiknya dilakukan terpisah dan diuji di HP sungguhan.

## Hak Cipta
Hak Cipta (c) 2026 aliimron1909. Seluruh hak dilindungi. Kode ini dipublikasikan hanya untuk dilihat; dilarang menjual, menyalin, memodifikasi, atau mendistribusikan ulang tanpa izin tertulis. Lihat berkas `LICENSE`.

## Panel Admin (Vercel)
> Sejak 3.3.0 panel membaca langsung dari Neon: `ADMIN_KEY` dan `LICENSE_URL` hanya diperlukan untuk tombol **Pindahkan lisensi lama** satu kali. Langkah 1 di bawah (Apps Script) tidak lagi wajib. Panel juga menampilkan **Pembeli & data cloud** (nama warung, jumlah catatan, total omset, sync terakhir; isi catatan tidak ditampilkan).

Halaman `/admin.html` untuk mengelola lisensi dari HP: ringkasan penjualan, cari lisensi (kode, nama, atau ID Perangkat), cabut/aktifkan, reset perangkat, ubah jatah perangkat, buat kode manual, lihat pesanan dan Log keamanan.

**Cara kerja (kenapa aman walau halamannya terbuka):** halaman ini hanya tampilan. Semua kuasa ada di server: browser login ke `/api/admin` (Vercel Function), lalu fungsi itulah yang memanggil Apps Script memakai `ADMIN_KEY` yang hanya tersimpan di pengaturan Vercel dan Script properties, tidak pernah ada di kode atau di browser. Sesi memakai cookie `HttpOnly` + `Secure` + `SameSite=Strict` berlaku 12 jam.

**Pemasangan (urut):**
1. **Apps Script lisensi:** tempel `Lisensi.gs` terbaru. Di Project Settings > Script properties tambah `ADMIN_KEY` berisi string acak minimal 32 karakter (buat dengan pembuat kata sandi di HP, jangan diketik asal dan jangan dikirim lewat chat). Lalu Deploy > Manage deployments > Edit > **New version**.
2. **Vercel > Settings > Environment Variables** (Production), lalu **Redeploy**:

   | Nama | Isi |
   |---|---|
   | `ADMIN_PASSWORD` | kata sandi panel, minimal 12 karakter (kalimat panjang lebih baik) |
   | `SESSION_SECRET` | string acak minimal 32 karakter, berbeda dari lainnya |
   | `ADMIN_KEY` | **sama persis** dengan Script property `ADMIN_KEY` |
   | `LICENSE_URL` | URL `/exec` Apps Script lisensi |
   | `ADMIN_TOTP_SECRET` | (opsional, sangat disarankan) kunci 2FA, lihat di bawah |
3. **Batasi percobaan login:** di Vercel > project > **Firewall**, buat aturan Rate Limit untuk path `/api/admin` (misalnya 10 permintaan per menit per IP). Kode juga mengunci sebuah IP 15 menit setelah 5 kali salah, tetapi itu hanya upaya terbaik karena fungsi Vercel bisa berpindah instance.
4. **2FA (opsional):** buat string acak 16 sampai 32 karakter dari huruf `A-Z` dan angka `2-7`, isi sebagai `ADMIN_TOTP_SECRET`, lalu di aplikasi authenticator (Google Authenticator dll.) pilih tambah akun > **masukkan kunci setelan** > jenis berdasarkan waktu. Saat login kamu akan diminta kode 6 digit.
5. Buka `https://domain-kamu/admin.html`, lalu simpan ke layar utama HP.

**Jika ada masalah keamanan:** HP hilang atau kata sandi bocor: ganti `ADMIN_PASSWORD` dan `SESSION_SECRET` (mengeluarkan semua sesi). `ADMIN_KEY` bocor: buat yang baru dan ganti di **kedua** tempat (Script properties dan Vercel). Tanda serangan: sheet **Log** di server lisensi mencatat "kunci admin" atau "aktivasi kode" yang gagal bertubi-tubi.

**Batasan:** panel menampilkan ringkasan data cloud pembeli, bukan isi catatan harian mereka. Hanya satu admin. Paket Hobby Vercel ditujukan untuk penggunaan non-komersial; karena aplikasi ini menjual lisensi, periksa ketentuan Vercel dan pertimbangkan paket Pro.

## Perubahan versi 3.1.8
- Panel admin (lihat di atas): `admin.html`, `admin.js`, `api/admin.js`, `vercel.json`, dan aksi `adm_*` di `Lisensi.gs`.
- `sw.js` tidak lagi menyentuh `/admin` dan `/api` (sebelumnya semua file di-cache, sehingga pembaruan panel tidak akan pernah terlihat).


## Perubahan versi 3.2.0
- **Sync Cloud pusat** (`api/sync.js`, Neon Postgres): pembeli Premium tidak perlu membuat Google Sheet sendiri. Aplikasi otomatis menyiapkan sync saat Premium aktif (`autoRegister` di `index.html`). Lihat bagian 2a.
- Mode lama (Google Sheet milik sendiri lewat `Code.gs`) tetap berfungsi untuk pengguna yang sudah memakainya.
- Teks di aplikasi diganti dari "Sync Google Sheets" menjadi "Sync Cloud".
- Tes baru di `tests/run.js` untuk server sync (register, isolasi antar akun, akses karyawan, cek ulang lisensi, pembatasan tebakan). Tes memakai penyimpanan tiruan di memori, sehingga tetap tanpa instalasi paket.
- `package.json` baru memuat dependensi `pg` untuk fungsi Vercel. Naikkan `warmad-vX.Y.Z` di `sw.js` setiap `index.html` berubah (sudah v3.2.0).

## Perubahan versi 3.3.0
- **Lisensi dan pembayaran Midtrans pindah ke Neon** (`api/lisensi.js`, `lib/`). Protokol dengan aplikasi tidak berubah; `LICENSE_URL` di `index.html` kini otomatis menunjuk `/api/lisensi`. Harga wajib diatur lewat `HARGA` di Vercel.
- **Panel admin** membaca langsung dari Neon, ditambah layar **Pembeli & data cloud** dan tombol **Pindahkan lisensi lama**.
- Sync cloud memeriksa status lisensi langsung dari tabel lisensi (tidak lagi tiap 24 jam), sehingga pencabutan di admin berlaku seketika.
- `index.html`: `SYNC_URL` diganti `API_BASE`. Naikkan `warmad-vX.Y.Z` di `sw.js` setiap `index.html` berubah (sekarang v3.3.0).
- Tes: `tests/server.js` + `tests/memstore.js` (sync, lisensi, Midtrans, admin, impor). Total 153 pemeriksaan di `node tests/run.js`.
