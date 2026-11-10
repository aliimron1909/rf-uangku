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

export interface Budget {
  id: string
  categoryId: string
  amount: number
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
  version: 1 | 2
  exportedAt: string
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  budgets?: Budget[]
  recurringTransactions?: RecurringTransaction[]
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
