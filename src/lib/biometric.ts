import { STORAGE_KEYS } from './constants'

export interface BiometricRecord {
  credentialId: string
  publicKeySpki: string
  userId: string
  rpId: string
  createdAt: string
}

export interface BiometricResult {
  ok: boolean
  error?: string
}

const RP_NAME = 'RF Uangku'
const USER_NAME = 'rf-uangku'
const USER_DISPLAY_NAME = 'RF Uangku'
const TIMEOUT_MS = 60_000

function bytesOf(value: ArrayBuffer | Uint8Array): Uint8Array {
  return value instanceof Uint8Array ? value : new Uint8Array(value)
}

function toBase64Url(value: ArrayBuffer | Uint8Array): string {
  const bytes = bytesOf(value)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

function bufferSource(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength)
  copy.set(value)
  return copy.buffer
}

function concatBytes(...values: ArrayBufferLike[]): Uint8Array {
  const length = values.reduce((sum, value) => sum + value.byteLength, 0)
  const result = new Uint8Array(length)
  let offset = 0
  for (const value of values) {
    result.set(new Uint8Array(value), offset)
    offset += value.byteLength
  }
  return result
}

function sameBytes(left: ArrayBuffer | Uint8Array, right: ArrayBuffer | Uint8Array): boolean {
  const a = bytesOf(left)
  const b = bytesOf(right)
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index]
  }
  return difference === 0
}

function currentRpId(): string {
  return window.location.hostname
}

function readRecord(): BiometricRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.biometric)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BiometricRecord>
    if (
      typeof parsed.credentialId !== 'string' ||
      typeof parsed.publicKeySpki !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.rpId !== 'string' ||
      typeof parsed.createdAt !== 'string'
    ) {
      return null
    }
    return parsed as BiometricRecord
  } catch {
    return null
  }
}

export function getBiometricRecord(): BiometricRecord | null {
  return readRecord()
}

export function hasBiometric(): boolean {
  const record = readRecord()
  if (!record) return false
  if (record.rpId !== currentRpId()) {
    clearBiometric()
    return false
  }
  return true
}

export function clearBiometric(): void {
  localStorage.removeItem(STORAGE_KEYS.biometric)
}

export async function isBiometricSupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.isSecureContext) return false
  if (typeof PublicKeyCredential === 'undefined') return false
  if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
    return false
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export function biometricErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'Fingerprint dibatalkan atau waktu habis. Coba lagi.'
    }
    if (error.name === 'InvalidStateError') {
      return 'Fingerprint sudah terdaftar. Nonaktifkan lalu daftarkan ulang.'
    }
    if (error.name === 'SecurityError') {
      return 'Domain aplikasi tidak cocok untuk pendaftaran fingerprint.'
    }
    if (error.name === 'NotSupportedError') {
      return 'Perangkat ini tidak mendukung fingerprint WebAuthn.'
    }
    if (error.name === 'AbortError') {
      return 'Pendaftaran fingerprint dibatalkan.'
    }
  }
  return error instanceof Error ? error.message : 'Fingerprint gagal diproses.'
}

export async function registerBiometric(): Promise<BiometricRecord> {
  if (!(await isBiometricSupported())) {
    throw new Error('Perangkat atau browser ini belum mendukung fingerprint.')
  }

  const challenge = randomBytes(32)
  const userId = randomBytes(16)

  let credential: Credential | null
  try {
    credential = await navigator.credentials.create({
      publicKey: {
        challenge: bufferSource(challenge),
        rp: { id: currentRpId(), name: RP_NAME },
        user: {
          id: bufferSource(userId),
          name: USER_NAME,
          displayName: USER_DISPLAY_NAME,
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged',
        },
        attestation: 'none',
        timeout: TIMEOUT_MS,
      },
    })
  } catch (caught) {
    throw new Error(biometricErrorMessage(caught))
  }

  if (!credential || credential.type !== 'public-key') {
    throw new Error('Perangkat tidak mengembalikan credential fingerprint.')
  }

  const publicKeyCredential = credential as PublicKeyCredential
  const response = publicKeyCredential.response as AuthenticatorAttestationResponse & {
    getPublicKey?: () => ArrayBuffer | null
  }
  const publicKey = response.getPublicKey?.()
  if (!publicKey) {
    throw new Error('Perangkat ini belum mendukung penyimpanan public key WebAuthn.')
  }

  const record: BiometricRecord = {
    credentialId: toBase64Url(publicKeyCredential.rawId),
    publicKeySpki: toBase64Url(publicKey),
    userId: toBase64Url(userId),
    rpId: currentRpId(),
    createdAt: new Date().toISOString(),
  }

  localStorage.setItem(STORAGE_KEYS.biometric, JSON.stringify(record))
  return record
}

interface DerLength {
  length: number
  offset: number
}

function readDerLength(data: Uint8Array, offset: number): DerLength {
  const first = data[offset]
  if (first === undefined) throw new Error('Signature DER tidak lengkap.')
  let cursor = offset + 1
  if (first < 0x80) return { length: first, offset: cursor }

  const count = first & 0x7f
  let length = 0
  for (let index = 0; index < count; index += 1) {
    const byte = data[cursor]
    if (byte === undefined) throw new Error('Signature DER tidak lengkap.')
    length = (length << 8) | byte
    cursor += 1
  }
  return { length, offset: cursor }
}

