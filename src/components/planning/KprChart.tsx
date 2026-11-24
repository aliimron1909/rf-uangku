import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTheme } from '../../contexts/ThemeContext'
import { CHART_COLORS } from '../../lib/constants'
import { formatCompactRupiah, formatRupiah } from '../../lib/format'
import type { KprYear } from '../../lib/kpr'

const PRINCIPAL_COLOR = '#10b981'
const INTEREST_COLOR = '#f43f5e'
const names: Record<string, string> = { principal: 'Pokok', interest: 'Bunga' }

/** Batang bertumpuk per tahun: bagian pokok dan bagian bunga dari total cicilan setahun. */
export function KprChart({ data }: { data: KprYear[] }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const rows = data.map((item) => ({ ...item, label: `Th ${item.year}` }))
  return (
    <div>
      <div className="h-[260px] w-full sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={isDark ? CHART_COLORS.gridDark : CHART_COLORS.gridLight}
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: isDark ? CHART_COLORS.textDark : CHART_COLORS.textLight }}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={64}
              tick={{ fontSize: 10, fill: isDark ? CHART_COLORS.textDark : CHART_COLORS.textLight }}
              tickFormatter={(value) => formatCompactRupiah(Number(value))}
            />
            <Tooltip
              cursor={{ fill: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(100,116,139,0.06)' }}
              formatter={(value, name) => [formatRupiah(Number(value)), names[String(name)] ?? String(name)]}
              contentStyle={{
                borderRadius: 12,
                border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                background: isDark ? '#0f172a' : '#ffffff',
                color: isDark ? '#f1f5f9' : '#0f172a',
                fontSize: 12,
              }}
              labelStyle={{ fontWeight: 700, marginBottom: 4 }}
            />
            <Bar dataKey="principal" name="principal" stackId="kpr" fill={PRINCIPAL_COLOR} maxBarSize={22} />
            <Bar
              dataKey="interest"
              name="interest"
              stackId="kpr"
              fill={INTEREST_COLOR}
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PRINCIPAL_COLOR }} />
          Pokok
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: INTEREST_COLOR }} />
          Bunga
        </span>
      </div>
    </div>
  )
}
