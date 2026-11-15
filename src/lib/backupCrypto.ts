/**
 * Enkripsi backup dengan password.
 *
 * - Kunci diturunkan dari password memakai PBKDF2-SHA256 + salt acak.
 * - Data dienkripsi dengan AES-256-GCM (terautentikasi), IV acak per file.
 * - Password tidak pernah disimpan. Jika lupa, backup tidak bisa dibuka.
 *
 * Memakai Web Crypto API, sehingga butuh konteks aman (HTTPS atau localhost).
 */

export const MIN_BACKUP_PASSWORD_LENGTH = 8

const KDF_ITERATIONS = 600_000
const MIN_ITERATIONS = 100_000
const MAX_ITERATIONS = 2_000_000
const SALT_BYTES = 16
const IV_BYTES = 12

export interface EncryptedBackup {
  app: 'rf-uangku'
  encrypted: true
  version: 1
  kdf: 'PBKDF2-SHA256'
  iterations: number
  cipher: 'AES-GCM'
  salt: string
  iv: string
  data: string
}

function getSubtle(): SubtleCrypto {
  if (typeof crypto === 'undefined' || typeof crypto.subtle === 'undefined') {
    throw new Error(
      'Enkripsi butuh koneksi aman (HTTPS). Buka aplikasi lewat alamat HTTPS atau localhost.',
    )
  }
  return crypto.subtle
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
  usage: KeyUsage,
): Promise<CryptoKey> {
  const subtle = getSubtle()
  const material = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  )
}

export function isEncryptedBackup(value: unknown): value is EncryptedBackup {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    row.app === 'rf-uangku' &&
    row.encrypted === true &&
    row.version === 1 &&
    row.kdf === 'PBKDF2-SHA256' &&
    row.cipher === 'AES-GCM' &&
    typeof row.iterations === 'number' &&
    typeof row.salt === 'string' &&
    typeof row.iv === 'string' &&
    typeof row.data === 'string'
  )
}

export async function encryptBackup(
  backup: unknown,
  password: string,
): Promise<EncryptedBackup> {
  if (password.length < MIN_BACKUP_PASSWORD_LENGTH) {
    throw new Error(`Password minimal ${MIN_BACKUP_PASSWORD_LENGTH} karakter.`)
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(password, salt, KDF_ITERATIONS, 'encrypt')
  const plaintext = new TextEncoder().encode(JSON.stringify(backup))
  const cipher = await getSubtle().encrypt({ name: 'AES-GCM', iv }, key, plaintext)

  return {
    app: 'rf-uangku',
    encrypted: true,
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: KDF_ITERATIONS,
    cipher: 'AES-GCM',
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
  }
}

export async function decryptBackup(
  envelope: EncryptedBackup,
  password: string,
): Promise<unknown> {
  if (
    !Number.isInteger(envelope.iterations) ||
    envelope.iterations < MIN_ITERATIONS ||
    envelope.iterations > MAX_ITERATIONS
  ) {
    throw new Error('File backup terenkripsi tidak valid.')
  }

  let salt: Uint8Array<ArrayBuffer>
  let iv: Uint8Array<ArrayBuffer>
  let data: Uint8Array<ArrayBuffer>
  try {
    salt = fromBase64(envelope.salt)
    iv = fromBase64(envelope.iv)
    data = fromBase64(envelope.data)
  } catch {
    throw new Error('File backup terenkripsi tidak valid.')
  }
  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES || data.length < 16) {
    throw new Error('File backup terenkripsi tidak valid.')
  }

  const key = await deriveKey(password, salt, envelope.iterations, 'decrypt')
  let plaintext: ArrayBuffer
  try {
    plaintext = await getSubtle().decrypt({ name: 'AES-GCM', iv }, key, data)
  } catch {
    // AES-GCM gagal terautentikasi: password salah atau isi file diubah.
    throw new Error('Password salah atau file backup rusak.')
  }

  try {
    return JSON.parse(new TextDecoder().decode(plaintext)) as unknown
  } catch {
    throw new Error('Isi backup tidak bisa dibaca.')
  }
}
