import {
  ArrowLeftRight,
  FileText,
  LayoutDashboard,
  Settings,
  Target,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  shortLabel: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transaksi', shortLabel: 'Transaksi', icon: ArrowLeftRight },
  { to: '/planning', label: 'Rencana', shortLabel: 'Rencana', icon: Target },
  { to: '/reports', label: 'Laporan', shortLabel: 'Laporan', icon: FileText },
  { to: '/settings', label: 'Pengaturan', shortLabel: 'Atur', icon: Settings },
]

export function pageTitle(pathname: string): string {
  if (pathname.startsWith('/transactions')) return 'Transaksi'
  if (pathname.startsWith('/planning')) return 'Rencana'
  if (pathname.startsWith('/reports')) return 'Laporan'
  if (pathname.startsWith('/settings')) return 'Pengaturan'
  return 'Dashboard'
}
