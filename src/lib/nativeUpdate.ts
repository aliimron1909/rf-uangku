import { isNativeApp, nativePlugin } from './native'

const RELEASES_URL = 'https://api.github.com/repos/aliimron1909/rf-uangku/releases/latest'
/** versionCode APK = BUILD_OFFSET + nomor run workflow (lihat .github/workflows/native.yml). */
export const BUILD_OFFSET = 200
const LAST_CHECK_KEY = 'rf-native-update-check'
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

export interface NativeUpdateInfo {
  tag: string
  build: number
  version: string
  downloadUrl: string
  notes: string
  /** Daftar perubahan dari catatan rilis (satu baris per butir). */
  changelog: string[]
}

/** Nomor build dari tag rilis "native-v1.1.0-36"; null bila bukan rilis aplikasi native. */
export function releaseBuild(tag: string): number | null {
  const match = /^native-v([\d.]+)-(\d+)$/.exec(tag)
  return match ? BUILD_OFFSET + Number(match[2]) : null
}

/** Baris pembuka catatan rilis yang tidak berguna bagi pembaca (jejak penulis, tautan sesi, dsb.). */
const NOISE = /^(co-authored-by|claude-session|🤖|https?:\/\/)/i

/**
 * Mengubah catatan rilis menjadi daftar perubahan: berhenti di garis "---" (keterangan tetap),
 * membuang jejak penulis, awalan "feat:/fix:", nomor PR "(#12)", dan penanda butir.
 */
export function parseChangelog(body: string): string[] {
  const lines: string[] = []
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (line === '---') break
    if (!line || NOISE.test(line)) continue
    const clean = line
      .replace(/^[-*•]\s+/, '')
      .replace(/^(feat|fix|chore|refactor|docs|perf|style|test)(\([^)]*\))?:\s*/i, '')
      .replace(/\s*\(#\d+\)\s*$/, '')
      .trim()
    if (clean) lines.push(clean.charAt(0).toUpperCase() + clean.slice(1))
  }
  return lines
}

export interface ReleaseLog {
  tag: string
  version: string
  build: number
  date: string
  changelog: string[]
}

/** Catatan perubahan beberapa rilis terakhir (terbaru dulu). Melempar galat bila tidak ada internet. */
export async function fetchReleaseLogs(limit = 5): Promise<ReleaseLog[]> {
  const response = await fetch(`${RELEASES_URL.replace(/\/latest$/, '')}?per_page=15`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!response.ok) throw new Error(`Gagal memuat changelog (${response.status}).`)
  const releases = (await response.json()) as GithubRelease[]
  const logs: ReleaseLog[] = []
  for (const release of releases) {
    const tag = release.tag_name ?? ''
    const build = releaseBuild(tag)
    if (build === null) continue
    logs.push({
      tag,
      version: /^native-v([\d.]+)-/.exec(tag)?.[1] ?? '',
      build,
      date: release.published_at ?? '',
      changelog: parseChangelog(release.body ?? ''),
    })
    if (logs.length >= limit) break
  }
  return logs
}

interface GithubRelease {
  tag_name?: string
  body?: string
  published_at?: string
  assets?: { name?: string; browser_download_url?: string }[]
}

/** Memilih rilis yang lebih baru dari build terpasang; null bila sudah terbaru atau datanya tidak lengkap. */
export function pickUpdate(release: GithubRelease, currentBuild: number): NativeUpdateInfo | null {
  const tag = release.tag_name ?? ''
  const build = releaseBuild(tag)
  if (build === null || build <= currentBuild) return null
  const apk = release.assets?.find((asset) => asset.name?.endsWith('.apk'))
  if (!apk?.browser_download_url) return null
  return {
    tag,
    build,
    version: /^native-v([\d.]+)-/.exec(tag)?.[1] ?? '',
    downloadUrl: apk.browser_download_url,
    notes: (release.body ?? '').split('\n')[0].trim(),
    changelog: parseChangelog(release.body ?? ''),
  }
}

