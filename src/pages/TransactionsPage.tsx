import { TransferModal } from '../components/transactions/TransferModal';
import { ArrowRightLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, MessageCircle, Plus, SearchX } from 'lucide-react'
import type { Transaction, TransactionWithRefs } from '../types'
import { useTransactions } from '../hooks/useTransactions'
import { useAllAccounts } from '../hooks/useAccounts'
import { useBudgets } from '../hooks/useBudgets'
import { useAllCategories } from '../hooks/useCategories'
import { computeTotals, withRefs } from '../lib/analytics'
import { newExpenseBudgetAlert } from '../lib/budget'
import { createTransaction, deleteTransaction } from '../db/transactions'
import type { ResolvedAiDraft } from '../lib/groq'
import { errorMessage } from '../lib/utils'
import { formatRupiah } from '../lib/format'
import { useToast } from '../contexts/ToastContext'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { TransactionFilters, type TransactionFilterState } from '../components/transactions/TransactionFilters'
import { TransactionTable } from '../components/transactions/TransactionTable'
import { TransactionCard } from '../components/transactions/TransactionCard'
import { TransactionForm } from '../components/transactions/TransactionForm'
import { AiChatModal } from '../components/transactions/AiChatModal'

const PAGE_SIZE = 15

const [isTransferOpen, setIsTransferOpen] = useState(false);

<button
  onClick={() => setIsTransferOpen(true)}
  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-xl font-medium"
>
  <ArrowRightLeft className="w-4 h-4" />
  Transfer
</button>

<TransferModal
  isOpen={isTransferOpen}
  onClose={() => setIsTransferOpen(false)}
  accounts={accounts}
/>
    
const emptyFilters: TransactionFilterState = {
  search: '',
  type: 'all',
  accountId: 'all',
  categoryId: 'all',
  dateFrom: '',
  dateTo: '',
}

