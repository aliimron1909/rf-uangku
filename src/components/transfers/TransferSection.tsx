import { useMemo, useState } from 'react'
import { ArrowLeftRight, ArrowRight, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Transfer } from '../../types'
import { useAllAccounts } from '../../hooks/useAccounts'
import { useTransfers } from '../../hooks/useTransfers'
import { deleteTransfer } from '../../db/transfers'
import { formatDate } from '../../lib/dates'
import { formatRupiah } from '../../lib/format'
import { errorMessage } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { EmptyState } from '../ui/EmptyState'
import { Modal } from '../ui/Modal'
import { TransferForm } from './TransferForm'

const VISIBLE_LIMIT = 5

export function TransferSection() {
  const transfers = useTransfers()
  const accounts = useAllAccounts()
  const { toast } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Transfer | null>(null)
  const [deleting, setDeleting] = useState<Transfer | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const accountNames = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts],
  )
  const rows = showAll ? transfers : transfers.slice(0, VISIBLE_LIMIT)

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(transfer: Transfer) {
    setEditing(transfer)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
  }

  async function handleDelete() {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await deleteTransfer(deleting.id)
      toast('Transfer dihapus.')
      setDeleting(null)
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800 sm:px-5">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Transfer Antar Rekening
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Tidak dihitung sebagai pemasukan/pengeluaran
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4" />
          Transfer
        </Button>
      </div>

      {transfers.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight className="h-5 w-5" />}
          title="Belum ada transfer"
          description="Pindahkan saldo antar rekening, misalnya dari BCA ke e-wallet."
        />
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((transfer) => (
            <div key={transfer.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300">
                <ArrowLeftRight className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <span className="truncate">
                    {accountNames.get(transfer.fromAccountId) ?? 'Rekening dihapus'}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">
                    {accountNames.get(transfer.toAccountId) ?? 'Rekening dihapus'}
                  </span>
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(transfer.occurredAt)}
                  {transfer.note ? ` · ${transfer.note}` : ''}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold text-slate-700 dark:text-slate-200">
                {formatRupiah(transfer.amount)}
              </p>
              <div className="flex shrink-0 gap-0.5">
                <button
                  type="button"
                  onClick={() => openEdit(transfer)}
                  aria-label="Ubah transfer"
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(transfer)}
                  aria-label="Hapus transfer"
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {transfers.length > VISIBLE_LIMIT && (
            <div className="px-4 py-2.5 text-center sm:px-5">
              <button
                type="button"
                onClick={() => setShowAll((value) => !value)}
                className="text-xs font-semibold text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400"
              >
                {showAll ? 'Tampilkan lebih sedikit' : `Lihat semua (${transfers.length})`}
              </button>
            </div>
          )}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Ubah transfer' : 'Transfer antar rekening'}
      >
        <TransferForm transfer={editing} onSaved={closeForm} onCancel={closeForm} />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Hapus transfer?"
        message="Saldo kedua rekening akan kembali seperti sebelum transfer ini dicatat."
        confirmLabel="Hapus"
        danger
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
