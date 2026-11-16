import { useState } from 'react'
import { Layers, RotateCcw, Trash2 } from 'lucide-react'
import type { TrashItem } from '../../types'
import { useAllAccounts } from '../../hooks/useAccounts'
import { useAllCategories } from '../../hooks/useCategories'
import { deleteTrashItem, emptyTrash, restoreFromTrash, TRASH_RETENTION_DAYS } from '../../db/transactions'
import { formatDate } from '../../lib/dates'
import { formatRupiah } from '../../lib/format'
import { errorMessage } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Modal } from '../ui/Modal'

interface TrashModalProps {
  open: boolean
  items: TrashItem[]
  onClose: () => void
}

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return days <= 0 ? 'hari ini' : `${days} hari lalu`
}

export function TrashModal({ open, items, onClose }: TrashModalProps) {
  const { toast } = useToast()
  const accounts = useAllAccounts()
  const categories = useAllCategories()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmEmpty, setConfirmEmpty] = useState(false)

  async function handleRestore(item: TrashItem) {
    setBusyId(item.id)
    try {
      const count = await restoreFromTrash(item.id)
      toast(count > 1 ? `${count} pecahan struk dipulihkan.` : 'Transaksi dipulihkan.')
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(item: TrashItem) {
    try {
      await deleteTrashItem(item.id)
      toast('Dihapus permanen.')
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    }
  }

  async function handleEmpty() {
    try {
      await emptyTrash()
      toast('Sampah dikosongkan.')
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setConfirmEmpty(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tempat sampah"
      description={`Transaksi yang dihapus disimpan ${TRASH_RETENTION_DAYS} hari sebelum hilang permanen.`}
    >
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Sampah kosong.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
            {items.map((item) => {
              const first = item.transactions[0]
              const total = item.transactions.reduce((sum, row) => sum + row.amount, 0)
              const category = categories.find((entry) => entry.id === first.categoryId)
              const account = accounts.find((entry) => entry.id === first.accountId)
              const isSplit = item.transactions.length > 1
              return (
                <div key={item.id} className="flex items-center gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {first.note || category?.name || 'Transaksi'}
                      {isSplit && <Layers className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                    </p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {first.type === 'income' ? '+' : '-'}
                      {formatRupiah(total)} · {formatDate(first.occurredAt, 'dd MMM yyyy')} ·{' '}
                      {account?.name ?? 'Rekening hilang'} · dihapus {daysAgo(item.deletedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void handleRestore(item)}
                    aria-label="Pulihkan"
                    title="Pulihkan"
                    className="rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item)}
                    aria-label="Hapus permanen"
                    title="Hapus permanen"
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
          <Button variant="outline" className="w-full" onClick={() => setConfirmEmpty(true)}>
            Kosongkan sampah
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirmEmpty}
        title="Kosongkan sampah?"
        message="Semua transaksi di sampah dihapus permanen dan tidak bisa dipulihkan."
        confirmLabel="Kosongkan"
        danger
        onCancel={() => setConfirmEmpty(false)}
        onConfirm={() => void handleEmpty()}
      />
    </Modal>
  )
}
