import type {
  Account,
  AccountWithBalance,
  Category,
  CategoryBreakdown,
  Transaction,
  TransactionWithRefs,
} from '../types'

export function computeTotals(transactions: Transaction[]): {
  income: number
  expense: number
  net: number
  count: number
} {
  let income = 0
  let expense = 0

  for (const transaction of transactions) {
    if (transaction.type === 'income') income += transaction.amount
    else expense += transaction.amount
  }

  return { income, expense, net: income - expense, count: transactions.length }
}

export function totalBalance(accounts: Account[], transactions: Transaction[]): number {
  const opening = accounts.reduce(
    (sum, account) => sum + (Number(account.openingBalance) || 0),
    0,
  )
  const net = transactions.reduce(
    (sum, transaction) =>
      sum + (transaction.type === 'income' ? transaction.amount : -transaction.amount),
    0,
  )
  return opening + net
}

export function accountBalance(account: Account, transactions: Transaction[]): number {
  return (
    (Number(account.openingBalance) || 0) +
    transactions.reduce(
      (sum, transaction) =>
        transaction.accountId === account.id
          ? sum + (transaction.type === 'income' ? transaction.amount : -transaction.amount)
          : sum,
      0,
    )
  )
}

export function accountsWithBalance(
  accounts: Account[],
  transactions: Transaction[],
): AccountWithBalance[] {
  return accounts.map((account) => ({
    ...account,
    balance: accountBalance(account, transactions),
  }))
}

export function categoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
): CategoryBreakdown[] {
  const expenses = transactions.filter((transaction) => transaction.type === 'expense')
  const total = expenses.reduce((sum, transaction) => sum + transaction.amount, 0)
  if (total <= 0) return []

  const totals = new Map<string, number>()
  for (const transaction of expenses) {
    totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0) + transaction.amount)
  }

  const rows = Array.from(totals.entries())
    .map(([id, value]) => {
      const category = categories.find((item) => item.id === id)
      return {
        id,
        name: category?.name ?? 'Tanpa kategori',
        color: category?.color ?? '#64748b',
        total: value,
        percentage: (value / total) * 100,
      }
    })
    .sort((a, b) => b.total - a.total)

  if (rows.length <= 6) return rows

  const top = rows.slice(0, 5)
  const rest = rows.slice(5)
  const restTotal = rest.reduce((sum, row) => sum + row.total, 0)
  top.push({
    id: 'other',
    name: 'Kategori lain',
    color: '#94a3b8',
    total: restTotal,
    percentage: (restTotal / total) * 100,
  })
  return top
}

export function withRefs(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
): TransactionWithRefs[] {
  const accountMap = new Map(accounts.map((account) => [account.id, account.name]))
  const categoryMap = new Map(categories.map((category) => [category.id, category]))

  return transactions.map((transaction) => {
    const category = categoryMap.get(transaction.categoryId)
    return {
      ...transaction,
      accountName: accountMap.get(transaction.accountId) ?? 'Rekening tidak ditemukan',
      categoryName: category?.name ?? 'Kategori tidak ditemukan',
      categoryColor: category?.color ?? '#64748b',
    }
  })
}

export function sortTransactions(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort(
    (a, b) =>
      b.occurredAt.localeCompare(a.occurredAt) || b.createdAt.localeCompare(a.createdAt),
  )
}