interface AppPlugin {
  getInfo(): Promise<{ version?: string; build?: string }>
}
interface BrowserPlugin {
  open(options: { url: string }): Promise<unknown>
}

export async function installedAppInfo(): Promise<{ version: string; build: number } | null> {
  if (!isNativeApp()) return null
  try {
    const info = await nativePlugin<AppPlugin>('App')?.getInfo()
    if (!info) return null
    return { version: info.version ?? '', build: Number(info.build) || 0 }
  } catch {
    return null
  }
}

export type UpdateCheck =
  | { status: 'latest'; version: string; build: number }
  | { status: 'available'; version: string; build: number; update: NativeUpdateInfo }

/** Memeriksa rilis terbaru di GitHub. Melempar galat bila tidak ada internet. */
export async function checkNativeUpdate(): Promise<UpdateCheck | null> {
  const installed = await installedAppInfo()
  if (!installed) return null
  const response = await fetch(RELEASES_URL, { headers: { Accept: 'application/vnd.github+json' } })
  if (!response.ok) throw new Error(`Gagal memeriksa pembaruan (${response.status}).`)
  const update = pickUpdate((await response.json()) as GithubRelease, installed.build)
  return update
    ? { status: 'available', version: installed.version, build: installed.build, update }
    : { status: 'latest', version: installed.version, build: installed.build }
}

interface RfUpdatePlugin {
  canInstall(): Promise<{ allowed?: boolean }>
  openInstallSettings(): Promise<unknown>
  download(options: { url: string }): Promise<unknown>
  progress(): Promise<{ state?: string; percent?: number; error?: string }>
  install(): Promise<unknown>
}

export type InAppUpdateResult = 'installing' | 'need-permission'

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

/**
 * Unduh APK di dalam aplikasi lalu buka pemasang Android.
 * Pertama kali, Android meminta izin "pasang aplikasi dari sumber ini"; setelah diizinkan, panggil lagi.
 */
export async function runInAppUpdate(
  update: NativeUpdateInfo,
  onProgress: (percent: number) => void,
): Promise<InAppUpdateResult> {
  const plugin = nativePlugin<RfUpdatePlugin>('RfUpdate')
  if (!plugin) {
    await downloadUpdate(update)
    return 'installing'
  }
  if (!(await plugin.canInstall()).allowed) {
    await plugin.openInstallSettings()
    return 'need-permission'
  }
  onProgress(0)
  await plugin.download({ url: update.downloadUrl })
  for (let waited = 0; waited < 10 * 60 * 1000; waited += 400) {
    await sleep(400)
    const status = await plugin.progress()
    onProgress(status.percent ?? 0)
    if (status.state === 'error') throw new Error(status.error || 'Unduhan gagal.')
    if (status.state === 'done') {
      await plugin.install()
      return 'installing'
    }
  }
  throw new Error('Unduhan terlalu lama. Coba lagi.')
}

/** Cadangan bila plugin unduhan tidak ada: buka tautan APK di browser. */
export async function downloadUpdate(update: NativeUpdateInfo): Promise<void> {
  const browser = nativePlugin<BrowserPlugin>('Browser')
  if (browser) await browser.open({ url: update.downloadUrl })
  else window.open(update.downloadUrl, '_blank')
}

const DISMISSED_KEY = 'rf-native-update-dismissed'

export function isUpdateDismissed(build: number): boolean {
  try {
    return Number(localStorage.getItem(DISMISSED_KEY)) >= build
  } catch {
    return false
  }
}

export function dismissUpdate(build: number): void {
  try {
    localStorage.setItem(DISMISSED_KEY, String(build))
  } catch {
    // Opsional.
  }
}

/** Cek otomatis paling sering sekali per 6 jam. */
export function shouldAutoCheck(now = Date.now()): boolean {
  try {
    const last = Number(localStorage.getItem(LAST_CHECK_KEY)) || 0
    if (now - last < CHECK_INTERVAL_MS) return false
    localStorage.setItem(LAST_CHECK_KEY, String(now))
  } catch {
    // Tanpa penyimpanan, cek tetap dilakukan.
  }
  return true
}
