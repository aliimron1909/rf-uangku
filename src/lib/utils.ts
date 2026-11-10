import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Resolve a public asset against Vite's configured base path. */
export function assetUrl(path: string): string {
  const base = import.meta.env?.BASE_URL ?? '/'
  return `${base}${path.replace(/^\//, '')}`
}

/**
 * UUID with a fallback for browsers opened over plain HTTP (non-secure context),
 * where crypto.randomUUID may not be available.
 */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
