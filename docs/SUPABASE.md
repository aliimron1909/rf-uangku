# Sinkronisasi Supabase

RF Uangku tetap local-first. Sinkronisasi cloud bersifat opsional dan baru aktif setelah
Anda mengisi dua variabel lingkungan di bawah. Tanpa itu, aplikasi berjalan seperti biasa.

## Cara kerja singkat

- Login memakai Google (lewat Supabase Auth).
- Setiap record (transaksi, rekening, budget, foto struk, dst.) disimpan sebagai JSON biasa
  di proyek Supabase **milik Anda sendiri**. Tidak ada frasa sandi; keamanan dijaga oleh
  login Google dan Row Level Security (hanya akun pemilik yang bisa membaca/menulis).
  Karena tidak dienkripsi, pemilik proyek Supabase bisa membaca isinya di dashboard.
- Perubahan dideteksi otomatis dan dikirim; perubahan dari perangkat lain diterima.
- Konflik pada record yang sama: versi dengan waktu perubahan terbaru yang dipakai.
  Penghapusan ikut tersebar ke perangkat lain.
- **Tidak ikut disinkronkan:** PIN, API key Groq, tema, dan pengaturan lain.
- Opsi *Hapus data cloud lalu unggah ulang* di Pengaturan mengosongkan cloud dan mengirim
  ulang data dari perangkat itu.

## Migrasi dari versi terenkripsi

1. **Unduh backup JSON** dulu (Pengaturan → Backup & Data).
2. Jalankan `supabase/schema.sql` lagi di SQL Editor: data cloud lama (terenkripsi) dihapus
   dan kolomnya diganti `data jsonb`.
3. Buka aplikasi di HP; sinkronisasi pertama mengunggah ulang seluruh data perangkat itu.
   Perangkat lain tinggal masuk lagi, otomatis menerima data dari cloud.

## Langkah pengaturan (sekali saja)

### 1. Buat proyek Supabase
1. Daftar di https://supabase.com lalu buat proyek baru (paket Free).
2. Buka **Project Settings → API**. Catat **Project URL** dan **anon public key**.
   Jangan pernah memakai `service_role`.

### 2. Buat tabel
Buka **SQL Editor**, tempel seluruh isi `supabase/schema.sql`, lalu tekan **Run**.
Skrip ini membuat tabel dan aturan keamanan (RLS) agar setiap akun hanya bisa
mengakses datanya sendiri.

### 3. Aktifkan login Google
1. Di https://console.cloud.google.com buat proyek, lalu isi **OAuth consent screen**.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
3. Pada **Authorized redirect URIs** isi:
   `https://<ID-PROYEK-SUPABASE>.supabase.co/auth/v1/callback`
4. Salin **Client ID** dan **Client secret**.
5. Di Supabase: **Authentication → Providers → Google**, aktifkan, lalu tempel keduanya.

### 4. Izinkan alamat aplikasi
Di Supabase: **Authentication → URL Configuration**
- **Site URL**: alamat produksi, mis. `https://rf-uangku.vercel.app`
- **Redirect URLs**: tambahkan `https://rf-uangku.vercel.app/**` (dan alamat lain yang
  dipakai, termasuk `http://localhost:5173/**` untuk pengembangan).

### 5. Isi variabel lingkungan
Di Vercel: **Project → Settings → Environment Variables**, tambahkan:

| Nama | Isi |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL (mis. `https://abcd1234.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | anon public key |

Jika Anda memakai integrasi Supabase di Vercel, variabel `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` yang dibuatnya juga dikenali, jadi langkah ini bisa dilewati. Jangan pernah menamai ulang `SUPABASE_SERVICE_ROLE_KEY` dengan awalan `VITE_` atau `NEXT_PUBLIC_`.

Lalu **Redeploy**. Untuk pengembangan lokal, salin `.env.example` menjadi `.env.local`.

### 6. Pakai di aplikasi
**Pengaturan → Sinkronisasi cloud → Masuk dengan Google.**
Di perangkat kedua, masuk dengan akun yang sama.

## Catatan penting

- Perangkat baru yang tersambung pertama kali **mendahulukan data cloud** untuk record yang
  ID-nya sama (misalnya rekening bawaan), lalu mengunggah data lokal yang belum ada di cloud.
- Menghapus transaksi, mereset data, atau memulihkan backup di satu perangkat akan
  diteruskan ke cloud dan perangkat lain. Unduh backup JSON sebelum operasi besar.
- Sinkronisasi berjalan saat aplikasi terbuka (saat data berubah, saat dibuka kembali, dan
  tiap beberapa menit). Perubahan yang dibuat offline dikirim saat kembali online.
- Foto struk ikut disinkronkan dan memakai kuota database paket gratis (500 MB).
- Jam perangkat yang jauh melenceng bisa memengaruhi penentuan "versi terbaru".
- Proyek Supabase paket gratis dijeda bila tidak ada aktivitas 7 hari; lanjutkan lewat dashboard.
