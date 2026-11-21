# Pedoman proyek RF Uangku

## Penomoran versi (dinaikkan sendiri tanpa menunggu diminta)
Naikkan `APP_VERSION` di `src/lib/constants.ts` dan `version` di `package.json` + `package-lock.json`
dalam satu PR terpisah bernama `chore: versi X.Y.Z`, setelah satu paket perubahan selesai dan di-merge:

- **Patch (1.1.0 → 1.1.1):** kumpulan perbaikan kecil, misalnya bug dan tampilan.
- **Minor (1.1.0 → 1.2.0):** fitur BARU yang berdiri sendiri dan terlihat pengguna.
- **Major (→ 2.0.0):** perubahan besar, misalnya data lama harus dimigrasi atau tampilan berubah total.

Pemilik proyek tidak mau angka versi naik terlalu cepat: bila ragu pilih tingkat yang lebih rendah.
Penyempurnaan fitur yang sudah ada (mis. notifikasi untuk fitur update yang sudah ada, tampilan, pesan) = patch.

Nomor build (versionCode) naik otomatis tiap merge ke main, jadi versi tidak perlu dinaikkan tiap merge.
Naikkan versi saat satu paket fitur/perbaikan selesai, lalu beri tahu pengguna di ringkasan.

## Alur kerja
- Satu commit per fitur, cabang dari `origin/main` terbaru, pastikan CI + Build APK Native hijau sebelum memberi tautan PR.
- Pengguna bekerja dari HP: semua langkah harus bisa lewat GitHub web / dashboard Supabase.
- Judul dan deskripsi squash-merge menjadi isi Changelog di aplikasi; tulis ringkas dalam bahasa Indonesia.
