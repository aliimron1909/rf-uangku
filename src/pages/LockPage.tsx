import { useState } from 'react'
import { Fingerprint, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useLock } from '../contexts/LockContext'
import { isValidPin } from '../lib/pin'
import { isBiometricSupported } from '../lib/biometric'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { APP_TAGLINE } from '../lib/constants'
import { assetUrl, errorMessage } from '../lib/utils'

type SetupStep = 'pin' | 'biometric'

export function LockPage() {
  const {
    needsSetup,
    setupPin,
    completeSetup,
    unlock,
    resetPin,
    biometricEnabled,
    biometricSupported,
    setupBiometric,
    unlockWithBiometric,
  } = useLock()
  const [setupStep, setSetupStep] = useState<SetupStep>('pin')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [biometricError, setBiometricError] = useState('')
  const [loading, setLoading] = useState(false)
  const [biometricLoading, setBiometricLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)

  const showBiometricSetup = setupStep === 'biometric' && !needsSetup

  async function handleSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!isValidPin(pin)) {
      setError('PIN harus 4–6 digit angka.')
      return
    }
    if (pin !== confirmPin) {
      setError('Konfirmasi PIN belum sama.')
      return
    }
    setLoading(true)
    try {
      // Resolve support before saving so the UI switches straight from the PIN
      // form to the optional fingerprint step without flashing the dashboard.
      const supported = await isBiometricSupported()
      if (supported) setSetupStep('biometric')
      await setupPin(pin)
      if (!supported) completeSetup()
    } catch {
      setError('Gagal menyimpan PIN. Pastikan penyimpanan browser tidak diblokir.')
    } finally {
      setLoading(false)
    }
  }

  async function handleEnableBiometric() {
    setBiometricError('')
    setBiometricLoading(true)
    try {
      await setupBiometric()
      completeSetup()
    } catch (caught) {
      setBiometricError(errorMessage(caught))
    } finally {
      setBiometricLoading(false)
    }
  }

  function handleSkipBiometric() {
    setBiometricError('')
    completeSetup()
  }

  async function handleUnlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!pin) {
      setError('Masukkan PIN.')
      return
    }
    setLoading(true)
    try {
      const valid = await unlock(pin)
      if (!valid) {
        setError('PIN salah. Coba lagi.')
        setPin('')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleBiometricUnlock() {
    setBiometricError('')
    setBiometricLoading(true)
    try {
      const result = await unlockWithBiometric()
      if (!result.ok) {
        setBiometricError(result.error ?? 'Fingerprint gagal. Gunakan PIN.')
      }
    } finally {
      setBiometricLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.28),transparent_55%),radial-gradient(circle_at_bottom_left,rgba(13,148,136,0.22),transparent_50%)]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 text-center">
          <img
            src={assetUrl('logo.svg')}
            alt="RF Uangku"
            className="mx-auto h-20 w-20 rounded-3xl shadow-2xl shadow-emerald-900/40"
          />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-white">RF Uangku</h1>
          <p className="mt-1 text-sm text-slate-400">{APP_TAGLINE}</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/95 p-6 shadow-2xl backdrop-blur dark:bg-slate-900/95">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {showBiometricSetup ? (
                <Fingerprint className="h-5 w-5" />
              ) : needsSetup ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <LockKeyhole className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {showBiometricSetup
                  ? 'Aktifkan fingerprint'
                  : needsSetup
                    ? 'Buat PIN aplikasi'
                    : 'Masukkan PIN'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {showBiometricSetup
                  ? 'Buka aplikasi lebih cepat dengan sidik jari. PIN tetap jadi cadangan.'
                  : needsSetup
                    ? 'PIN melindungi tampilan aplikasi di perangkat ini.'
                    : 'Buka RF Uangku untuk melihat data keuanganmu.'}
              </p>
            </div>
          </div>

          {showBiometricSetup ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100">
                <div className="flex items-start gap-3">
                  <Fingerprint className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-semibold">Daftarkan fingerprint sekarang?</p>
                    <p className="text-xs leading-relaxed text-emerald-800/80 dark:text-emerald-200/80">
                      Android akan meminta sidik jari. Data biometrik tidak pernah disimpan
                      aplikasi; yang disimpan hanya credential publik di perangkat ini.
                    </p>
                  </div>
                </div>
              </div>

              {biometricError && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                  {biometricError}
                </p>
              )}

              <Button
                type="button"
                className="w-full"
                loading={biometricLoading}
                onClick={handleEnableBiometric}
              >
                <Fingerprint className="h-4 w-4" />
                Aktifkan fingerprint
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={biometricLoading}
                onClick={handleSkipBiometric}
              >
                Lewati, cukup pakai PIN
              </Button>
            </div>
          ) : needsSetup ? (
            <form onSubmit={handleSetup} className="space-y-3">
              <Input
                label="PIN baru"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                autoFocus
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
                placeholder="4–6 digit"
                leftIcon={<KeyRound className="h-4 w-4" />}
              />
              <Input
                label="Ulangi PIN"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={confirmPin}
                onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, ''))}
                placeholder="Ulangi PIN"
                error={error}
              />
              <Button type="submit" className="w-full" loading={loading}>
                Buat PIN & lanjut
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              {biometricEnabled && biometricSupported && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    loading={biometricLoading}
                    onClick={handleBiometricUnlock}
                  >
                    <Fingerprint className="h-4 w-4" />
                    Buka dengan fingerprint
                  </Button>
                  <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                    atau PIN
                    <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  </div>
                </>
              )}

              {biometricError && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                  {biometricError}
                </p>
              )}

              <form onSubmit={handleUnlock} className="space-y-3">
                <Input
                  label="PIN"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  maxLength={6}
                  autoFocus={!biometricEnabled}
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
                  placeholder="Masukkan PIN"
                  error={error}
                  leftIcon={<KeyRound className="h-4 w-4" />}
                />
                <Button type="submit" className="w-full" loading={loading}>
                  Buka aplikasi
                </Button>
                <button
                  type="button"
                  onClick={() => setShowReset(true)}
                  className="w-full text-center text-xs font-medium text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
                >
                  Lupa PIN?
                </button>
              </form>
            </div>
          )}

          <p className="mt-4 text-center text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
            Data disimpan lokal di perangkat ini. PIN dan fingerprint hanya mengunci tampilan,
            bukan enkripsi database.
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={showReset}
        title="Reset PIN?"
        message="PIN dan fingerprint akan dihapus, lalu Anda dapat membuat PIN baru. Data transaksi tetap tersimpan di perangkat. Gunakan opsi ini hanya jika Anda benar-benar lupa PIN."
        confirmLabel="Reset PIN"
        danger
        onCancel={() => setShowReset(false)}
        onConfirm={() => {
          setShowReset(false)
          resetPin()
          setPin('')
          setConfirmPin('')
          setError('')
          setBiometricError('')
          setSetupStep('pin')
        }}
      />
    </div>
  )
}
