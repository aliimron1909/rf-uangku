# Notifikasi push (pengingat "belum mencatat hari ini")

Pengingat harian bawaan hanya muncul saat aplikasi terbuka. Dengan push dari Supabase,
server memeriksa tiap 5 menit apakah kamu **sudah mencatat hari ini** dan, bila belum serta
sudah lewat jam pilihanmu, mengirim notifikasi ke HP walau aplikasi tertutup.

Syarat: sinkronisasi Supabase aktif dan sudah login Google (server perlu tahu ada-tidaknya
catatan hari ini). Android Chrome didukung penuh. iPhone hanya bila aplikasi dipasang ke
Layar Utama (iOS 16.4+).

Alur: pg_cron (tiap 5 menit) → Edge Function `daily-reminder` → cek `sync_records` →
kirim Web Push ke `push_subscriptions` → service worker (`public/push-sw.js`) menampilkan notifikasi.
Satu jam pengingat per hari berlaku untuk semua perangkat akun. Pengingat dikirim maksimal
sekali per hari dan hanya dalam 3 jam setelah jam pilihan.

## Langkah pengaturan (sekali saja, cukup dari HP)

Semua langkah bisa dilakukan lewat browser HP (Chrome). Untuk dashboard Supabase dan Vercel,
nyalakan **Situs desktop** di menu Chrome (⋮) agar tampilannya lengkap.

### 1. Buat kunci VAPID (di HP)
Buka `https://<alamat-aplikasimu>/vapid.html`, tekan **Buat kunci baru**, lalu simpan
**Public Key** dan **Private Key** di catatan pribadi. Private key jangan dibagikan.
(Pengguna komputer bisa memakai `npx web-push generate-vapid-keys`.)

### 2. Jalankan SQL
Supabase → **SQL Editor** → **New query** → tempel isi `supabase/push.sql` → **Run**.

### 3. Isi secrets fungsi
Supabase → **Edge Functions → Secrets** → tambahkan empat secret:

| Nama | Isi |
| --- | --- |
| `VAPID_PUBLIC_KEY` | Public Key |
| `VAPID_PRIVATE_KEY` | Private Key |
| `VAPID_SUBJECT` | `mailto:emailmu@example.com` |
| `CRON_SECRET` | teks acak panjang buatanmu (mis. 32 huruf/angka), catat untuk langkah 5 |

### 4. Buat fungsi (lewat editor, tanpa CLI)
Supabase → **Edge Functions → Deploy a new function → Via Editor**. Beri nama
`daily-reminder`, hapus isi contoh, tempel **seluruh** isi `supabase/functions/daily-reminder/index.ts`,
lalu **Deploy**. Setelah jadi, buka pengaturan fungsi dan **matikan Verify JWT**
(fungsi memeriksa `x-cron-secret` / token login sendiri).

### 5. Jadwalkan
Supabase → **Database → Extensions**: aktifkan `pg_cron` dan `pg_net`. Lalu di **SQL Editor**
jalankan bagian jadwal (yang dikomentari) di akhir `push.sql` setelah mengganti `<ID-PROYEK>`
dan `<CRON_SECRET>`.

### 6. Vercel
**Project → Settings → Environment Variables**: tambahkan `VITE_VAPID_PUBLIC_KEY` = Public Key,
lalu **Redeploy**.

### 7. Di aplikasi
Pengaturan → Notifikasi → nyalakan *Ingatkan jika belum mencatat hari ini* →
*Aktifkan pengingat push* → izinkan notifikasi → *Kirim tes*.

Pengguna komputer dapat memakai Supabase CLI untuk langkah 3–4:
`supabase secrets set ...` dan `supabase functions deploy daily-reminder --no-verify-jwt`.

## Catatan
- Hanya **public key** yang masuk ke aplikasi; private key dan `CRON_SECRET` hanya di Supabase.
- Bila push aktif di sebuah perangkat, pengingat lokal di perangkat itu dimatikan agar tidak ganda.
- Catatan yang dibuat offline dan belum tersinkron bisa membuat server mengira belum mencatat.
- Mematikan push menghapus langganan perangkat itu dari server.
