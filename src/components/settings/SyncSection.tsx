import { useEffect, useState } from 'react'
import { CloudOff, LogOut, RefreshCw, Trash2 } from 'lucide-react'
import {
  disconnectSync,
  resetCloudData,
  signInWithGoogle,
  syncNow,
  useSyncState,
} from '../../lib/sync/controller'
import { formatDateTime } from '../../lib/dates'
import { nativeDiagnostics, subscribeNativeEvents } from '../../lib/native'
import { errorMessage } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'

export function SyncSection() {
  const sync = useSyncState()
  const [, setTick] = useState(0)
  useEffect(() => subscribeNativeEvents(() => setTick((value) => value + 1)), [])
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const signedIn = Boolean(sync.email)

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
      toast('Data cloud dihapus dan diunggah ulang dari perangkat ini.')
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
            Masuk dengan Google untuk menyimpan salinan datamu di akun Supabase milikmu sendiri dan
            menyamakannya di semua perangkat. Hanya akun yang kamu pakai masuk yang bisa
            membaca datanya.
          </p>
          <Button onClick={signInWithGoogle}>Masuk dengan Google</Button>
        </>
      )}

      {signedIn && (
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

      {nativeDiagnostics() && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{nativeDiagnostics()}</p>
      )}

      {sync.error && (
        <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {sync.error}
        </p>
      )}

      {signedIn && (
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Hapus data cloud lalu unggah ulang dari perangkat ini
        </button>
      )}

      <ConfirmDialog
        open={confirmDisconnect}
        title="Putuskan sinkronisasi?"
        message="Kamu keluar dari akun. Data di perangkat ini dan di cloud tidak dihapus."
        confirmLabel="Putuskan"
        onCancel={() => setConfirmDisconnect(false)}
        onConfirm={() => void handleDisconnect()}
      />
      <ConfirmDialog
        open={confirmReset}
        title="Hapus semua data cloud?"
        message="Semua data milik akun ini di Supabase dihapus permanen, lalu data di perangkat ini diunggah ulang. Data di perangkat ini tidak berubah. Perangkat lain yang punya data berbeda ikut mengunggah versinya saat sinkron berikutnya."
        confirmLabel="Hapus data cloud"
        danger
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => void handleReset()}
      />
    </div>
  )
}