function trimInteger(bytes: Uint8Array): Uint8Array {
  let offset = 0
  while (offset < bytes.length - 1 && bytes[offset] === 0) offset += 1
  return bytes.slice(offset)
}

function derToRaw(signature: Uint8Array): Uint8Array {
  if (signature[0] !== 0x30) throw new Error('Signature bukan DER sequence.')
  const sequence = readDerLength(signature, 1)
  let offset = sequence.offset

  if (signature[offset] !== 0x02) throw new Error('Signature DER tidak memiliki r.')
  offset += 1
  const rLength = readDerLength(signature, offset)
  offset = rLength.offset
  const r = trimInteger(signature.slice(offset, offset + rLength.length))
  offset += rLength.length

  if (signature[offset] !== 0x02) throw new Error('Signature DER tidak memiliki s.')
  offset += 1
  const sLength = readDerLength(signature, offset)
  offset = sLength.offset
  const s = trimInteger(signature.slice(offset, offset + sLength.length))

  if (r.length > 32 || s.length > 32) throw new Error('Signature ECDSA tidak valid.')

  const raw = new Uint8Array(64)
  raw.set(r, 32 - r.length)
  raw.set(s, 64 - s.length)
  return raw
}

async function sha256(value: BufferSource): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', value)
}

export async function verifyBiometric(): Promise<BiometricResult> {
  const record = readRecord()
  if (!record) return { ok: false, error: 'Fingerprint belum didaftarkan.' }
  if (record.rpId !== currentRpId()) {
    clearBiometric()
    return {
      ok: false,
      error: 'Fingerprint terdaftar untuk domain lain. Daftarkan ulang dari Pengaturan.',
    }
  }
  if (!(await isBiometricSupported())) {
    return { ok: false, error: 'Fingerprint tidak tersedia di perangkat ini.' }
  }

  const challenge = randomBytes(32)

  let credential: Credential | null
  try {
    credential = await navigator.credentials.get({
      publicKey: {
        challenge: bufferSource(challenge),
        rpId: record.rpId,
        allowCredentials: [
          {
            type: 'public-key',
            id: bufferSource(fromBase64Url(record.credentialId)),
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: TIMEOUT_MS,
      },
    })
  } catch (caught) {
    return { ok: false, error: biometricErrorMessage(caught) }
  }

  if (!credential || credential.type !== 'public-key') {
    return { ok: false, error: 'Fingerprint tidak dikenali.' }
  }
  const publicKeyCredential = credential as PublicKeyCredential
  if (toBase64Url(publicKeyCredential.rawId) !== record.credentialId) {
    return { ok: false, error: 'Credential fingerprint tidak cocok.' }
  }

  const response = publicKeyCredential.response as AuthenticatorAssertionResponse

  try {
    const clientData = JSON.parse(new TextDecoder().decode(response.clientDataJSON)) as {
      type?: string
      challenge?: string
      origin?: string
    }

    if (clientData.type !== 'webauthn.get') {
      return { ok: false, error: 'Jenis autentikasi fingerprint tidak valid.' }
    }
    if (clientData.challenge !== toBase64Url(challenge)) {
      return { ok: false, error: 'Challenge fingerprint tidak cocok.' }
    }
    if (clientData.origin !== window.location.origin) {
      return { ok: false, error: 'Origin fingerprint tidak cocok.' }
    }

    const authenticatorData = new Uint8Array(response.authenticatorData)
    if (authenticatorData.length < 37) {
      return { ok: false, error: 'Data autentikator tidak lengkap.' }
    }

    const expectedRpIdHash = new Uint8Array(await sha256(new TextEncoder().encode(record.rpId)))
    if (!sameBytes(authenticatorData.slice(0, 32), expectedRpIdHash)) {
      return { ok: false, error: 'RP ID fingerprint tidak cocok.' }
    }

    const flags = authenticatorData[32]
    if ((flags & 0x01) === 0) {
      return { ok: false, error: 'Fingerprint tidak terverifikasi sebagai user.' }
    }
    if ((flags & 0x04) === 0) {
      return { ok: false, error: 'Verifikasi biometrik tidak dilakukan.' }
    }

    const signedData = concatBytes(
      authenticatorData.buffer,
      await sha256(response.clientDataJSON),
    )
    const key = await crypto.subtle.importKey(
      'spki',
      bufferSource(fromBase64Url(record.publicKeySpki)),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )
    const signature = new Uint8Array(response.signature)
    const rawSignature = derToRaw(signature)

    let valid = false
    try {
      valid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        bufferSource(rawSignature),
        bufferSource(signedData),
      )
    } catch {
      valid = false
    }

    if (!valid) {
      try {
        valid = await crypto.subtle.verify(
          { name: 'ECDSA', hash: 'SHA-256' },
          key,
          bufferSource(signature),
          bufferSource(signedData),
        )
      } catch {
        valid = false
      }
    }

    if (!valid) return { ok: false, error: 'Verifikasi fingerprint gagal.' }
    return { ok: true }
  } catch (caught) {
    return { ok: false, error: biometricErrorMessage(caught) }
  }
}
