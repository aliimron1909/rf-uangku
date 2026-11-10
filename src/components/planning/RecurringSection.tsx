import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Trash2,
} from 'lucide-react'
import type { RecurringTransaction } from '../../types'
import { useAllAccounts } from '../../hooks/useAccounts'
import { useAllCategories } from '../../hooks/useCategories'
import { useRecurringTransactions } from '../../hooks/useRecurringTransactions'
import { deleteRecurring, setRecurringActive } from '../../db/recurring'
import { formatDate } from '../../lib/dates'
import { formatRupiah } from '../../lib/format'
import { recurrenceDescription } from '../../lib/recurrence'
import { errorMessage } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { EmptyState } from '../ui/EmptyState'
import { Modal } from '../ui/Modal'
import { RecurringForm } from './RecurringForm'

export function RecurringSection() {
  const rules = useRecurringTransactions()
  const accounts = useAllAccounts()
  const categories = useAllCategories()
  const { toast } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<RecurringTransaction | null>(null)
  const [deletingRule, setDeletingRule] = useState<RecurringTransaction | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const activeRules = useMemo(() => rules.filter((rule) => rule.active), [rules])
  const nextRule = activeRules[0]
  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  )
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  function openCreate() {
    setEditingRule(null)
    setModalOpen(true)
  }

  function openEdit(rule: RecurringTransaction) {
    setEditingRule(rule)
    setModalOpen(true)
  }

  function handleSaved() {
    setModalOpen(false)
    setEditingRule(null)
    toast(editingRule ? 'Aturan berulang diperbarui.' : 'Aturan berulang disimpan.')
  }

  async function handleToggle(rule: RecurringTransaction) {
    try {
      const result = await setRecurringActive(rule.id, !rule.active)
      if (rule.active) {
        toast('Aturan berulang dijeda. Transaksi lama tetap tersimpan.')
      } else if (result.finished) {
        toast('Aturan sudah melewati tanggal selesai dan tetap nonaktif.', 'info')
      } else {
        toast('Aturan berulang diaktifkan kembali.')
      }
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    }
  }

  async function handleDelete() {
    if (!deletingRule) return
    setDeleteLoading(true)
    try {
      await deleteRecurring(deletingRule.id)
      toast('Aturan berulang dihapus. Transaksi yang sudah dibuat tetap ada.')
      setDeletingRule(null)
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Transaksi berulang
            </p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {activeRules.length} aturan aktif
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {nextRule
                ? `Berikutnya: ${nextRule.note?.trim() || categoryMap.get(nextRule.categoryId)?.name || 'Transaksi'} · ${formatDate(nextRule.nextRunAt)}`
                : 'Belum ada jadwal aktif.'}
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Tambah aturan
          </Button>
        </div>
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          Transaksi tertunda dibuat otomatis saat aplikasi dibuka atau dibuka kembali. Tidak ada
          eksekusi latar belakang saat aplikasi tertutup.
        </p>
      </section>

      {rules.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <EmptyState
            icon={<Repeat className="h-7 w-7" />}
            title="Belum ada transaksi berulang"
            description="Catat gaji, langganan, atau tagihan rutin agar otomatis masuk saat jatuh tempo."
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Buat aturan pertama
              </Button>
            }
          />
        </section>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => {
            const account = accountMap.get(rule.accountId)
            const category = categoryMap.get(rule.categoryId)
            const missingMaster =
              !account ||
              account.archived ||
              !category ||
              category.archived ||
              category.type !== rule.type
            const isIncome = rule.type === 'income'

            return (
              <div
                key={rule.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isIncome
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}
                  >
                    {isIncome ? (
                      <ArrowDownLeft className="h-5 w-5" />
                    ) : (
                      <ArrowUpRight className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                        {rule.note?.trim() || category?.name || 'Transaksi berulang'}
                      </p>
                      <Badge variant={rule.active ? 'success' : 'neutral'}>
                        {rule.active ? 'Aktif' : 'Dijeda'}
                      </Badge>
                      {missingMaster && (
                        <Badge variant="warning">
                          <AlertTriangle className="h-3 w-3" />
                          Perlu perbaikan
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {category?.name ?? 'Kategori hilang'} · {account?.name ?? 'Rekening hilang'}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                      {formatRupiah(rule.amount)}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                      {recurrenceDescription(rule)}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                      <CalendarClock className="h-3.5 w-3.5" />
                      Berikutnya {formatDate(rule.nextRunAt)}
                      {rule.lastRunAt ? ` · terakhir ${formatDate(rule.lastRunAt)}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => void handleToggle(rule)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      aria-label={rule.active ? 'Jeda aturan' : 'Aktifkan aturan'}
                      title={rule.active ? 'Jeda' : 'Aktifkan'}
                    >
                      {rule.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(rule)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      aria-label="Edit aturan"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingRule(rule)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                      aria-label="Hapus aturan"
                      title="Hapus"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingRule(null)
        }}
        title={editingRule ? 'Edit Aturan Berulang' : 'Tambah Aturan Berulang'}
        description="Aturan akan membuat transaksi otomatis sesuai jadwal."
        size="md"
      >
        <RecurringForm
          rule={editingRule}
          onSaved={handleSaved}
          onCancel={() => {
            setModalOpen(false)
            setEditingRule(null)
          }}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingRule)}
        title="Hapus aturan berulang?"
        message="Aturan akan dihapus. Transaksi yang sudah pernah dibuat tetap tersimpan dan tidak akan dibuat ulang."
        confirmLabel="Hapus aturan"
        danger
        loading={deleteLoading}
        onCancel={() => setDeletingRule(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
