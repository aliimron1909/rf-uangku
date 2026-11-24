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
  /** Kunci ikon (lihat lib/icons); kosong = ikon bawaan. */
  icon?: string
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
  /** Kunci ikon (lihat lib/icons); kosong = ikon bawaan. */
  icon?: string
  color: string
  /** Id kategori induk (grup). Kosong = kategori tingkat atas. Transaksi disimpan pada subkategori. */
  parentId?: string
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
  /** Label bebas (huruf kecil, tanpa spasi), mis. "liburan-bali". */
  tags?: string[]
  /** Transaksi dengan ID grup sama berasal dari satu struk yang dipecah ke beberapa kategori. */
  splitGroupId?: string
  /** Foto struk (tabel receipts); dipakai bersama oleh semua bagian split. */
  receiptId?: string
  createdAt: string
  updatedAt: string
}

/** Status sinkronisasi satu record: `table|id`. Tidak ikut backup. */
export interface SyncStateRow {
  key: string
  hash: string
  /** Waktu versi (ms) yang dipakai untuk menyelesaikan konflik; terbaru menang. */
  ts: number
  pushed: boolean
  deleted: boolean
}

/** Transaksi yang dihapus, disimpan sementara agar bisa dipulihkan (satu item = satu transaksi atau satu struk split). */
export interface TrashItem {
  id: string
  transactions: Transaction[]
  receipt?: Receipt
  deletedAt: string
}

export interface Receipt {
  id: string
  /** Gambar terkompres sebagai data URL (JPEG/WebP). */
  dataUrl: string
  createdAt: string
}

export interface TransactionWithRefs extends Transaction {
  accountName: string
  categoryName: string
  categoryColor: string
  categoryIcon?: string
}

export interface Favorite {
  id: string
  name: string
  type: TxType
  amount: number
  accountId: string
  categoryId: string
  note?: string
  /** Berapa kali dipakai; menentukan urutan (yang sering dipakai di depan). */
  useCount: number
  lastUsedAt?: string
  createdAt: string
  updatedAt: string
}

/** Simulasi cicilan KPR yang disimpan (rumus ada di lib/kpr.ts). */
export interface KprSimulation {
  id: string
  name: string
  price: number
  downPayment: number
  years: number
  fixedRate: number
  fixedYears: number
  floatingRate: number
  /** Bulan cicilan pertama, 'YYYY-MM'. */
  startMonth: string
  createdAt: string
  updatedAt: string
}

export interface Transfer {
  id: string
  fromAccountId: string
  toAccountId: string
  amount: number
  /** Biaya admin (mis. top up e-wallet) yang dipotong dari rekening asal; dicatat sebagai pengeluaran. */
  fee?: number
  /** Transaksi pengeluaran biaya admin yang menyertai transfer ini. */
  feeTransactionId?: string
  /** Aturan transfer berulang yang membuatnya. */
  recurringId?: string
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
  /** Rekening sumber (setor) atau tujuan (ambil); kosong = hanya catatan, saldo tidak berubah. */
  accountId?: string
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
  /** Jika terisi, aturan ini adalah transfer dari accountId ke toAccountId (type/categoryId diabaikan). */
  toAccountId?: string
  /** Biaya admin per transfer berulang. */
  fee?: number
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
  categoryIcon?: string
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
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
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
  favorites?: Favorite[]
  receipts?: Receipt[]
  kprSimulations?: KprSimulation[]
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

/** Transfer antar rekening hasil pemahaman AI (nama rekening belum dicocokkan). */
export interface AiTransferDraft {
  amount: number
  fromAccountName: string
  toAccountName: string
  occurredAt: string
  note: string
  /** Biaya admin bila disebut (mis. "admin 1.500"). */
  fee?: number
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
