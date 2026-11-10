import { useMemo, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  Landmark,
  Pencil,
  Plus,
  Tags,
  Trash2,
} from 'lucide-react'
import type { Account, AccountKind, Category, TxType } from '../../types'
import { db } from '../../db/db'
import { useAllAccounts } from '../../hooks/useAccounts'
import { useAllCategories } from '../../hooks/useCategories'
import { useToast } from '../../contexts/ToastContext'
import { createId, cn, errorMessage } from '../../lib/utils'
import { formatNumberInput, formatRupiah, parseNumberInput } from '../../lib/format'
import { Button } from '../ui/Button'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Modal } from '../ui/Modal'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Badge } from '../ui/Badge'

const COLOR_PALETTE = [
  '#10b981',
  '#0ea5e9',
  '#2563eb',
  '#8b5cf6',
  '#f59e0b',
  '#f97316',
  '#f43f5e',
  '#ef4444',
  '#06b6d4',
  '#64748b',
]

const kindLabels: Record<AccountKind, string> = {
  cash: 'Tunai',
  bank: 'Bank',
  ewallet: 'E-wallet',
}

type Tab = 'accounts' | 'categories'

export function MasterDataSection() {
  const accounts = useAllAccounts()
  const categories = useAllCategories()
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('accounts')

  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [accountName, setAccountName] = useState('')
  const [accountKind, setAccountKind] = useState<AccountKind>('bank')
  const [openingBalance, setOpeningBalance] = useState('')
  const [accountColor, setAccountColor] = useState(COLOR_PALETTE[0])
  const [accountError, setAccountError] = useState('')
  const [accountSaving, setAccountSaving] = useState(false)

  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryName, setCategoryName] = useState('')
  const [categoryType, setCategoryType] = useState<TxType>('expense')
  const [categoryColor, setCategoryColor] = useState(COLOR_PALETTE[0])
  const [categoryError, setCategoryError] = useState('')
  const [categorySaving, setCategorySaving] = useState(false)
  const [categoryUsage, setCategoryUsage] = useState(0)

  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const sortedAccounts = useMemo(
    () =>
      [...accounts].sort(
        (a, b) => Number(a.archived) - Number(b.archived) || a.sortOrder - b.sortOrder,
      ),
    [accounts],
  )
  const sortedCategories = useMemo(
    () =>
      [...categories].sort(
        (a, b) =>
          Number(a.archived) - Number(b.archived) ||
          a.type.localeCompare(b.type) ||
          a.sortOrder - b.sortOrder,
      ),
    [categories],
  )

  const activeAccounts = accounts.filter((account) => !account.archived)

  function openAccountModal(account?: Account) {
    setEditingAccount(account ?? null)
    setAccountName(account?.name ?? '')
    setAccountKind(account?.kind ?? 'bank')
    setOpeningBalance(account ? formatNumberInput(String(account.openingBalance)) : '')
    setAccountColor(account?.color ?? COLOR_PALETTE[0])
    setAccountError('')
    setAccountModalOpen(true)
  }

  async function openCategoryModal(category?: Category) {
    setEditingCategory(category ?? null)
    setCategoryName(category?.name ?? '')
    setCategoryType(category?.type ?? 'expense')
    setCategoryColor(category?.color ?? COLOR_PALETTE[0])
    setCategoryError('')
    if (!category) {
      setCategoryUsage(0)
      setCategoryModalOpen(true)
      return
    }
    try {
      const usage = await db.transactions.where('categoryId').equals(category.id).count()
      setCategoryUsage(usage)
      setCategoryModalOpen(true)
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    }
  }

  async function saveAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = accountName.trim()
    if (!name) {
      setAccountError('Nama rekening wajib diisi.')
      return
    }
    const duplicate = accounts.some(
      (account) =>
        account.id !== editingAccount?.id && account.name.toLowerCase() === name.toLowerCase(),
    )
    if (duplicate) {
      setAccountError('Nama rekening sudah ada.')
      return
    }
    setAccountSaving(true)
    try {
      if (editingAccount) {
        await db.accounts.update(editingAccount.id, {
          name,
          kind: accountKind,
          openingBalance: parseNumberInput(openingBalance),
          color: accountColor,
        })
        toast('Rekening berhasil diperbarui.')
      } else {
        const maxOrder = accounts.reduce((max, account) => Math.max(max, account.sortOrder), 0)
        await db.accounts.add({
          id: createId(),
          name,
          kind: accountKind,
          openingBalance: parseNumberInput(openingBalance),
          color: accountColor,
          sortOrder: maxOrder + 1,
          archived: false,
          createdAt: new Date().toISOString(),
        })
        toast('Rekening baru berhasil ditambahkan.')
      }
      setAccountModalOpen(false)
    } catch (caught) {
      setAccountError(errorMessage(caught))
    } finally {
      setAccountSaving(false)
    }
  }

  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = categoryName.trim()
    if (!name) {
      setCategoryError('Nama kategori wajib diisi.')
      return
    }
    const duplicate = categories.some(
      (category) =>
        category.id !== editingCategory?.id &&
        category.type === categoryType &&
        category.name.toLowerCase() === name.toLowerCase(),
    )
    if (duplicate) {
      setCategoryError('Nama kategori sudah ada untuk jenis ini.')
      return
    }
    if (editingCategory && categoryUsage > 0 && categoryType !== editingCategory.type) {
      setCategoryError('Jenis kategori tidak bisa diubah karena sudah dipakai transaksi.')
      return
    }
    setCategorySaving(true)
    try {
      if (editingCategory) {
        const typeChanged = categoryType !== editingCategory.type
        await db.transaction('rw', db.categories, db.budgets, db.recurringTransactions, async () => {
          await db.categories.update(editingCategory.id, {
            name,
            type: categoryType,
            color: categoryColor,
          })
          if (typeChanged) {
            await db.budgets.where('categoryId').equals(editingCategory.id).delete()
            await db.recurringTransactions
              .where('categoryId')
              .equals(editingCategory.id)
              .modify({ active: false, updatedAt: new Date().toISOString() })
          }
        })
        toast(
          typeChanged
            ? 'Kategori diperbarui. Budget dihapus dan aturan berulang dijeda karena jenis berubah.'
            : 'Kategori berhasil diperbarui.',
        )
      } else {
        const maxOrder = categories
          .filter((category) => category.type === categoryType)
          .reduce((max, category) => Math.max(max, category.sortOrder), 0)
        await db.categories.add({
          id: createId(),
          name,
          type: categoryType,
          color: categoryColor,
          sortOrder: maxOrder + 1,
          archived: false,
          createdAt: new Date().toISOString(),
        })
        toast('Kategori baru berhasil ditambahkan.')
      }
      setCategoryModalOpen(false)
    } catch (caught) {
      setCategoryError(errorMessage(caught))
    } finally {
      setCategorySaving(false)
    }
  }

  async function toggleArchiveAccount(account: Account) {
    if (!account.archived && activeAccounts.length <= 1) {
      toast('Minimal harus ada satu rekening aktif.', 'error')
      return
    }
    try {
      const nextArchived = !account.archived
      await db.accounts.update(account.id, { archived: nextArchived })
      if (nextArchived) {
        const paused = await db.recurringTransactions
          .where('accountId')
          .equals(account.id)
          .and((rule) => rule.active)
          .modify({ active: false, updatedAt: new Date().toISOString() })
        toast(
          paused > 0
            ? `Rekening diarsipkan. ${paused} aturan berulang dijeda.`
            : 'Rekening diarsipkan.',
        )
      } else {
        toast('Rekening diaktifkan kembali. Aturan berulang yang dijeda perlu diaktifkan manual.')
      }
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    }
  }

  async function toggleArchiveCategory(category: Category) {
    const activeSameType = categories.filter(
      (item) => !item.archived && item.type === category.type && item.id !== category.id,
    ).length
    if (!category.archived && activeSameType === 0) {
      toast(`Minimal harus ada satu kategori ${category.type === 'income' ? 'pemasukan' : 'pengeluaran'} aktif.`, 'error')
      return
    }
    try {
      const nextArchived = !category.archived
      await db.categories.update(category.id, { archived: nextArchived })
      if (nextArchived) {
        const paused = await db.recurringTransactions
          .where('categoryId')
          .equals(category.id)
          .and((rule) => rule.active)
          .modify({ active: false, updatedAt: new Date().toISOString() })
        toast(
          paused > 0
            ? `Kategori diarsipkan. ${paused} aturan berulang dijeda.`
            : 'Kategori diarsipkan.',
        )
      } else {
        toast('Kategori diaktifkan kembali. Aturan berulang yang dijeda perlu diaktifkan manual.')
      }
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    }
  }

  async function handleDeleteAccount() {
    if (!deletingAccount) return
    if (!deletingAccount.archived && activeAccounts.length <= 1) {
      toast('Minimal harus ada satu rekening aktif.', 'error')
      setDeletingAccount(null)
      return
    }
    setDeleteLoading(true)
    try {
      const used = await db.transactions.where('accountId').equals(deletingAccount.id).count()
      if (used > 0) {
        toast('Rekening masih dipakai transaksi. Arsipkan saja agar riwayat tetap aman.', 'error')
        setDeletingAccount(null)
        return
      }
      const usedByRecurring = await db.recurringTransactions
        .where('accountId')
        .equals(deletingAccount.id)
        .count()
      if (usedByRecurring > 0) {
        toast('Rekening masih dipakai aturan berulang. Hapus atau ubah aturan itu dulu.', 'error')
        setDeletingAccount(null)
        return
      }
      await db.accounts.delete(deletingAccount.id)
      toast('Rekening berhasil dihapus.')
      setDeletingAccount(null)
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleDeleteCategory() {
    if (!deletingCategory) return
    const activeSameType = categories.filter(
      (item) => !item.archived && item.type === deletingCategory.type && item.id !== deletingCategory.id,
    ).length
    if (!deletingCategory.archived && activeSameType === 0) {
      toast(
        `Minimal harus ada satu kategori ${
          deletingCategory.type === 'income' ? 'pemasukan' : 'pengeluaran'
        } aktif.`,
        'error',
      )
      setDeletingCategory(null)
      return
    }
    setDeleteLoading(true)
    try {
      const used = await db.transactions.where('categoryId').equals(deletingCategory.id).count()
      if (used > 0) {
        toast('Kategori masih dipakai transaksi. Arsipkan saja agar riwayat tetap aman.', 'error')
        setDeletingCategory(null)
        return
      }
      const usedByRecurring = await db.recurringTransactions
        .where('categoryId')
        .equals(deletingCategory.id)
        .count()
      if (usedByRecurring > 0) {
        toast('Kategori masih dipakai aturan berulang. Hapus atau ubah aturan itu dulu.', 'error')
        setDeletingCategory(null)
        return
      }
      await db.transaction('rw', db.categories, db.budgets, async () => {
        await db.budgets.where('categoryId').equals(deletingCategory.id).delete()
        await db.categories.delete(deletingCategory.id)
      })
      toast('Kategori berhasil dihapus.')
      setDeletingCategory(null)
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300">
          <Landmark className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Rekening & Kategori
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Kelola master data. Data yang diarsipkan tidak muncul di form transaksi, tetapi riwayat
            lama tetap aman.
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setTab('accounts')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition',
              tab === 'accounts'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            <Landmark className="h-3.5 w-3.5" />
            Rekening ({accounts.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('categories')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition',
              tab === 'categories'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            <Tags className="h-3.5 w-3.5" />
            Kategori ({categories.length})
          </button>
        </div>

        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            onClick={() => (tab === 'accounts' ? openAccountModal() : void openCategoryModal())}
          >
            <Plus className="h-3.5 w-3.5" />
            {tab === 'accounts' ? 'Tambah rekening' : 'Tambah kategori'}
          </Button>
        </div>

        {tab === 'accounts' ? (
          <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
            {sortedAccounts.map((account) => (
              <div key={account.id} className="flex items-center gap-3 bg-white px-3 py-2.5 dark:bg-slate-900">
                <span
                  className="h-9 w-9 shrink-0 rounded-xl"
                  style={{ backgroundColor: account.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {account.name}
                    </p>
                    {account.archived && <Badge variant="warning">Diarsipkan</Badge>}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {kindLabels[account.kind]} · Saldo awal {formatRupiah(account.openingBalance)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    onClick={() => void toggleArchiveAccount(account)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label={account.archived ? 'Aktifkan rekening' : 'Arsipkan rekening'}
                    title={account.archived ? 'Aktifkan' : 'Arsipkan'}
                  >
                    {account.archived ? (
                      <ArchiveRestore className="h-4 w-4" />
                    ) : (
                      <Archive className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => openAccountModal(account)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label="Edit rekening"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingAccount(account)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                    aria-label="Hapus rekening"
                    title="Hapus"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
            {sortedCategories.map((category) => (
              <div key={category.id} className="flex items-center gap-3 bg-white px-3 py-2.5 dark:bg-slate-900">
                <span
                  className="h-9 w-9 shrink-0 rounded-xl"
                  style={{ backgroundColor: category.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {category.name}
                    </p>
                    <Badge variant={category.type === 'income' ? 'income' : 'expense'}>
                      {category.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                    </Badge>
                    {category.archived && <Badge variant="warning">Diarsipkan</Badge>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    onClick={() => void toggleArchiveCategory(category)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label={category.archived ? 'Aktifkan kategori' : 'Arsipkan kategori'}
                    title={category.archived ? 'Aktifkan' : 'Arsipkan'}
                  >
                    {category.archived ? (
                      <ArchiveRestore className="h-4 w-4" />
                    ) : (
                      <Archive className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void openCategoryModal(category)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label="Edit kategori"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingCategory(category)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                    aria-label="Hapus kategori"
                    title="Hapus"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        title={editingAccount ? 'Edit Rekening' : 'Tambah Rekening'}
        size="sm"
      >
        <form onSubmit={saveAccount} className="space-y-3">
          <Input
            label="Nama rekening"
            value={accountName}
            onChange={(event) => setAccountName(event.target.value)}
            placeholder="Contoh: BCA"
            autoFocus
            error={accountError}
          />
          <Select
            label="Jenis rekening"
            value={accountKind}
            onChange={(event) => setAccountKind(event.target.value as AccountKind)}
          >
            <option value="cash">Tunai</option>
            <option value="bank">Bank</option>
            <option value="ewallet">E-wallet</option>
          </Select>
          <CurrencyInput
            label="Saldo awal"
            value={openingBalance}
            onChange={setOpeningBalance}
          />
          <ColorPicker
            label="Warna rekening"
            value={accountColor}
            onChange={setAccountColor}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setAccountModalOpen(false)} disabled={accountSaving}>
              Batal
            </Button>
            <Button type="submit" loading={accountSaving}>
              Simpan
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title={editingCategory ? 'Edit Kategori' : 'Tambah Kategori'}
        size="sm"
      >
        <form onSubmit={saveCategory} className="space-y-3">
          <Input
            label="Nama kategori"
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            placeholder="Contoh: Makan / Minum Harian"
            autoFocus
            error={categoryError}
          />
          <Select
            label="Jenis kategori"
            value={categoryType}
            onChange={(event) => setCategoryType(event.target.value as TxType)}
            disabled={Boolean(editingCategory && categoryUsage > 0)}
          >
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
          </Select>
          {editingCategory && categoryUsage > 0 && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Jenis kategori tidak bisa diubah karena sudah dipakai {categoryUsage} transaksi.
            </p>
          )}
          <ColorPicker
            label="Warna kategori"
            value={categoryColor}
            onChange={setCategoryColor}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setCategoryModalOpen(false)} disabled={categorySaving}>
              Batal
            </Button>
            <Button type="submit" loading={categorySaving}>
              Simpan
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingAccount)}
        title="Hapus rekening?"
        message={
          deletingAccount
            ? `Rekening "${deletingAccount.name}" akan dihapus. Rekening yang sudah punya transaksi tidak bisa dihapus; gunakan arsip.`
            : ''
        }
        confirmLabel="Hapus"
        danger
        loading={deleteLoading}
        onCancel={() => setDeletingAccount(null)}
        onConfirm={() => void handleDeleteAccount()}
      />

      <ConfirmDialog
        open={Boolean(deletingCategory)}
        title="Hapus kategori?"
        message={
          deletingCategory
            ? `Kategori "${deletingCategory.name}" akan dihapus. Kategori yang sudah punya transaksi tidak bisa dihapus; gunakan arsip.`
            : ''
        }
        confirmLabel="Hapus"
        danger
        loading={deleteLoading}
        onCancel={() => setDeletingCategory(null)}
        onConfirm={() => void handleDeleteCategory()}
      />
    </section>
  )
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        {COLOR_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              'h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-white transition dark:ring-offset-slate-900',
              value === color
                ? 'ring-slate-900 dark:ring-white'
                : 'ring-transparent hover:ring-slate-300 dark:hover:ring-slate-600',
            )}
            style={{ backgroundColor: color }}
            aria-label={`Pilih warna ${color}`}
          />
        ))}
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <input
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
            aria-label="Warna khusus"
          />
          Lainnya
        </label>
      </div>
    </div>
  )
}
