RF Uangku — Android package

Installable APK:
  rf-uangku.apk

Google Play bundle:
  rf-uangku.aab

Signing key:
  signing.keystore

Signing credentials:
  signing-key-info.txt

Original PWABuilder package:
  rf-uangku-pwabuilder.zip

TWA details:
  Package: com.rf_uangku.twa
  URL: https://rf-uangku.vercel.app
  Asset links: https://rf-uangku.vercel.app/.well-known/assetlinks.json
  SHA-256 fingerprint: 1F:8C:C0:53:4A:86:08:24:89:51:23:34:BF:EB:DE:9B:93:2C:ED:35:22:96:80:25:41:CB:8D:B2:5B:F1:D3:F1

Web app version:
  RF Uangku 1.1.0
  Includes monthly budgets, recurring transactions, fingerprint unlock
  (PIN fallback), AI transaction chat, and Groq active-model discovery
  (requires internet).

The packaged APK/AAB in this folder is the previously signed TWA build.
Because the TWA opens https://rf-uangku.vercel.app, web features update
without reinstalling the APK. Rebuild the APK/AAB with versionCode 2 and
the same keystore when you need a new store package.

Fingerprint notes:
  Fingerprint is a UI unlock gate, not database encryption. It is bound
  to the web origin (Vercel). Test on the actual Android APK. Reset PIN
  clears the local fingerprint credential; PIN remains the fallback.

Keep signing.keystore and signing-key-info.txt safe. They are needed
to publish updates to Google Play and to sign future APK builds.
Do not commit them to a public repository.
