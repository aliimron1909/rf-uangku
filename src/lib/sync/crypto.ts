/**
 * Enkripsi sisi-klien untuk sinkronisasi cloud.
 *
 * Kunci AES-256-GCM diturunkan dari frasa sandi (PBKDF2-SHA256) dan tidak pernah
 * dikirim ke server. Setiap record dienkripsi dengan IV acak dan "additional data"
 * berupa kunci record, sehingga server tidak bisa menukar isi antar record tanpa
 * terdeteksi. Server hanya melihat kunci record (nama tabel + ID acak) dan waktu.
 */

export const MIN_SYNC_PASSPHRASE_LENGTH = 8

const KDF_ITERATIONS = 600_000
const SALT_BYTES = 16
const IV_BYTES = 12
const CHECK_TEXT = 'rf-uangku-sync-check-v1'
const CHECK_AAD = 'sync_profile'

export interface EncryptedValue {
  payload: string
  iv: string
}

export interface SyncProfile {
  salt: string
  checkIv: string
  checkPayload: string
}

function subtle(): SubtleCrypto {
  if (typeof crypto === 'undefined' || typeof crypto.subtle === 'undefined') {
    throw new Error('Enkripsi butuh koneksi aman (HTTPS). Buka aplikasi lewat HTTPS atau localhost.')
  }
  return crypto.subtle
}

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export function randomSalt(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(SALT_BYTES)))
}

/** Menurunkan kunci yang tidak bisa diekspor (aman disimpan di IndexedDB). */
export async function deriveSyncKey(passphrase: string, saltBase64: string): Promise<CryptoKey> {
  if (passphrase.length < MIN_SYNC_PASSPHRASE_LENGTH) {
    throw new Error(`Frasa sandi minimal ${MIN_SYNC_PASSPHRASE_LENGTH} karakter.`)
  }
  const material = await subtle().importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(saltBase64), iterations: KDF_ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptJson(
  key: CryptoKey,
  aad: string,
  value: unknown,
): Promise<EncryptedValue> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const cipher = await subtle().encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) },
    key,
    new TextEncoder().encode(JSON.stringify(value)),
  )
  return { payload: toBase64(new Uint8Array(cipher)), iv: toBase64(iv) }
}

export async function decryptJson(
  key: CryptoKey,
  aad: string,
  encrypted: EncryptedValue,
): Promise<unknown> {
  let plain: ArrayBuffer
  try {
    plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: fromBase64(encrypted.iv), additionalData: new TextEncoder().encode(aad) },
      key,
      fromBase64(encrypted.payload),
    )
  } catch {
    throw new Error('Frasa sandi salah atau data cloud rusak.')
  }
  return JSON.parse(new TextDecoder().decode(plain))
}

/** Profil baru: salt acak + token uji agar frasa sandi di perangkat lain bisa diverifikasi. */
export async function createSyncProfile(
  passphrase: string,
): Promise<{ profile: SyncProfile; key: CryptoKey }> {
  const salt = randomSalt()
  const key = await deriveSyncKey(passphrase, salt)
  const check = await encryptJson(key, CHECK_AAD, CHECK_TEXT)
  return { profile: { salt, checkIv: check.iv, checkPayload: check.payload }, key }
}

export async function unlockSyncProfile(
  passphrase: string,
  profile: SyncProfile,
): Promise<CryptoKey> {
  const key = await deriveSyncKey(passphrase, profile.salt)
  const value = await decryptJson(key, CHECK_AAD, {
    payload: profile.checkPayload,
    iv: profile.checkIv,
  })
  if (value !== CHECK_TEXT) throw new Error('Frasa sandi salah.')
  return key
}
