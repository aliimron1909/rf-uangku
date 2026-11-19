import { isNativeApp, nativePlugin } from './native'

interface RfDiagPlugin {
  status(): Promise<{
    notificationsEnabled?: boolean
    exactAlarm?: boolean
    batteryUnrestricted?: boolean
    manufacturer?: string
    sdk?: number
  }>
  openExactAlarmSettings(): Promise<unknown>
  openBatterySettings(): Promise<unknown>
  openNotificationSettings(): Promise<unknown>
  openAutostartSettings(): Promise<unknown>
}

export interface NativeDiagStatus {
  notificationsEnabled: boolean
  exactAlarm: boolean
  batteryUnrestricted: boolean
  manufacturer: string
}

function plugin(): RfDiagPlugin | null {
  return isNativeApp() ? nativePlugin<RfDiagPlugin>('RfDiag') : null
}

export async function nativeDiagStatus(): Promise<NativeDiagStatus | null> {
  const diag = plugin()
  if (!diag) return null
  try {
    const status = await diag.status()
    return {
      notificationsEnabled: status.notificationsEnabled !== false,
      exactAlarm: status.exactAlarm !== false,
      batteryUnrestricted: status.batteryUnrestricted === true,
      manufacturer: (status.manufacturer ?? '').toLowerCase(),
    }
  } catch {
    return null
  }
}

export const openExactAlarmSettings = () => plugin()?.openExactAlarmSettings()
export const openBatterySettings = () => plugin()?.openBatterySettings()
export const openNotificationSettings = () => plugin()?.openNotificationSettings()
export const openAutostartSettings = () => plugin()?.openAutostartSettings()

/** Merk HP yang biasanya mematikan aplikasi latar belakang kecuali diizinkan "Mulai otomatis". */
export function needsAutostart(manufacturer: string): boolean {
  return /xiaomi|redmi|poco|oppo|realme|vivo|huawei|honor|oneplus/.test(manufacturer)
}
