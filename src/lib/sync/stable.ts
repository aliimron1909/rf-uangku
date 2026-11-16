/** JSON deterministik (kunci terurut, `undefined` dibuang) untuk membandingkan isi record. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null'
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item === undefined ? null : item)).join(',')}]`
  }
  const record = value as Record<string, unknown>
  const parts: string[] = []
  for (const key of Object.keys(record).sort()) {
    if (record[key] === undefined) continue
    parts.push(`${JSON.stringify(key)}:${stableStringify(record[key])}`)
  }
  return `{${parts.join(',')}}`
}

/** Hash non-kriptografis (cyrb53) untuk mendeteksi perubahan; bukan untuk keamanan. */
export function hashText(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `${(h2 >>> 0).toString(36)}${(h1 >>> 0).toString(36)}.${text.length.toString(36)}`
}

export function hashRecord(record: unknown): string {
  return hashText(stableStringify(record))
}