export function TransactionsPage() {
  const transactions = useTransactions()
  const accounts = useAllAccounts()
  const categories = useAllCategories()
  const budgets = useBudgets()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters] = useState<TransactionFilterState>(emptyFilters)
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [chatDraft, setChatDraft] = useState<ResolvedAiDraft | null>(null)
  const [deleting, setDeleting] = useState<TransactionWithRefs | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditing(null)
      setChatDraft(null)
      setFormOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    if (searchParams.get('chat') !== '1') return
    setChatOpen(true)
    const next = new URLSearchParams(searchParams)
    next.delete('chat')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const rows = useMemo(
    () => withRefs(transactions, accounts, categories),
    [transactions, accounts, categories],
  )

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase()

    return rows.filter((row) => {
      if (filters.type !== 'all' && row.type !== filters.type) return false
      if (filters.accountId !== 'all' && row.accountId !== filters.accountId) return false
      if (filters.categoryId !== 'all' && row.categoryId !== filters.categoryId) return false
      if (filters.dateFrom && row.occurredAt < filters.dateFrom) return false
      if (filters.dateTo && row.occurredAt > filters.dateTo) return false
      if (search) {
        const haystack = `${row.note ?? ''} ${row.categoryName} ${row.accountName}`.toLowerCase()
        if (!haystack.includes(search)) return false
      }
      return true
    })
  }, [rows, filters])

  const summary = useMemo(() => computeTotals(filtered), [filtered])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  useEffect(() => {
    if (page > totalPages) setPage(1)
  }, [page, totalPages])

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const firstRow = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const lastRow = Math.min(page * PAGE_SIZE, filtered.length)

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
    setChatDraft(null)
    if (searchParams.get('new')) {
      const next = new URLSearchParams(searchParams)
      next.delete('new')
      setSearchParams(next, { replace: true })
    }
  }

  function openAdd() {
    setEditing(null)
    setChatDraft(null)
    setFormOpen(true)
  }

  function openEdit(transaction: TransactionWithRefs) {
    setEditing(transaction)
    setChatDraft(null)
    setFormOpen(true)
  }

  function openChat() {
    setChatOpen(true)
  }

  function handleChatApply(draft: ResolvedAiDraft) {
    setChatOpen(false)
    setEditing(null)
    setChatDraft(draft)
    setFormOpen(true)
  }

  async function handleChatSave(draft: ResolvedAiDraft) {
    const input = {
      type: draft.type,
      amount: draft.amount,
      accountId: draft.accountId,
      categoryId: draft.categoryId,
      occurredAt: draft.occurredAt,
      note: draft.note.trim(),
    }
    await createTransaction(input)
    toast('Transaksi berhasil disimpan.')
    const alert = newExpenseBudgetAlert(budgets, transactions, categories, input)
    if (alert) toast(alert.message, alert.type)
    setChatOpen(false)
    setPage(1)
  }

  function changeFilters(next: TransactionFilterState) {
    setFilters(next)
    setPage(1)
  }

  async function handleDelete() {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await deleteTransaction(deleting.id)
      toast('Transaksi berhasil dihapus.')
      setDeleting(null)
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Riwayat Keuangan
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
            Transaksi
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {transactions.length} transaksi tersimpan di perangkat.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openChat}>
            <MessageCircle className="h-4 w-4" />
            Chat AI
          </Button>
          <Button onClick={openAdd} className="hidden sm:inline-flex">
            <Plus className="h-4 w-4" />
            Tambah Transaksi
          </Button>
        </div>
      </div>

      <TransactionFilters
        filters={filters}
        onChange={changeFilters}
        accounts={accounts}
        categories={categories}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-white px-3.5 py-2.5 text-xs shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <span className="font-semibold text-slate-600 dark:text-slate-300">
          {filtered.length} hasil
        </span>
        <span className="text-slate-300 dark:text-slate-700">|</span>
        <span className="text-emerald-600 dark:text-emerald-400">
          Masuk {formatRupiah(summary.income)}
        </span>
        <span className="text-slate-300 dark:text-slate-700">|</span>
        <span className="text-rose-600 dark:text-rose-400">
          Keluar {formatRupiah(summary.expense)}
        </span>
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <EmptyState
            title="Belum ada transaksi"
            description="Mulai catat pemasukan atau pengeluaran pertama. Bisa juga pakai isi cepat AI."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={openAdd}>
                  <Plus className="h-4 w-4" />
                  Tambah transaksi
                </Button>
                <Button variant="outline" onClick={openChat}>
                  <MessageCircle className="h-4 w-4" />
                  Chat dengan AI
                </Button>
              </div>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <EmptyState
            icon={<SearchX className="h-7 w-7" />}
            title="Tidak ada transaksi yang cocok"
            description="Coba ubah kata kunci atau reset filter untuk melihat semua transaksi."
            action={
              <Button variant="outline" onClick={() => changeFilters(emptyFilters)}>
                Reset filter
              </Button>
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <TransactionTable transactions={paged} onEdit={openEdit} onDelete={setDeleting} />
          <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
            {paged.map((transaction) => (
              <TransactionCard
                key={transaction.id}
                transaction={transaction}
                onEdit={openEdit}
                onDelete={setDeleting}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Menampilkan {firstRow}–{lastRow} dari {filtered.length}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-14 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                aria-label="Halaman berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Edit Transaksi' : 'Tambah Transaksi'}
        description={
          editing
            ? 'Perbarui detail transaksi lalu simpan.'
            : chatDraft
              ? 'Periksa draft dari AI, ubah jika perlu, lalu simpan.'
              : 'Isi manual atau gunakan isi cepat AI.'
        }
        size="md"
      >
        <TransactionForm
          transaction={editing}
          initialDraft={chatDraft}
          onSaved={closeForm}
          onCancel={closeForm}
        />
      </Modal>

      <AiChatModal
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        accounts={accounts}
        categories={categories}
        onApplyDraft={handleChatApply}
        onSaveDraft={handleChatSave}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Hapus transaksi?"
        message={
          deleting
            ? `Transaksi "${deleting.note || deleting.categoryName}" sebesar ${formatRupiah(
                deleting.amount,
              )} akan dihapus permanen dari perangkat ini.`
            : ''
        }
        confirmLabel="Hapus"
        danger
        loading={deleteLoading}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
