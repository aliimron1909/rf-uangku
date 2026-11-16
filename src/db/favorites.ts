import { db } from './db'
import { favoriteIssue, FAVORITE_NAME_MAX_LENGTH } from '../lib/favorites'
import { todayISO } from '../lib/dates'
import { createId } from '../lib/utils'
import type { Favorite, Transaction, TxType } from '../types'

export interface FavoriteInput {
  name: string
  type: TxType
  amount: number
  accountId: string
  categoryId: string
  note?: string
}

async function cleanFavorite(
  input: FavoriteInput,
): Promise<Omit<Favorite, 'id' | 'useCount' | 'lastUsedAt' | 'createdAt' | 'updatedAt'>> {
  const name = input.name.trim()
  if (!name) throw new Error('Nama favorit wajib diisi.')
  if (name.length > FAVORITE_NAME_MAX_LENGTH) {
    throw new Error(`Nama favorit maksimal ${FAVORITE_NAME_MAX_LENGTH} karakter.`)
  }
  if (input.type !== 'income' && input.type !== 'expense') {
    throw new Error('Jenis transaksi tidak valid.')
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Nominal harus lebih dari 0.')
  }
  const [account, category] = await Promise.all([
    db.accounts.get(input.accountId),
    db.categories.get(input.categoryId),
  ])
  if (!account) throw new Error('Rekening tidak ditemukan.')
  if (!category) throw new Error('Kategori tidak ditemukan.')
  if (category.type !== input.type) {
    throw new Error('Jenis kategori tidak sama dengan jenis transaksi.')
  }
  return {
    name,
    type: input.type,
    amount: input.amount,
    accountId: input.accountId,
    categoryId: input.categoryId,
    note: input.note?.trim() || '',
  }
}

export async function createFavorite(input: FavoriteInput): Promise<Favorite> {
  const clean = await cleanFavorite(input)
  const now = new Date().toISOString()
  const favorite: Favorite = {
    id: createId(),
    ...clean,
    useCount: 0,
    createdAt: now,
    updatedAt: now,
  }
  await db.favorites.add(favorite)
  return favorite
}

export async function updateFavorite(id: string, input: FavoriteInput): Promise<void> {
  const clean = await cleanFavorite(input)
  const updated = await db.favorites.update(id, { ...clean, updatedAt: new Date().toISOString() })
  if (updated === 0) throw new Error('Favorit tidak ditemukan.')
}

export async function deleteFavorite(id: string): Promise<void> {
  await db.favorites.delete(id)
}

/**
 * Mencatat transaksi dari favorit (default tanggal hari ini) dan menambah
 * hitungan pemakaian, dalam satu transaksi database.
 */
export async function useFavorite(
  id: string,
  occurredAt: string = todayISO(),
): Promise<Transaction> {
  return db.transaction('rw', db.favorites, db.transactions, db.accounts, db.categories, async () => {
    const favorite = await db.favorites.get(id)
    if (!favorite) throw new Error('Favorit tidak ditemukan.')
    const [account, category] = await Promise.all([
      db.accounts.get(favorite.accountId),
      db.categories.get(favorite.categoryId),
    ])
    const issue = favoriteIssue(favorite, account, category)
    if (issue) throw new Error(issue)

    const now = new Date().toISOString()
    const transaction: Transaction = {
      id: createId(),
      type: favorite.type,
      amount: favorite.amount,
      accountId: favorite.accountId,
      categoryId: favorite.categoryId,
      occurredAt,
      note: favorite.note || favorite.name,
      createdAt: now,
      updatedAt: now,
    }
    await db.transactions.add(transaction)
    await db.favorites.update(id, { useCount: favorite.useCount + 1, lastUsedAt: now })
    return transaction
  })
}

/** Membatalkan pemakaian favorit: menghapus transaksinya dan mengurangi hitungan. */
export async function undoFavoriteUse(favoriteId: string, transactionId: string): Promise<void> {
  await db.transaction('rw', db.favorites, db.transactions, async () => {
    await db.transactions.delete(transactionId)
    const favorite = await db.favorites.get(favoriteId)
    if (favorite) {
      await db.favorites.update(favoriteId, { useCount: Math.max(0, favorite.useCount - 1) })
    }
  })
}
