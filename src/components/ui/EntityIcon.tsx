import { resolveIcon } from '../../lib/icons'
import { cn } from '../../lib/utils'

const SIZES = {
  xs: { box: 'h-6 w-6 rounded-lg', icon: 'h-3.5 w-3.5' },
  sm: { box: 'h-8 w-8 rounded-lg', icon: 'h-4 w-4' },
  md: { box: 'h-9 w-9 rounded-xl', icon: 'h-[18px] w-[18px]' },
  lg: { box: 'h-10 w-10 rounded-xl', icon: 'h-5 w-5' },
}

interface EntityIconProps {
  /** Kunci ikon pilihan pengguna; kosong memakai `fallback`. */
  icon?: string
  /** Kunci ikon bawaan. */
  fallback: string
  color: string
  size?: keyof typeof SIZES
  className?: string
}

/** Kotak berwarna dengan ikon putih: penanda rekening atau kategori. */
export function EntityIcon({ icon, fallback, color, size = 'md', className }: EntityIconProps) {
  const Icon = resolveIcon(icon, fallback)
  const sizes = SIZES[size]
  return (
    <span
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center text-white', sizes.box, className)}
      style={{ backgroundColor: color }}
    >
      <Icon className={sizes.icon} />
    </span>
  )
}
