import { useEffect, useState } from 'react'
import { CloudOff, KeyRound, LogOut, RefreshCw, Trash2 } from 'lucide-react'
import {
  cloudHasProfile,
  disconnectSync,
  resetCloudData,
  setupPassphrase,
  signInWithGoogle,
  syncNow,
  useSyncState,
} from '../../lib/sync/controller'
import { MIN_SYNC_PASSPHRASE_LENGTH } from '../../lib/sync/crypto'
import { formatDateTime } from '../../lib/dates'
import { errorMessage } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Input } from '../ui/Input'

export function SyncSection() {
  const sync = useSyncState()
  const { toast } = useToast()
  const [hasProfile, setHasProfile] = useState<boolean | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const signedIn = Boolean(sync.email)
  const needsPassphrase = signedIn && !sync.hasKey

  useEffect(() => {
    if (!needsPassphrase) {
      setHasProfile(null)
      return
    }
    let cancelled = false
    cloudHasProfile()
      .then((value) => !cancelled && setHasProfile(value))
      .catch((caught) => !cancelled && setError(errorMessage(caught)))
    return () => {
      cancelled = true
    }
  }, [needsPassphrase])

  if (!sync.configured) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        <CloudOff className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          Sinkronisasi belum diaktifkan di aplikasi ini. Pemilik aplikasi perlu mengisi
          <code className="mx-1 rounded bg-slate-200 px-1 dark:bg-slate-700">VITE_SUPABASE_URL</code>
          dan
          <code className="mx-1 rounded bg-slate-200 px-1 dark:bg-slate-700">VITE_SUPABASE_ANON_KEY</code>
          lalu deploy ulang. Panduannya ada di <strong>docs/SUPABASE.md</strong>.
        </p>
      </div>
    )
  }

  async function handleSetup(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    const creating = hasProfile === false
    if (passphrase.length < MIN_SYNC_PASSPHRASE_LENGTH) {
      setError(`Frasa sandi minimal ${MIN_SYNC_PASSPHRASE_LENGTH} karakter.`)
      return
    }
    if (creating && passphrase !== confirm) {
      setError('Konfirmasi frasa sandi tidak sama.')
      return
    }
    setBusy(true)
    try {
      const result = await setupPassphrase(passphrase)
      setPassphrase('')
      setConfirm('')
      toast(
        result === 'created'
          ? 'Frasa sandi dibuat. Sinkronisasi dimulai.'
          : 'Berhasil dibuka. Sinkronisasi dimulai.',
      )
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function handleSyncNow() {
    setBusy(true)
    try {
      await syncNow()
    } finally {
      setBusy(false)
    }
  }

  async function handleDisconnect() {
    try {
      await disconnectSync()
      toast('Terputus dari cloud. Data di perangkat ini tetap ada.')
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setConfirmDisconnect(false)
    }
  }

  async function handleReset() {
    try {
      await resetCloudData()
      toast('Data cloud dihapus. Atur frasa sandi baru untuk mulai lagi.')
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setConfirmReset(false)
    }
  }

  return (
    <div className="space-y-4">
      {!signedIn && (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Masuk dengan Google untuk menyimpan salinan terenkripsi datamu di cloud dan
            menyamakannya di semua perangkat. Google hanya dipakai untuk login; isi data tidak
            bisa dibaca server tanpa frasa sandimu.
          </p>
          <Button onClick={signInWithGoogle}>Masuk dengan Google</Button>
        </>
      )}

      {needsPassphrase && (
        <form onSubmit={(event) => void handleSetup(event)} className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Masuk sebagai <strong>{sync.email}</strong>.{' '}
            {hasProfile === false
              ? 'Buat frasa sandi untuk mengenkripsi datamu. Frasa ini tidak bisa dipulihkan: jika hilang, data cloud tidak bisa dibuka.'
              : hasProfile === true
                ? 'Masukkan frasa sandi yang kamu buat di perangkat pertama.'
                : 'Memeriksa akun...'}
          </p>
          {hasProfile !== null && (
            <>
              <Input
                label="Frasa sandi"
                type="password"
                autoComplete={hasProfile ? 'current-password' : 'new-password'}
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
              />
              {hasProfile === false && (
                <Input
                  label="Ulangi frasa sandi"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              )}
              <Button type="submit" loading={busy}>
                <KeyRound className="h-4 w-4" />
                {hasProfile ? 'Buka dan mulai sinkron' : 'Buat dan mulai sinkron'}
              </Button>
            </>
          )}
        </form>
      )}

      {signedIn && sync.hasKey && (
        <div className="space-y-3">
          <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
            <p className="font-semibold text-slate-800 dark:text-slate-100">{sync.email}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {sync.status === 'syncing'
                ? 'Menyinkronkan...'
                : sync.lastSyncAt
                  ? `Terakhir sinkron: ${formatDateTime(new Date(sync.lastSyncAt))}`
                  : 'Belum pernah sinkron.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void handleSyncNow()}
              loading={busy || sync.status === 'syncing'}
            >
              <RefreshCw className="h-4 w-4" />
              Sinkron sekarang
            </Button>
            <Button variant="outline" onClick={() => setConfirmDisconnect(true)}>
              <LogOut className="h-4 w-4" />
              Putuskan
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            Sinkron otomatis berjalan saat data berubah, saat aplikasi dibuka kembali, dan berkala
            selama aplikasi terbuka. Menghapus atau mereset data di perangkat ini juga akan
            menghapusnya di cloud dan perangkat lain. Bila dua perangkat mengubah data yang sama,
            versi terbaru yang dipakai. PIN, API key, dan tema tidak ikut disinkronkan.
          </p>
        </div>
      )}

      {sync.error && (
        <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {sync.error}
        </p>
      )}
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      {signedIn && (
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Lupa frasa sandi? Hapus data cloud dan mulai ulang
        </button>
      )}

      <ConfirmDialog
        open={confirmDisconnect}
        title="Putuskan sinkronisasi?"
        message="Kamu keluar dari akun dan kunci enkripsi dihapus dari perangkat ini. Data di perangkat ini dan di cloud tidak dihapus."
        confirmLabel="Putuskan"
        onCancel={() => setConfirmDisconnect(false)}
        onConfirm={() => void handleDisconnect()}
      />
      <ConfirmDialog
        open={confirmReset}
        title="Hapus semua data cloud?"
        message="Semua data terenkripsi milik akun ini di Supabase dihapus permanen, termasuk frasa sandi. Data di perangkat ini tidak berubah, tetapi perangkat lain tidak akan menerima apa pun sampai kamu mengatur frasa sandi baru."
        confirmLabel="Hapus data cloud"
        danger
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => void handleReset()}
      />
    </div>
  )
}
