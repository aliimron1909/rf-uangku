export type TxType = 'income' | 'expense'
export type AccountKind = 'cash' | 'bank' | 'ewallet'
export type ThemeMode = 'light' | 'dark' | 'system'
export type Granularity = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type ReportPreset = 'today' | 'week' | 'month' | 'year' | 'custom'
export type ReportType = 'all' | TxType
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Account {
  id: string
  name: string
  kind: AccountKind
  openingBalance: number
  color: string
  sortOrder: number
  archived: boolean
  createdAt: string
}

export interface Category {
  id: string
  name: string
  type: TxType
  color: string
  sortOrder: number
  archived: boolean
  createdAt: string
}

export interface Transaction {
  id: string
  type: TxType
  amount: number
  accountId: string
  categoryId: string
  occurredAt: string
  note?: string
  recurringId?: string
  createdAt: string
  updatedAt: string
}

export interface TransactionWithRefs extends Transaction {
  accountName: string
  categoryName: string
  categoryColor: string
}

export interface Transfer {
  id: string
  fromAccountId: string
  toAccountId: string
  amount: number
  occurredAt: string
  note?: string
  createdAt: string
  updatedAt: string
}

export type GoalContributionKind = 'deposit' | 'withdrawal'

export interface Goal {
  id: string
  name: string
  targetAmount: number
  /** Tenggat opsional (YYYY-MM-DD). */
  deadline?: string
  color: string
  note?: string
  createdAt: string
  updatedAt: string
}

export interface GoalContribution {
  id: string
  goalId: string
  kind: GoalContributionKind
  amount: number
  occurredAt: string
  note?: string
  createdAt: string
}

/** owe = hutang saya ke orang lain; lent = piutang (orang lain berhutang ke saya). */
export type DebtDirection = 'owe' | 'lent'

export interface Debt {
  id: string
  direction: DebtDirection
  person: string
  amount: number
  /** Rekening tempat uang pinjaman masuk/keluar saat dicatat (opsional). */
  accountId?: string
  dueDate?: string
  note?: string
  createdAt: string
  updatedAt: string
}

export interface DebtPayment {
  id: string
  debtId: string
  amount: number
  /** Rekening yang dipakai membayar/menerima cicilan (opsional). */
  accountId?: string
  occurredAt: string
  note?: string
  createdAt: string
}

/** Perubahan saldo satu rekening yang bukan transaksi atau transfer (mis. hutang). */
export interface AccountFlow {
  accountId: string
  amount: number
}

export interface Budget {
  id: string
  categoryId: string
  amount: number
  /** Bulan mulai berlaku (YYYY-MM). Amount 0 = budget dihentikan mulai bulan ini. */
  effectiveFrom: string
  createdAt: string
  updatedAt: string
}

export interface RecurringTransaction {
  id: string
  type: TxType
  amount: number
  accountId: string
  categoryId: string
  note?: string
  frequency: RecurrenceFrequency
  interval: number
  startDate: string
  endDate?: string
  nextRunAt: string
  lastRunAt?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type BudgetStatus = 'safe' | 'warning' | 'over'

export interface BudgetProgress {
  budgetId: string
  categoryId: string
  categoryName: string
  categoryColor: string
  categoryArchived: boolean
  limit: number
  spent: number
  remaining: number
  percentage: number
  status: BudgetStatus
  effectiveFrom: string
}

export interface BudgetSummary {
  limit: number
  spent: number
  remaining: number
  percentage: number
  overCount: number
  warningCount: number
  unbudgetedSpent: number
}

export interface SettingRow {
  key: string
  value: unknown
}

export interface ProfileBackup {
  name: string
  photo?: string
}

export interface BackupData {
  app: 'rf-uangku'
  version: 1 | 2 | 3 | 4 | 5 | 6
  exportedAt: string
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  budgets?: Budget[]
  recurringTransactions?: RecurringTransaction[]
  transfers?: Transfer[]
  goals?: Goal[]
  goalContributions?: GoalContribution[]
  debts?: Debt[]
  debtPayments?: DebtPayment[]
  profile?: ProfileBackup
}

export interface AiDraft {
  type: TxType
  amount: number
  categoryName: string
  accountName: string
  occurredAt: string
  note: string
}

export interface TrendPoint {
  key: string
  label: string
  income: number
  expense: number
  net: number
}

export interface CategoryBreakdown {
  id: string
  name: string
  color: string
  total: number
  percentage: number
}

export interface AccountWithBalance extends Account {
  balance: number
}
