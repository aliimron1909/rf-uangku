import { ArrowDownLeft, ArrowUpRight, Scale, Wallet } from 'lucide-react'
import { formatRupiah } from '../../lib/format'

interface SummaryCardsProps {
  balance: number
  income: number
  expense: number
  net: number
  monthLabel: string
  /** Jumlah rekening arsip yang tidak ikut dihitung. */
  archivedCount?: number
}

/** Ringkasan satu kartu: saldo total besar, lalu pemasukan/pengeluaran/selisih bulan ini. */
export function SummaryCards({
  balance,
  income,
  expense,
  net,
  monthLabel,
  archivedCount = 0,
}: SummaryCardsProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-4 text-white shadow-sm sm:p-5">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-8 -left-4 h-28 w-28 rounded-full bg-black/10" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">
            Total Saldo
          </p>
          <Wallet className="h-5 w-5 text-emerald-200" />
        </div>
        <p className="mt-1.5 text-2xl font-extrabold tracking-tight sm:text-3xl">
          {formatRupiah(balance)}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-emerald-100/80">
          Rekening aktif
          {archivedCount > 0 ? ` · belum termasuk ${archivedCount} rekening arsip` : ''}
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/15 pt-3">
          <Stat label="Masuk" value={formatRupiah(income)} icon={<ArrowDownLeft className="h-3.5 w-3.5" />} />
          <Stat label="Keluar" value={formatRupiah(expense)} icon={<ArrowUpRight className="h-3.5 w-3.5" />} />
          <Stat
            label="Selisih"
            value={`${net >= 0 ? '+' : '−'}${formatRupiah(Math.abs(net))}`}
            icon={<Scale className="h-3.5 w-3.5" />}
          />
        </div>
        <p className="mt-2 text-[10px] font-medium text-emerald-100/70">{monthLabel}</p>
      </div>
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-100/80">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 truncate text-xs font-bold sm:text-sm">{value}</p>
    </div>
  )
}
