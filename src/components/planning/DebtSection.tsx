import { useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  HandCoins,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import type { Debt, DebtDirection } from '../../types'
import { useDebts } from '../../hooks/useDebts'
import { addDebtPayment, deleteDebt, deleteDebtPayment } from '../../db/debts'
import {
  debtDirectionLabel,
  debtProgress,
  debtSummary,
  type DebtProgress,
  type DebtStatus,
} from '../../lib/debts'
import { formatDate, todayISO } from '../../lib/dates'
import { formatPercent, formatRupiah } from '../../lib/format'
import { cn, errorMessage } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { EmptyState } from '../ui/EmptyState'
import { Modal } from '../ui/Modal'
import { AmountEntryForm, type AmountEntryValues } from './AmountEntryForm'
import { DebtForm } from './DebtForm'

type Filter = 'all' | DebtDirection

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'owe', label: 'Hutang saya' },
  { value: 'lent', label: 'Piutang' },
]

function statusBadge(item: DebtProgress) {
  const days = item.daysUntilDue
  const labels: Record<DebtStatus, string> = {
    paid: 'Lunas',
    overdue: days !== null ? `Terlambat ${Math.abs(days)} hari` : 'Terlambat',
    dueSoon: days === 0 ? 'Jatuh tempo hari ini' : `${days} hari lagi`,
    open: 'Berjalan',
  }
  const variant =
    item.status === 'paid'
      ? 'success'
      : item.status === 'overdue'
        ? 'expense'
        : item.status === 'dueSoon'
          ? 'warning'
          : 'neutral'
  return <Badge variant={variant}>{labels[item.status]}</Badge>
}

