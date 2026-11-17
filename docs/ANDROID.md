# Membangun APK di GitHub

APK adalah pembungkus TWA yang membuka `https://rf-uangku.vercel.app`, jadi fitur web
ikut terbarui tanpa memasang ulang APK. APK hanya perlu dibangun ulang bila ikon, nama,
atau pengaturan Android berubah. Semua dilakukan di server GitHub (workflow `Build APK`),
cukup dari HP.

## Sekali saja: simpan kunci tanda tangan lama sebagai secret

Pakai **keystore yang sama** dengan APK lama (dari paket PWABuilder: `signing.keystore` dan
`signing-key-info.txt`) agar APK baru bisa menimpa yang lama dan `assetlinks.json` tetap cocok.

1. Buka `https://rf-uangku.vercel.app/keystore-base64.html`, pilih `signing.keystore`,
   lalu **Salin teks Base64** (berkas tidak dikirim ke mana pun).
2. GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**.
   Buat empat secret:

| Nama | Isi |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | teks Base64 dari langkah 1 |
| `ANDROID_KEYSTORE_PASSWORD` | *Key store password* dari `signing-key-info.txt` |
| `ANDROID_KEY_ALIAS` | *Key alias* dari `signing-key-info.txt` |
| `ANDROID_KEY_PASSWORD` | *Key password* dari `signing-key-info.txt` (kosongkan bila sama dengan store password: isi saja dengan nilai yang sama) |

## Membangun

**Actions → Build APK → Run workflow** (pilih branch `main`). Sekitar 2 menit kemudian:
- APK muncul di **Releases** (nama `rf-uangku.apk`), dan
- salinan di **Artifacts** pada halaman run (disimpan 30 hari).

Unduh `rf-uangku.apk` dari Releases di HP lalu pasang (izinkan "pasang dari sumber ini").
Versi (`versionCode`) naik otomatis tiap build.

## Tanpa secret kunci
Workflow tetap jalan memakai kunci sementara, tetapi hasilnya hanya tersedia di Artifacts
(tidak dirilis), dan karena tanda tangannya tidak cocok dengan `assetlinks.json`, aplikasi
menampilkan bilah alamat browser. Pakai ini hanya untuk uji coba.

## Bila keystore lama hilang
Tidak bisa menimpa APK lama; pasang sebagai aplikasi baru (hapus yang lama dulu). Buat
keystore baru (`keytool -genkeypair ...`), simpan sebagai secret di atas, dan tambahkan
sidik jari SHA-256 barunya ke `public/.well-known/assetlinks.json` (log build menampilkannya).
Data aplikasi ada di penyimpanan browser untuk alamat web ini, jadi tetap unduh backup JSON
sebelum menghapus aplikasi lama.

## Catatan
- Notifikasi push dari Supabase tetap bekerja di APK (notifikasi didelegasikan ke Chrome).
- Jangan commit keystore atau `signing-key-info.txt` ke repositori.
