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

## Langkah pengaturan (sekali saja)

1. **Buat kunci VAPID** (di komputer mana pun yang punya Node): `npx web-push generate-vapid-keys`.
   Catat *Public Key* dan *Private Key*. Private key jangan dibagikan.
2. **Jalankan SQL**: tempel `supabase/push.sql` di SQL Editor lalu Run.
3. **Pasang Supabase CLI** dan deploy fungsi dari folder proyek:
   ```
   supabase login
   supabase link --project-ref <ID-PROYEK>
   supabase secrets set VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> \
     VAPID_SUBJECT=mailto:emailmu@example.com CRON_SECRET=<teks-acak-panjang>
   supabase functions deploy daily-reminder --no-verify-jwt
   ```
4. **Jadwalkan**: di **Database → Extensions** aktifkan `pg_cron` dan `pg_net`, lalu di SQL Editor
   jalankan bagian jadwal yang dikomentari di akhir `push.sql` setelah mengganti
   `<ID-PROYEK>` dan `<CRON_SECRET>` (sama dengan langkah 3).
5. **Vercel**: tambahkan env `VITE_VAPID_PUBLIC_KEY` = public key, lalu Redeploy.
6. **Di aplikasi**: Pengaturan → Notifikasi → nyalakan *Ingatkan jika belum mencatat hari ini* →
   *Aktifkan pengingat push* → izinkan notifikasi → *Kirim tes*.

## Catatan
- Hanya **public key** yang masuk ke aplikasi; private key dan `CRON_SECRET` hanya di Supabase.
- Bila push aktif di sebuah perangkat, pengingat lokal di perangkat itu dimatikan agar tidak ganda.
- Catatan yang dibuat offline dan belum tersinkron bisa membuat server mengira belum mencatat.
- Mematikan push menghapus langganan perangkat itu dari server.
