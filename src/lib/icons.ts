import {
  Award,
  Coins,
  Crown,
  Droplets,
  Ellipsis,
  Flame,
  HeartHandshake,
  Key,
  Laptop,
  Package,
  Percent,
  Recycle,
  Scissors,
  ShieldCheck,
  ShoppingBasket,
  Soup,
  SquareParking,
  Stethoscope,
  Ticket,
  Tv,
  Undo2,
  Baby,
  Banknote,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  Coffee,
  CreditCard,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Hammer,
  HandHeart,
  HeartPulse,
  House,
  Landmark,
  Music,
  PawPrint,
  Phone,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Store,
  Tag,
  TrendingUp,
  Users,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { AccountKind, TxType } from '../types'

/** Ikon yang bisa dipilih untuk rekening dan kategori. Kuncinya disimpan di data. */
export const ICON_REGISTRY: Record<string, LucideIcon> = {
  wallet: Wallet,
  banknote: Banknote,
  landmark: Landmark,
  smartphone: Smartphone,
  'credit-card': CreditCard,
  'piggy-bank': PiggyBank,
  'trending-up': TrendingUp,
  briefcase: Briefcase,
  store: Store,
  utensils: Utensils,
  coffee: Coffee,
  'shopping-cart': ShoppingCart,
  'shopping-bag': ShoppingBag,
  shirt: Shirt,
  car: Car,
  bus: Bus,
  fuel: Fuel,
  house: House,
  hammer: Hammer,
  wrench: Wrench,
  zap: Zap,
  wifi: Wifi,
  phone: Phone,
  receipt: Receipt,
  'heart-pulse': HeartPulse,
  pill: Pill,
  'graduation-cap': GraduationCap,
  'book-open': BookOpen,
  baby: Baby,
  users: Users,
  'paw-print': PawPrint,
  gift: Gift,
  'hand-heart': HandHeart,
  plane: Plane,
  film: Film,
  music: Music,
  gamepad: Gamepad2,
  dumbbell: Dumbbell,
  sparkles: Sparkles,
  tag: Tag,
  award: Award,
  coins: Coins,
  crown: Crown,
  droplets: Droplets,
  ellipsis: Ellipsis,
  flame: Flame,
  'heart-handshake': HeartHandshake,
  key: Key,
  laptop: Laptop,
  package: Package,
  percent: Percent,
  recycle: Recycle,
  scissors: Scissors,
  'shield-check': ShieldCheck,
  'shopping-basket': ShoppingBasket,
  soup: Soup,
  'square-parking': SquareParking,
  stethoscope: Stethoscope,
  ticket: Ticket,
  tv: Tv,
  'undo-2': Undo2,
}

export const ICON_KEYS = Object.keys(ICON_REGISTRY)

export const ICON_KEY_MAX_LENGTH = 40

export function isKnownIcon(key: unknown): key is string {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(ICON_REGISTRY, key)
}

/** Ikon bawaan rekening menurut jenisnya. */
export function defaultAccountIconKey(kind: AccountKind): string {
  if (kind === 'cash') return 'wallet'
  if (kind === 'ewallet') return 'smartphone'
  return 'landmark'
}

const CATEGORY_KEYWORDS: [string[], string][] = [
  [['makan', 'minum', 'kuliner', 'resto'], 'utensils'],
  [['kopi', 'cafe', 'kafe'], 'coffee'],
  [['belanja', 'groceries', 'sembako'], 'shopping-cart'],
  [['keluarga', 'anak', 'sekolah'], 'users'],
  [['tagihan', 'cicilan', 'pajak'], 'receipt'],
  [['listrik', 'pln'], 'zap'],
  [['internet', 'wifi'], 'wifi'],
  [['pulsa', 'telepon', 'telpon'], 'phone'],
  [['renovasi', 'bangun', 'perbaikan'], 'hammer'],
  [['rumah', 'kontrak', 'kost', 'sewa'], 'house'],
  [['hiburan', 'nonton', 'liburan', 'wisata'], 'film'],
  [['sedekah', 'zakat', 'infaq', 'donasi'], 'hand-heart'],
  [['kesehatan', 'obat', 'dokter', 'rumah sakit'], 'heart-pulse'],
  [['bensin', 'bbm', 'transport', 'parkir', 'ojol', 'gojek', 'grab'], 'car'],
  [['gaji', 'salary', 'honor'], 'banknote'],
  [['bagi hasil', 'toko', 'usaha', 'dagang', 'jualan'], 'store'],
  [['investasi', 'saham', 'bunga', 'dividen'], 'trending-up'],
  [['tabungan'], 'piggy-bank'],
  [['hadiah', 'kado', 'bonus'], 'gift'],
]

/** Ikon bawaan kategori: ditebak dari nama, lalu dari jenisnya. */
export function defaultCategoryIconKey(name: string, type: TxType): string {
  const text = name.toLowerCase()
  for (const [words, key] of CATEGORY_KEYWORDS) {
    if (words.some((word) => text.includes(word))) return key
  }
  return type === 'income' ? 'trending-up' : 'tag'
}

/** Ikon yang dipakai: pilihan pengguna jika valid, jika tidak ikon bawaan. */
export function resolveIcon(icon: string | undefined, fallbackKey: string): LucideIcon {
  if (isKnownIcon(icon)) return ICON_REGISTRY[icon]
  return ICON_REGISTRY[fallbackKey] ?? Tag
}
