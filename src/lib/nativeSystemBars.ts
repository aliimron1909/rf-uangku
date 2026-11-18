import { isNativeApp, nativePlugin } from './native'

interface RfSystemBarsPlugin {
  getInsets(): Promise<{ top?: number; bottom?: number }>
  setTheme(options: { dark: boolean }): Promise<unknown>
}

function plugin(): RfSystemBarsPlugin | null {
  return isNativeApp() ? nativePlugin<RfSystemBarsPlugin>('RfSystemBars') : null
}

/** Membaca tinggi status bar dan navigation bar lalu menyimpannya sebagai variabel CSS. */
export async function refreshInsets(): Promise<void> {
  const bars = plugin()
  if (!bars) return
  try {
    const { top = 0, bottom = 0 } = await bars.getInsets()
    const root = document.documentElement.style
    root.setProperty('--inset-top', `${top}px`)
    root.setProperty('--inset-bottom', `${bottom}px`)
  } catch {
    // Tanpa inset, tata letak memakai nilai bawaan 0.
  }
}

/** Ikon status bar/navigation bar terang di tema gelap dan gelap di tema terang. */
export async function applySystemBarsTheme(dark: boolean): Promise<void> {
  try {
    await plugin()?.setTheme({ dark })
  } catch {
    // Opsional.
  }
}
