import { useMemo, useState } from 'react'
import { AlertTriangle, ClipboardPenLine, Pencil, Plus, Settings2, Star, Trash2 } from 'lucide-react'
import type { Favorite } from '../../types'
import { useAllAccounts } from '../../hooks/useAccounts'
import { useAllCategories } from '../../hooks/useCategories'
import { useFavorites } from '../../hooks/useFavorites'
import { deleteFavorite, undoFavoriteUse, useFavorite } from '../../db/favorites'
import { favoriteIssue } from '../../lib/favorites'
import { todayISO } from '../../lib/dates'
import { formatRupiah } from '../../lib/format'
import { defaultCategoryIconKey } from '../../lib/icons'
import type { ResolvedAiDraft } from '../../lib/groq'
import { cn, errorMessage } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { EntityIcon } from '../ui/EntityIcon'
import { Modal } from '../ui/Modal'
import { FavoriteForm } from './FavoriteForm'
import { categoryLabel } from '../../lib/categoryTree'

interface FavoritesBarProps {
  /** Membuka form transaksi dengan isian dari favorit. */
  onOpenInForm: (draft: ResolvedAiDraft) => void
}

export function FavoritesBar({ onOpenInForm }: FavoritesBarProps) {
  const favorites = useFavorites()
  const accounts = useAllAccounts()
  const categories = useAllCategories()
  const { toast } = useToast()

  const [busyId, setBusyId] = useState<string | null>(null)
  const [manageOpen, setManageOpen] = useState(false)
  const [editing, setEditing] = useState<Favorite | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Favorite | null>(null)

  const accountMap = useMemo(() => new Map(accounts.map((item) => [item.id, item])), [accounts])
  const categoryMap = useMemo(() => new Map(categories.map((item) => [item.id, item])), [categories])
  const labelFor = (id: string): string | undefined => {
    const category = categoryMap.get(id)
    return category ? categoryLabel(category, categories) : undefined
  }

  function issueFor(favorite: Favorite): string | null {
    return favoriteIssue(
      favorite,
      accountMap.get(favorite.accountId),
      categoryMap.get(favorite.categoryId),
    )
  }

  async function handleUse(favorite: Favorite) {
    if (busyId) return
    const issue = issueFor(favorite)
    if (issue) {
      toast(issue, 'error')
      return
    }
    setBusyId(favorite.id)
    try {
      const transaction = await useFavorite(favorite.id)
      toast(`"${favorite.name}" dicatat: ${formatRupiah(favorite.amount)}.`, 'success', {
        action: {
          label: 'Urungkan',
          onClick: () => {
            void undoFavoriteUse(favorite.id, transaction.id)
              .then(() => toast('Transaksi dibatalkan.', 'info'))
              .catch((caught) => toast(errorMessage(caught), 'error'))
          },
        },
      })
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setBusyId(null)
    }
  }

  function openInForm(favorite: Favorite) {
    const issue = issueFor(favorite)
    if (issue) {
      toast(issue, 'error')
      return
    }
    setManageOpen(false)
    onOpenInForm({
      type: favorite.type,
      amount: favorite.amount,
      accountId: favorite.accountId,
      categoryId: favorite.categoryId,
      occurredAt: todayISO(),
      note: favorite.note || favorite.name,
    })
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteFavorite(deleting.id)
      toast('Favorit dihapus.')
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setDeleting(null)
    }
  }

  function closeManage() {
    setManageOpen(false)
    setEditing(null)
  }

  return (
    <section aria-label="Transaksi favorit">
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <Star className="h-3.5 w-3.5" />
          Favorit
        </h3>
        <button
          type="button"
          onClick={() => setManageOpen(true)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Kelola
        </button>
      </div>

      {favorites.length === 0 ? (
        <button
          type="button"
          onClick={() => {
            setManageOpen(true)
            setEditing('new')
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-3 text-xs font-medium text-slate-500 transition hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-400"
        >
          <Plus className="h-4 w-4" />
          Simpan transaksi yang sering dipakai (kopi, bensin, parkir) agar bisa dicatat satu ketuk
        </button>
      ) : (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {favorites.map((favorite) => {
            const issue = issueFor(favorite)
            const category = categoryMap.get(favorite.categoryId)
            return (
              <button
                key={favorite.id}
                type="button"
                onClick={() => void handleUse(favorite)}
                disabled={busyId === favorite.id}
                title={issue ?? `Catat ${favorite.name} hari ini`}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-xl border bg-white py-1.5 pl-1.5 pr-3 text-left shadow-sm transition active:scale-95 disabled:opacity-60 dark:bg-slate-900',
                  issue
                    ? 'border-amber-300 dark:border-amber-800'
                    : 'border-slate-200 hover:border-emerald-400 dark:border-slate-700',
                )}
              >
                <EntityIcon
                  icon={category?.icon}
                  fallback={defaultCategoryIconKey(category?.name ?? favorite.name, favorite.type)}
                  color={category?.color ?? '#64748b'}
                  size="sm"
                />
                <span className="min-w-0">
                  <span className="block max-w-[9rem] truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {favorite.name}
                  </span>
                  <span
                    className={cn(
                      'block text-[11px] font-medium',
                      favorite.type === 'income'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-500 dark:text-slate-400',
                    )}
                  >
                    {favorite.type === 'income' ? '+' : ''}
                    {formatRupiah(favorite.amount)}
                  </span>
                </span>
                {issue && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />}
              </button>
            )
          })}
        </div>
      )}

      <Modal
        open={manageOpen}
        onClose={closeManage}
        title={
          editing === 'new' ? 'Tambah favorit' : editing ? 'Ubah favorit' : 'Kelola favorit'
        }
        description={
          editing
            ? undefined
            : 'Ketuk favorit di halaman Transaksi untuk langsung mencatatnya hari ini.'
        }
      >
        {editing ? (
          <FavoriteForm
            favorite={editing === 'new' ? null : editing}
            onSaved={() => {
              toast(editing === 'new' ? 'Favorit disimpan.' : 'Favorit diperbarui.')
              setEditing(null)
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div className="space-y-3">
            {favorites.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                Belum ada favorit.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                {favorites.map((favorite) => {
                  const issue = issueFor(favorite)
                  return (
                    <div key={favorite.id} className="space-y-1 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {favorite.name}
                            </p>
                            <Badge variant={favorite.type === 'income' ? 'income' : 'expense'}>
                              {favorite.type === 'income' ? 'Masuk' : 'Keluar'}
                            </Badge>
                          </div>
                          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {formatRupiah(favorite.amount)} ·{' '}
                            {labelFor(favorite.categoryId) ?? 'Kategori hilang'} ·{' '}
                            {accountMap.get(favorite.accountId)?.name ?? 'Rekening hilang'} · dipakai{' '}
                            {favorite.useCount}x
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-0.5">
                          <button
                            type="button"
                            onClick={() => openInForm(favorite)}
                            aria-label="Buka di form transaksi"
                            title="Isi form (ubah dulu sebelum simpan)"
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          >
                            <ClipboardPenLine className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(favorite)}
                            aria-label="Ubah favorit"
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(favorite)}
                            aria-label="Hapus favorit"
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {issue && (
                        <p className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          {issue}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <Button className="w-full" onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" />
              Tambah favorit
            </Button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Hapus favorit?"
        message={`Favorit "${deleting?.name ?? ''}" dihapus. Transaksi yang sudah dicatat dari favorit ini tidak terpengaruh.`}
        confirmLabel="Hapus"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </section>
  )
}
