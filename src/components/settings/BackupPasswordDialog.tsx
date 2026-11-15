import { useEffect, useState } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { MIN_BACKUP_PASSWORD_LENGTH } from '../../lib/backupCrypto'
import { errorMessage } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

interface BackupPasswordDialogProps {
  open: boolean
  mode: 'encrypt' | 'decrypt'
  onSubmit: (password: string) => Promise<void>
  onCancel: () => void
}

export function BackupPasswordDialog({
  open,
  mode,
  onSubmit,
  onCancel,
}: BackupPasswordDialogProps) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const encrypting = mode === 'encrypt'

  useEffect(() => {
    if (!open) return
    setPassword('')
    setConfirm('')
    setError('')
    setBusy(false)
  }, [open, mode])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (encrypting) {
      if (password.length < MIN_BACKUP_PASSWORD_LENGTH) {
        setError(`Password minimal ${MIN_BACKUP_PASSWORD_LENGTH} karakter.`)
        return
      }
      if (password !== confirm) {
        setError('Konfirmasi password tidak sama.')
        return
      }
    } else if (!password) {
      setError('Masukkan password backup.')
      return
    }

    setError('')
    setBusy(true)
    try {
      await onSubmit(password)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onCancel}
      size="sm"
      title={encrypting ? 'Backup terenkripsi' : 'Buka backup terenkripsi'}
      description={
        encrypting
          ? 'File backup akan dikunci dengan password.'
          : 'File ini dilindungi password.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Password backup"
          type="password"
          autoComplete={encrypting ? 'new-password' : 'current-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus
        />
        {encrypting && (
          <Input
            label="Ulangi password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        )}

        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        {encrypting && (
          <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Password <span className="font-bold">tidak disimpan</span> dan tidak bisa dipulihkan.
            Jika lupa, file backup ini tidak bisa dibuka lagi. Catat di tempat aman.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" loading={busy}>
            {encrypting ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            {encrypting ? 'Kunci & unduh' : 'Buka backup'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
