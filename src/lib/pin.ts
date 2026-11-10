import { createId } from './utils'

const PIN_KEY = 'rf-uangku:pin'

type PinAlgorithm = 'sha256' | 'fnv1a'

interface PinRecord {
  salt: string
  hash: string
  algo: PinAlgorithm
}

function hasSubtleCrypto(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined'
}

/**
 * Small non-cryptographic fallback for non-secure contexts (plain HTTP on LAN).
 * The PIN is a privacy screen, not database encryption, so this is acceptable
 * as a fallback. HTTPS deployments use SHA-256 automatically.
 */
function fnv1aHash(text: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x9e3779b9

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    h1 ^= code
    h1 = Math.imul(h1, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ code, 0x85ebca6b) >>> 0
    h2 ^= h2 >>> 13
  }

  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`
}

async function hashPin(text: string, algorithm: PinAlgorithm): Promise<string> {
  if (algorithm === 'fnv1a') return fnv1aHash(text)

  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin)
}

export function hasPin(): boolean {
  try {
    return Boolean(localStorage.getItem(PIN_KEY))
  } catch {
    return false
  }
}

export async function savePin(pin: string): Promise<void> {
  const salt = createId()
  const algorithm: PinAlgorithm = hasSubtleCrypto() ? 'sha256' : 'fnv1a'
  const hash = await hashPin(`${salt}:${pin}`, algorithm)
  localStorage.setItem(PIN_KEY, JSON.stringify({ salt, hash, algo: algorithm } satisfies PinRecord))
}

export async function verifyPin(pin: string): Promise<boolean> {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(PIN_KEY)
  } catch {
    return false
  }
  if (!raw) return false

  try {
    const record = JSON.parse(raw) as Partial<PinRecord>
    if (!record.salt || !record.hash) return false

    const algorithm: PinAlgorithm = record.algo === 'fnv1a' ? 'fnv1a' : 'sha256'
    // A PIN created on HTTPS uses SHA-256; don't silently compare with a different
    // algorithm when the app is later opened over plain HTTP.
    if (algorithm === 'sha256' && !hasSubtleCrypto()) return false

    return (await hashPin(`${record.salt}:${pin}`, algorithm)) === record.hash
  } catch {
    return false
  }
}

export function clearPin(): void {
  try {
    localStorage.removeItem(PIN_KEY)
  } catch {
    // ignore storage errors
  }
}
