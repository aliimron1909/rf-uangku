import { useMemo, useState } from 'react'
import { Calculator, Repeat, Save, Trash2 } from 'lucide-react'
import { useAccounts } from '../../hooks/useAccounts'
import { useCategories } from '../../hooks/useCategories'
import { useKprSimulations } from '../../hooks/useKpr'
import { createKprRecurring, deleteKprSimulation, saveKprSimulation } from '../../db/kpr'
import {
  buildSchedule,
  loanAmount,
  monthDate,
  parseDecimal,
  summarize,
  totalMonths,
  yearlyBreakdown,
  type KprInput,
} from '../../lib/kpr'
import { categoryLabel, selectableCategories } from '../../lib/categoryTree'
import { formatDate, todayISO } from '../../lib/dates'
import { formatNumberInput, formatPercent, formatRupiah, parseNumberInput } from '../../lib/format'
import { errorMessage } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'
import type { KprSimulation } from '../../types'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { CurrencyInput } from '../ui/CurrencyInput'
import { EmptyState } from '../ui/EmptyState'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { KprChart } from './KprChart'

const DEFAULT_CATEGORY_ID = 'cat-s-exp-hunian-sewa'

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'rose' | 'emerald' }) {
  const color =
    tone === 'rose'
      ? 'text-rose-600 dark:text-rose-400'
      : tone === 'emerald'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-slate-900 dark:text-slate-100'
  return (
    <div className="rounded-2xl glass p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={`mt-1 text-base font-extrabold tabular-nums sm:text-lg ${color}`}>{value}</p>
    </div>
  )
}

