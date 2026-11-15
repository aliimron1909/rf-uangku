import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Pencil, Plus, Target, Trash2 } from 'lucide-react'
import type { Budget, BudgetProgress } from '../../types'
import { useBudgets } from '../../hooks/useBudgets'
import { useTransactions } from '../../hooks/useTransactions'
import { useAllCategories } from '../../hooks/useCategories'
import { stopBudget } from '../../db/budgets'
import {
  budgetBarClass,
  budgetProgress,
  budgetStatusLabel,
  budgetSummary,
  budgetTextClass,
  resolveBudgets,
} from '../../lib/budget'
import { BUDGET_LEGACY_MONTH } from '../../lib/constants'
import { formatDate, monthKey, monthRangeFromKey, shiftMonthKey } from '../../lib/dates'
import { formatPercent, formatRupiah } from '../../lib/format'
import { errorMessage } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { EmptyState } from '../ui/EmptyState'
import { Modal } from '../ui/Modal'
import { EntityIcon } from '../ui/EntityIcon'
import { defaultCategoryIconKey } from '../../lib/icons'
import { BudgetForm } from './BudgetForm'

export function BudgetSection() {
  const budgets = useBudgets()
  const transactions = useTransactions()
  const categories = useAllCategories()
  const { toast } = useToast()
  const currentKey = useMemo(() => monthKey(), [])
  const [selectedKey, setSelectedKey] = useState(currentKey)
  const month = useMemo(() => monthRangeFromKey(selectedKey), [selectedKey])
  const isCurrentMonth = selectedKey === currentKey

  // Bulan paling awal yang bisa dibuka: bulan transaksi tertua (atau bulan ini).
  const minKey = useMemo(() => {
    let min = currentKey
    for (const transaction of transactions) {
      const key = transaction.occurredAt.slice(0, 7)
      if (key < min) min = key
    }
    return min
  }, [transactions, currentKey])
  const maxKey = useMemo(() => shiftMonthKey(currentKey, 12), [currentKey])

  const activeBudgets = useMemo(() => resolveBudgets(budgets, selectedKey), [budgets, selectedKey])

  const progress = useMemo(
    () => budgetProgress(budgets, transactions, categories, month),
    [budgets, transactions, categories, month],
  )
  const summary = useMemo(
    () => budgetSummary(progress, transactions, categories, month),
    [progress, transactions, categories, month],
  )

  const [modalOpen, setModalOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [deletingBudget, setDeletingBudget] = useState<Budget | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const availableCount = categories.filter(
    (category) =>
      category.type === 'expense' &&
      !category.archived &&
      !activeBudgets.some((budget) => budget.categoryId === category.id),
  ).length

  function openCreate() {
    setEditingBudget(null)
    setModalOpen(true)
  }

  function openEdit(budget: Budget) {
    setEditingBudget(budget)
    setModalOpen(true)
  }

  function handleSaved() {
    setModalOpen(false)
    setEditingBudget(null)
    toast(
      editingBudget
        ? `Budget diperbarui mulai ${month.label}.`
        : `Budget disimpan mulai ${month.label}.`,
    )
  }

  async function handleDelete() {
    if (!deletingBudget) return
    setDeleteLoading(true)
    try {
      await stopBudget(deletingBudget.categoryId, selectedKey)
      toast(`Budget dihentikan mulai ${month.label}. Bulan sebelumnya tidak berubah.`)
      setDeletingBudget(null)
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
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSelectedKey(shiftMonthKey(selectedKey, -1))}
                disabled={selectedKey <= minKey}
                aria-label="Bulan sebelumnya"
                className="-ml-1.5 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="min-w-32 text-center text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Budget {month.label}
              </p>
              <button
                type="button"
                onClick={() => setSelectedKey(shiftMonthKey(selectedKey, 1))}
                disabled={selectedKey >= maxKey}
                aria-label="Bulan berikutnya"
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {!isCurrentMonth && (
                <button
                  type="button"
                  onClick={() => setSelectedKey(currentKey)}
                  className="ml-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-emerald-600 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                >
                  Bulan ini
                </button>
              )}
            </div>
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {formatRupiah(summary.limit)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {isCurrentMonth
                ? 'Total batas pengeluaran bulan ini'
                : `Total batas pengeluaran ${month.label}`}
            </p>
          </div>
          <Button onClick={openCreate} disabled={availableCount === 0}>
            <Plus className="h-4 w-4" />
            Tambah budget
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Terpakai
            </p>
            <p className="mt-0.5 text-sm font-bold text-slate-800 dark:text-slate-100">
              {formatRupiah(summary.spent)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Sisa
            </p>
            <p
              className={`mt-0.5 text-sm font-bold ${
                summary.remaining < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-800 dark:text-slate-100'
              }`}
            >
              {formatRupiah(summary.remaining)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Terpakai
            </p>
            <p className="mt-0.5 text-sm font-bold text-slate-800 dark:text-slate-100">
              {formatPercent(summary.percentage)}
            </p>
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-full rounded-full transition-all ${
              summary.percentage >= 100
                ? 'bg-rose-500'
                : summary.percentage >= 80
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, summary.percentage))}%` }}
          />
        </div>

        {(summary.overCount > 0 || summary.warningCount > 0) && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {summary.overCount > 0
              ? `${summary.overCount} kategori sudah melewati budget.`
              : `${summary.warningCount} kategori sudah mencapai 80% budget.`}
          </p>
        )}

        {summary.unbudgetedSpent > 0 && (
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Pengeluaran tanpa budget: {formatRupiah(summary.unbudgetedSpent)}.
          </p>
        )}
      </section>

      {progress.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <EmptyState
            icon={<Target className="h-7 w-7" />}
            title={`Belum ada budget di ${month.label}`}
            description="Tetapkan batas bulanan per kategori pengeluaran. Limit berlaku mulai bulan ini dan berlanjut ke bulan berikutnya."
            action={
              <Button onClick={openCreate} disabled={availableCount === 0}>
                <Plus className="h-4 w-4" />
                Buat budget pertama
              </Button>
            }
          />
        </section>
      ) : (
        <div className="space-y-2">
          {progress.map((item) => {
            const budget = budgets.find((row) => row.id === item.budgetId)
            return (
              <BudgetRow
                key={item.budgetId}
                item={item}
                onEdit={() => budget && openEdit(budget)}
                onDelete={() => budget && setDeletingBudget(budget)}
              />
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingBudget(null)
        }}
        title={editingBudget ? 'Edit Budget' : 'Tambah Budget'}
        description={`Berlaku mulai ${month.label} sampai ada perubahan berikutnya.`}
        size="sm"
      >
        <BudgetForm
          budget={editingBudget}
          categories={categories}
          budgets={activeBudgets}
          month={selectedKey}
          monthLabel={month.label}
          onSaved={handleSaved}
          onCancel={() => {
            setModalOpen(false)
            setEditingBudget(null)
          }}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingBudget)}
        title="Hentikan budget?"
        message={
          deletingBudget
            ? `Budget kategori ini dihentikan mulai ${month.label}. Bulan sebelumnya tetap tercatat dan transaksi tidak terhapus.`
            : ''
        }
        confirmLabel="Hentikan budget"
        danger
        loading={deleteLoading}
        onCancel={() => setDeletingBudget(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}

function BudgetRow({
  item,
  onEdit,
  onDelete,
}: {
  item: BudgetProgress
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <EntityIcon
          icon={item.categoryIcon}
          fallback={defaultCategoryIconKey(item.categoryName, 'expense')}
          color={item.categoryColor}
          size="lg"
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
              {item.categoryName}
            </p>
            <Badge
              variant={
                item.status === 'over'
                  ? 'expense'
                  : item.status === 'warning'
                    ? 'warning'
                    : 'success'
              }
            >
              {budgetStatusLabel(item.status)}
            </Badge>
            {item.categoryArchived && <Badge variant="neutral">Arsip</Badge>}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {formatRupiah(item.spent)} dari {formatRupiah(item.limit)}
            {item.effectiveFrom !== BUDGET_LEGACY_MONTH && (
              <span className="text-slate-400 dark:text-slate-500">
                {' '}
                · sejak {formatDate(`${item.effectiveFrom}-01`, 'MMM yyyy')}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Edit budget"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
            aria-label="Hentikan budget"
            title="Hentikan mulai bulan ini"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${budgetBarClass(item.status)}`}
          style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
        <span className={`font-semibold ${budgetTextClass(item.status)}`}>
          {formatPercent(item.percentage)} terpakai
        </span>
        <span
          className={
            item.remaining < 0
              ? 'font-semibold text-rose-600 dark:text-rose-400'
              : 'text-slate-500 dark:text-slate-400'
          }
        >
          {item.remaining < 0
            ? `Lebih ${formatRupiah(Math.abs(item.remaining))}`
            : `Sisa ${formatRupiah(item.remaining)}`}
        </span>
      </div>
    </div>
  )
}
