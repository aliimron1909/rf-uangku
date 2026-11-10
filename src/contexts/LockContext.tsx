import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { clearPin, hasPin, savePin, verifyPin } from '../lib/pin'
import {
  clearBiometric,
  hasBiometric,
  isBiometricSupported,
  registerBiometric,
  verifyBiometric,
  type BiometricResult,
} from '../lib/biometric'

interface LockContextValue {
  locked: boolean
  needsSetup: boolean
  hasPinConfigured: boolean
  biometricEnabled: boolean
  biometricSupported: boolean
  unlock: (pin: string) => Promise<boolean>
  unlockWithBiometric: () => Promise<BiometricResult>
  setupPin: (pin: string) => Promise<void>
  completeSetup: () => void
  setupBiometric: () => Promise<void>
  disableBiometric: () => void
  lock: () => void
  resetPin: () => void
  changePin: (currentPin: string, nextPin: string) => Promise<boolean>
}

const LockContext = createContext<LockContextValue | null>(null)

export function LockProvider({ children }: { children: ReactNode }) {
  const [hasPinConfigured, setHasPinConfigured] = useState(() => hasPin())
  const [needsSetup, setNeedsSetup] = useState(() => !hasPin())
  const [locked, setLocked] = useState(() => hasPin())
  const [biometricEnabled, setBiometricEnabled] = useState(() => hasBiometric())
  const [biometricSupported, setBiometricSupported] = useState(false)

  useEffect(() => {
    let active = true
    void isBiometricSupported().then((supported) => {
      if (active) setBiometricSupported(supported)
    })
    return () => {
      active = false
    }
  }, [])

  const unlock = useCallback(async (pin: string) => {
    const valid = await verifyPin(pin)
    if (valid) setLocked(false)
    return valid
  }, [])

  const unlockWithBiometric = useCallback(async () => {
    const result = await verifyBiometric()
    if (result.ok) setLocked(false)
    return result
  }, [])

  const setupPin = useCallback(async (pin: string) => {
    await savePin(pin)
    setHasPinConfigured(true)
    setNeedsSetup(false)
    // Keep the lock screen visible until the optional fingerprint step is
    // finished, so the app does not flash the dashboard mid-setup.
    setLocked(true)
  }, [])

  const completeSetup = useCallback(() => {
    setLocked(false)
  }, [])

  const setupBiometric = useCallback(async () => {
    await registerBiometric()
    setBiometricEnabled(true)
  }, [])

  const disableBiometric = useCallback(() => {
    clearBiometric()
    setBiometricEnabled(false)
  }, [])

  const lock = useCallback(() => {
    if (hasPin()) setLocked(true)
  }, [])

  const resetPin = useCallback(() => {
    clearPin()
    clearBiometric()
    setBiometricEnabled(false)
    setHasPinConfigured(false)
    setNeedsSetup(true)
    setLocked(true)
  }, [])

  const changePin = useCallback(async (currentPin: string, nextPin: string) => {
    const valid = await verifyPin(currentPin)
    if (!valid) return false
    await savePin(nextPin)
    setHasPinConfigured(true)
    return true
  }, [])

  const value = useMemo(
    () => ({
      locked,
      needsSetup,
      hasPinConfigured,
      biometricEnabled,
      biometricSupported,
      unlock,
      unlockWithBiometric,
      setupPin,
      completeSetup,
      setupBiometric,
      disableBiometric,
      lock,
      resetPin,
      changePin,
    }),
    [
      locked,
      needsSetup,
      hasPinConfigured,
      biometricEnabled,
      biometricSupported,
      unlock,
      unlockWithBiometric,
      setupPin,
      completeSetup,
      setupBiometric,
      disableBiometric,
      lock,
      resetPin,
      changePin,
    ],
  )

  return <LockContext.Provider value={value}>{children}</LockContext.Provider>
}

export function useLock(): LockContextValue {
  const context = useContext(LockContext)
  if (!context) throw new Error('useLock harus dipakai di dalam LockProvider')
  return context
}