export function KprSection() {
  const { toast } = useToast()
  const saved = useKprSimulations()
  const accounts = useAccounts()
  const categories = useCategories()
  const expenseCategories = useMemo(
    () => selectableCategories(categories).filter((category) => category.type === 'expense'),
    [categories],
  )

  const [name, setName] = useState('Simulasi KPR')
  const [price, setPrice] = useState('500.000.000')
  const [dpMode, setDpMode] = useState<'percent' | 'rupiah'>('percent')
  const [dpValue, setDpValue] = useState('20')
  const [dpRupiah, setDpRupiah] = useState('')
  const [years, setYears] = useState('20')
  const [fixedRate, setFixedRate] = useState('5')
  const [fixedYears, setFixedYears] = useState('5')
  const [floatingRate, setFloatingRate] = useState('10')
  const [startMonth, setStartMonth] = useState(todayISO().slice(0, 7))
  const [editingId, setEditingId] = useState<string | undefined>()
  const [showAll, setShowAll] = useState(false)
  const [deleting, setDeleting] = useState<KprSimulation | null>(null)
  const [recurringOpen, setRecurringOpen] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [firstDate, setFirstDate] = useState('')
  const [busy, setBusy] = useState(false)

  const priceNumber = parseNumberInput(price)
  const downPayment =
    dpMode === 'percent'
      ? Math.min(priceNumber, Math.round((priceNumber * Math.min(100, parseDecimal(dpValue))) / 100))
      : Math.min(priceNumber, parseNumberInput(dpRupiah))
  const input: KprInput = {
    price: priceNumber,
    downPayment,
    years: Math.max(0, Math.min(40, Math.round(parseDecimal(years)))),
    fixedRate: parseDecimal(fixedRate),
    fixedYears: Math.max(0, Math.round(parseDecimal(fixedYears))),
    floatingRate: parseDecimal(floatingRate),
  }
  const valid = loanAmount(input) > 0 && input.years > 0
  const rows = useMemo(() => (valid ? buildSchedule(input) : []), [valid, input.price, input.downPayment, input.years, input.fixedRate, input.fixedYears, input.floatingRate]) // eslint-disable-line react-hooks/exhaustive-deps
  const summary = useMemo(() => (valid ? summarize(input, rows) : null), [valid, rows]) // eslint-disable-line react-hooks/exhaustive-deps
  const yearly = useMemo(() => yearlyBreakdown(rows), [rows])
  const shownRows = showAll ? rows : rows.slice(0, 24)
  const hasFloating = summary ? summary.fixedMonths < summary.months : false

  function load(item: KprSimulation) {
    setEditingId(item.id)
    setName(item.name)
    setPrice(formatNumberInput(String(item.price)))
    setDpMode('rupiah')
    setDpRupiah(formatNumberInput(String(item.downPayment)))
    setYears(String(item.years))
    setFixedRate(String(item.fixedRate).replace('.', ','))
    setFixedYears(String(item.fixedYears))
    setFloatingRate(String(item.floatingRate).replace('.', ','))
    setStartMonth(item.startMonth)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save(asNew: boolean) {
    if (!valid) return
    try {
      const row = await saveKprSimulation({ ...input, name, startMonth }, asNew ? undefined : editingId)
      setEditingId(row.id)
      toast('Simulasi disimpan.')
    } catch (error) {
      toast(errorMessage(error), 'error')
    }
  }

  function openRecurring() {
    const first = monthDate(startMonth, 1).slice(0, 8) + '01'
    setFirstDate(first)
    setAccountId((current) => current || accounts[0]?.id || '')
    setCategoryId(
      (current) =>
        current ||
        (expenseCategories.some((c) => c.id === DEFAULT_CATEGORY_ID)
          ? DEFAULT_CATEGORY_ID
          : (expenseCategories[0]?.id ?? '')),
    )
    setRecurringOpen(true)
  }

  const dateInPast = firstDate !== '' && firstDate < todayISO()

  async function submitRecurring() {
    if (!accountId || !categoryId || !firstDate || dateInPast) return
    setBusy(true)
    try {
      const count = await createKprRecurring({ input, firstDate, accountId, categoryId })
      toast(`${count} tagihan berulang dibuat. Lihat di tab Berulang.`)
      setRecurringOpen(false)
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl glass p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-bold text-slate-900 dark:text-slate-100">Simulasi KPR</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Nama simulasi" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          <CurrencyInput label="Harga rumah" value={price} onChange={setPrice} />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Uang muka (DP)</span>
              <button
                type="button"
                onClick={() => setDpMode(dpMode === 'percent' ? 'rupiah' : 'percent')}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
              >
                {dpMode === 'percent' ? 'Ganti ke Rp' : 'Ganti ke %'}
              </button>
            </div>
            {dpMode === 'percent' ? (
              <Input
                inputMode="decimal"
                value={dpValue}
                onChange={(e) => setDpValue(e.target.value)}
                hint={`= ${formatRupiah(downPayment)}`}
              />
            ) : (
              <CurrencyInput label="" value={dpRupiah} onChange={setDpRupiah} />
            )}
          </div>
          <Input
            label="Lama cicilan (tahun)"
            inputMode="numeric"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            hint={`Pokok pinjaman ${formatRupiah(loanAmount(input))}`}
          />
          <Input label="Bunga fixed (% / tahun)" inputMode="decimal" value={fixedRate} onChange={(e) => setFixedRate(e.target.value)} />
          <Input label="Lama masa fixed (tahun)" inputMode="numeric" value={fixedYears} onChange={(e) => setFixedYears(e.target.value)} />
          <Input label="Bunga floating (% / tahun)" inputMode="decimal" value={floatingRate} onChange={(e) => setFloatingRate(e.target.value)} />
          <Input label="Bulan mulai cicilan" type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
        </div>
      </section>

      {summary ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Cicilan masa fixed" value={formatRupiah(summary.paymentFixed)} tone="emerald" />
            <Stat
              label="Cicilan masa floating"
              value={hasFloating ? formatRupiah(summary.paymentFloating) : '-'}
              tone="rose"
            />
            <Stat label="Total pokok" value={formatRupiah(summary.totalPrincipal)} />
            <Stat label="Total bunga" value={formatRupiah(summary.totalInterest)} tone="rose" />
            <Stat label="Total bayar" value={formatRupiah(summary.totalPaid)} />
            <Stat
              label="Bunga / pinjaman"
              value={formatPercent(summary.loan > 0 ? (summary.totalInterest / summary.loan) * 100 : 0)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {editingId && (
              <Button variant="secondary" onClick={() => save(false)}>
                <Save className="h-4 w-4" /> Perbarui
              </Button>
            )}
            <Button variant={editingId ? 'ghost' : 'primary'} onClick={() => save(true)}>
              <Save className="h-4 w-4" /> {editingId ? 'Simpan sebagai baru' : 'Simpan simulasi'}
            </Button>
            <Button variant="secondary" onClick={openRecurring}>
              <Repeat className="h-4 w-4" /> Jadikan tagihan berulang
            </Button>
          </div>

          <section className="rounded-3xl glass p-4 sm:p-5">
            <h3 className="mb-3 font-bold text-slate-900 dark:text-slate-100">Pokok dan bunga per tahun</h3>
            <KprChart data={yearly} />
          </section>

          <section className="rounded-3xl glass p-4 sm:p-5">
            <h3 className="mb-3 font-bold text-slate-900 dark:text-slate-100">
              Jadwal cicilan ({totalMonths(input)} bulan)
            </h3>
            <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[520px] text-right text-xs tabular-nums">
                <thead className="sticky top-0 bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  <tr>
                    <th className="px-2 py-2 text-left">Bulan</th>
                    <th className="px-2 py-2">Cicilan</th>
                    <th className="px-2 py-2">Pokok</th>
                    <th className="px-2 py-2">Bunga</th>
                    <th className="px-2 py-2">Sisa pokok</th>
                  </tr>
                </thead>
                <tbody>
                  {shownRows.map((row) => (
                    <tr key={row.month} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-2 py-1.5 text-left">
                        {row.month}
                        <span className="ml-1 text-[10px] text-slate-400">
                          {formatDate(monthDate(startMonth, row.month), 'MMM yy')}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">{formatRupiah(row.payment)}</td>
                      <td className="px-2 py-1.5 text-emerald-600 dark:text-emerald-400">{formatRupiah(row.principal)}</td>
                      <td className="px-2 py-1.5 text-rose-600 dark:text-rose-400">{formatRupiah(row.interest)}</td>
                      <td className="px-2 py-1.5">{formatRupiah(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 24 && (
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className="mt-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400"
              >
                {showAll ? 'Tampilkan 24 bulan pertama' : `Tampilkan semua ${rows.length} bulan`}
              </button>
            )}
          </section>
        </>
      ) : (
        <EmptyState
          title="Isi harga rumah dan lama cicilan"
          description="Hasil simulasi akan tampil di sini."
          icon={<Calculator className="h-6 w-6" />}
        />
      )}

      <section className="rounded-3xl glass p-4 sm:p-5">
        <h3 className="mb-3 font-bold text-slate-900 dark:text-slate-100">Simulasi tersimpan</h3>
        {saved.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada simulasi tersimpan.</p>
        ) : (
          <ul className="space-y-2">
            {saved.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 p-3 dark:border-slate-800"
              >
                <button type="button" onClick={() => load(item)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatRupiah(item.price)} · {item.years} th · {formatPercent(item.fixedRate)} fixed {item.fixedYears} th
                  </p>
                </button>
                <button
                  type="button"
                  aria-label="Hapus simulasi"
                  onClick={() => setDeleting(item)}
                  className="rounded-lg p-2 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={recurringOpen}
        onClose={() => setRecurringOpen(false)}
        title="Jadikan tagihan berulang"
        description={
          hasFloating
            ? 'Dibuat 2 aturan bulanan: masa fixed dan masa floating (nominal berbeda).'
            : 'Dibuat 1 aturan bulanan selama masa cicilan.'
        }
        footer={
          <Button
            loading={busy}
            disabled={!accountId || !categoryId || !firstDate || dateInPast}
            onClick={submitRecurring}
          >
            Buat tagihan
          </Button>
        }
      >
        <div className="space-y-3">
          <Input
            label="Tanggal cicilan pertama"
            type="date"
            value={firstDate}
            min={todayISO()}
            onChange={(e) => setFirstDate(e.target.value)}
            error={dateInPast ? 'Pilih tanggal hari ini atau setelahnya.' : undefined}
          />
          <Select label="Akun pembayaran" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
          <Select label="Kategori" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {expenseCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {categoryLabel(category, categories)}
              </option>
            ))}
          </Select>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Hapus simulasi?"
        message={`"${deleting?.name ?? ''}" akan dihapus.`}
        confirmLabel="Hapus"
        danger
        onConfirm={async () => {
          if (deleting) await deleteKprSimulation(deleting.id)
          if (deleting?.id === editingId) setEditingId(undefined)
          setDeleting(null)
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
