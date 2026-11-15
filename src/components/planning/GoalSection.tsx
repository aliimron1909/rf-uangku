import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  MinusCircle,
  Pencil,
  PiggyBank,
  Plus,
  PlusCircle,
  Trash2,
} from 'lucide-react'
import type { Goal, GoalContributionKind } from '../../types'
import { useGoals } from '../../hooks/useGoals'
import {
  addGoalContribution,
  deleteGoal,
  deleteGoalContribution,
} from '../../db/goals'
import { goalProgress, goalSummary, type GoalProgress } from '../../lib/goals'
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
import { GoalForm } from './GoalForm'

interface EntryTarget {
  progress: GoalProgress
  kind: GoalContributionKind
}

export function GoalSection() {
  const { goals, contributions } = useGoals()
  const { toast } = useToast()
  const today = todayISO()

  const progress = useMemo(
    () => goalProgress(goals, contributions, today),
    [goals, contributions, today],
  )
  const summary = useMemo(() => goalSummary(progress), [progress])
  const overallPercentage =
    summary.totalTarget > 0 ? Math.min(100, (summary.totalSaved / summary.totalTarget) * 100) : 0

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [entry, setEntry] = useState<EntryTarget | null>(null)
  const [deleting, setDeleting] = useState<Goal | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [openHistory, setOpenHistory] = useState<string | null>(null)

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
  }

  async function handleEntry(values: AmountEntryValues) {
    if (!entry) return
    await addGoalContribution({
      goalId: entry.progress.goal.id,
      kind: entry.kind,
      amount: values.amount,
      occurredAt: values.occurredAt,
      note: values.note,
    })
    toast(entry.kind === 'deposit' ? 'Dana ditambahkan ke target.' : 'Dana diambil dari target.')
    setEntry(null)
  }

  async function handleDelete() {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await deleteGoal(deleting.id)
      toast('Target dihapus.')
      setDeleting(null)
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleDeleteContribution(id: string) {
    try {
      await deleteGoalContribution(id)
      toast('Catatan dihapus.')
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Target tabungan
            </p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {formatRupiah(summary.totalSaved)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              terkumpul dari {formatRupiah(summary.totalTarget)} ·{' '}
              {summary.activeCount} berjalan, {summary.doneCount} selesai
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Tambah target
          </Button>
        </div>
        {progress.length > 0 && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${overallPercentage}%` }}
            />
          </div>
        )}
      </section>

      {progress.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <EmptyState
            icon={<PiggyBank className="h-7 w-7" />}
            title="Belum ada target tabungan"
            description="Buat target seperti dana darurat, laptop, atau liburan, lalu catat setoranmu."
            action={
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" />
                Buat target pertama
              </Button>
            }
          />
        </section>
      ) : (
        <div className="space-y-2">
          {progress.map((item) => {
            const { goal } = item
            const history = contributions
              .filter((row) => row.goalId === goal.id)
              .sort(
                (a, b) =>
                  b.occurredAt.localeCompare(a.occurredAt) ||
                  b.createdAt.localeCompare(a.createdAt),
              )
            const historyOpen = openHistory === goal.id
            return (
              <div
                key={goal.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 h-10 w-10 shrink-0 rounded-xl"
                    style={{ backgroundColor: goal.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                        {goal.name}
                      </p>
                      {item.status === 'done' && <Badge variant="success">Tercapai</Badge>}
                      {item.status === 'late' && <Badge variant="expense">Lewat tenggat</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {formatRupiah(Math.max(0, item.saved))} dari {formatRupiah(goal.targetAmount)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(goal)
                        setFormOpen(true)
                      }}
                      aria-label="Ubah target"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(goal)}
                      aria-label="Hapus target"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${item.percentage}%`, backgroundColor: goal.color }}
                  />
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {formatPercent(item.percentage)}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {item.status === 'done' ? 'Target tercapai 🎉' : `Sisa ${formatRupiah(item.remaining)}`}
                  </span>
                </div>

                {goal.deadline && (
                  <p
                    className={cn(
                      'mt-1 text-[11px]',
                      item.status === 'late'
                        ? 'font-semibold text-rose-600 dark:text-rose-400'
                        : 'text-slate-500 dark:text-slate-400',
                    )}
                  >
                    Tenggat {formatDate(goal.deadline)}
                    {item.daysLeft !== null && item.status !== 'done'
                      ? item.daysLeft < 0
                        ? ` · lewat ${Math.abs(item.daysLeft)} hari`
                        : item.daysLeft === 0
                          ? ' · hari ini'
                          : ` · ${item.daysLeft} hari lagi`
                      : ''}
                  </p>
                )}
                {item.monthlyNeeded !== null && (
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Saran setoran: {formatRupiah(item.monthlyNeeded)} per bulan
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => setEntry({ progress: item, kind: 'deposit' })}>
                    <PlusCircle className="h-4 w-4" />
                    Tambah dana
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={item.saved <= 0}
                    onClick={() => setEntry({ progress: item, kind: 'withdrawal' })}
                  >
                    <MinusCircle className="h-4 w-4" />
                    Ambil
                  </Button>
                  <button
                    type="button"
                    onClick={() => setOpenHistory(historyOpen ? null : goal.id)}
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
                        Belum ada setoran.
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
                          <p
                            className={cn(
                              'shrink-0 text-xs font-bold',
                              row.kind === 'deposit'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400',
                            )}
                          >
                            {row.kind === 'deposit' ? '+' : '−'}
                            {formatRupiah(row.amount)}
                          </p>
                          <button
                            type="button"
                            onClick={() => void handleDeleteContribution(row.id)}
                            aria-label="Hapus catatan"
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
        title={editing ? 'Ubah target' : 'Tambah target'}
        size="sm"
      >
        <GoalForm
          goal={editing}
          onSaved={() => {
            toast(editing ? 'Target diperbarui.' : 'Target disimpan.')
            closeForm()
          }}
          onCancel={closeForm}
        />
      </Modal>

      <Modal
        open={Boolean(entry)}
        onClose={() => setEntry(null)}
        title={entry?.kind === 'withdrawal' ? 'Ambil dana' : 'Tambah dana'}
        description={entry?.progress.goal.name}
        size="sm"
      >
        {entry && (
          <AmountEntryForm
            amountLabel={entry.kind === 'withdrawal' ? 'Nominal diambil' : 'Nominal ditambahkan'}
            submitLabel={entry.kind === 'withdrawal' ? 'Ambil dana' : 'Simpan'}
            maxAmount={entry.kind === 'withdrawal' ? Math.max(0, entry.progress.saved) : undefined}
            maxLabel="Tabungan terkumpul"
            notePlaceholder={entry.kind === 'withdrawal' ? 'Contoh: dipakai bayar cicilan' : 'Contoh: sisa gaji'}
            onSubmit={handleEntry}
            onCancel={() => setEntry(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Hapus target?"
        message="Target beserta seluruh riwayat setorannya akan dihapus. Saldo rekening tidak terpengaruh."
        confirmLabel="Hapus target"
        danger
        loading={deleteLoading}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