export function DebtSection() {
  const { debts, payments } = useDebts()
  const { toast } = useToast()
  const today = todayISO()

  const progress = useMemo(() => debtProgress(debts, payments, today), [debts, payments, today])
  const summary = useMemo(() => debtSummary(progress), [progress])

  const [filter, setFilter] = useState<Filter>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Debt | null>(null)
  const [payFor, setPayFor] = useState<DebtProgress | null>(null)
  const [deleting, setDeleting] = useState<Debt | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [openHistory, setOpenHistory] = useState<string | null>(null)

  const visible = progress.filter((item) => filter === 'all' || item.debt.direction === filter)

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
  }

  async function handlePayment(values: AmountEntryValues) {
    if (!payFor) return
    await addDebtPayment({
      debtId: payFor.debt.id,
      amount: values.amount,
      occurredAt: values.occurredAt,
      note: values.note,
    })
    toast(
      values.amount >= payFor.remaining ? 'Lunas! Pembayaran dicatat.' : 'Pembayaran dicatat.',
    )
    setPayFor(null)
  }

  async function handleDelete() {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await deleteDebt(deleting.id)
      toast('Catatan dihapus.')
      setDeleting(null)
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleDeletePayment(id: string) {
    try {
      await deleteDebtPayment(id)
      toast('Pembayaran dihapus.')
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Hutang &amp; piutang
          </p>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Tambah
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-rose-50 px-3 py-2.5 dark:bg-rose-950/30">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-500">
              Hutang saya
            </p>
            <p className="mt-0.5 text-sm font-bold text-rose-700 dark:text-rose-300">
              {formatRupiah(summary.oweRemaining)}
            </p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950/30">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
              Piutang
            </p>
            <p className="mt-0.5 text-sm font-bold text-emerald-700 dark:text-emerald-300">
              {formatRupiah(summary.lentRemaining)}
            </p>
          </div>
        </div>
        {(summary.overdueCount > 0 || summary.dueSoonCount > 0) && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {summary.overdueCount > 0 && `${summary.overdueCount} sudah lewat jatuh tempo. `}
            {summary.dueSoonCount > 0 && `${summary.dueSoonCount} jatuh tempo dalam 7 hari.`}
          </p>
        )}
      </section>

      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={cn(
              'rounded-xl px-2 py-2 text-xs font-semibold transition',
              filter === item.value
                ? 'bg-emerald-50 text-emerald-700 shadow-sm dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <EmptyState
            icon={<HandCoins className="h-7 w-7" />}
            title="Belum ada catatan"
            description="Catat hutang atau piutang beserta jatuh tempo, lalu catat cicilannya."
            action={
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" />
                Tambah catatan
              </Button>
            }
          />
        </section>
      ) : (
        <div className="space-y-2">
          {visible.map((item) => {
            const { debt } = item
            const owe = debt.direction === 'owe'
            const history = payments
              .filter((row) => row.debtId === debt.id)
              .sort(
                (a, b) =>
                  b.occurredAt.localeCompare(a.occurredAt) ||
                  b.createdAt.localeCompare(a.createdAt),
              )
            const historyOpen = openHistory === debt.id
            return (
              <div
                key={debt.id}
                className={cn(
                  'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900',
                  item.status === 'paid' && 'opacity-70',
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                      owe
                        ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300',
                    )}
                  >
                    {owe ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                        {debt.person}
                      </p>
                      {statusBadge(item)}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {debtDirectionLabel(debt.direction)}
                      {debt.dueDate ? ` · jatuh tempo ${formatDate(debt.dueDate)}` : ''}
                    </p>
                    {debt.note && (
                      <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
                        {debt.note}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(debt)
                        setFormOpen(true)
                      }}
                      aria-label="Ubah catatan"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(debt)}
                      aria-label="Hapus catatan"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      owe ? 'bg-rose-500' : 'bg-emerald-500',
                    )}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">
                    {formatRupiah(item.paid)} dari {formatRupiah(debt.amount)} (
                    {formatPercent(item.percentage)})
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {item.status === 'paid' ? 'Lunas' : `Sisa ${formatRupiah(item.remaining)}`}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {item.status !== 'paid' && (
                    <Button size="sm" onClick={() => setPayFor(item)}>
                      {owe ? 'Bayar' : 'Terima pembayaran'}
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpenHistory(historyOpen ? null : debt.id)}
                    className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Riwayat ({history.length})
                    {historyOpen ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {historyOpen && (
                  <div className="mt-3 divide-y divide-slate-100 rounded-xl bg-slate-50 dark:divide-slate-800 dark:bg-slate-800/50">
                    {history.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                        Belum ada pembayaran.
                      </p>
                    ) : (
                      history.map((row) => (
                        <div key={row.id} className="flex items-center gap-2 px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                              {formatDate(row.occurredAt)}
                            </p>
                            {row.note && (
                              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                                {row.note}
                              </p>
                            )}
                          </div>
                          <p className="shrink-0 text-xs font-bold text-slate-700 dark:text-slate-200">
                            {formatRupiah(row.amount)}
                          </p>
                          <button
                            type="button"
                            onClick={() => void handleDeletePayment(row.id)}
                            aria-label="Hapus pembayaran"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Ubah catatan' : 'Tambah hutang / piutang'}
        size="sm"
      >
        <DebtForm
          debt={editing}
          defaultDirection={filter === 'lent' ? 'lent' : 'owe'}
          onSaved={() => {
            toast(editing ? 'Catatan diperbarui.' : 'Catatan disimpan.')
            closeForm()
          }}
          onCancel={closeForm}
        />
      </Modal>

      <Modal
        open={Boolean(payFor)}
        onClose={() => setPayFor(null)}
        title={payFor?.debt.direction === 'owe' ? 'Catat pembayaran' : 'Catat penerimaan'}
        description={payFor?.debt.person}
        size="sm"
      >
        {payFor && (
          <AmountEntryForm
            amountLabel={payFor.debt.direction === 'owe' ? 'Nominal dibayar' : 'Nominal diterima'}
            submitLabel="Simpan"
            maxAmount={payFor.remaining}
            maxLabel="Sisa"
            notePlaceholder="Contoh: cicilan ke-1"
            onSubmit={handlePayment}
            onCancel={() => setPayFor(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Hapus catatan?"
        message="Catatan beserta seluruh riwayat pembayarannya akan dihapus. Saldo rekening tidak terpengaruh."
        confirmLabel="Hapus"
        danger
        loading={deleteLoading}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
