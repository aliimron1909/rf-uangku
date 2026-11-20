import type { Category, TxType } from '../types'

interface SubSpec {
  key: string
  name: string
  icon: string
  color: string
}

interface GroupSpec {
  key: string
  type: TxType
  name: string
  icon: string
  color: string
  subs: SubSpec[]
}

const other = (color = '#94a3b8'): SubSpec => ({ key: 'lainnya', name: 'Lainnya', icon: 'ellipsis', color })

/** Kategori standar: tingkat atas = grup, isinya = subkategori (tempat transaksi disimpan). */
export const STANDARD_TREE: GroupSpec[] = [
  {
    key: 'kerja',
    type: 'income',
    name: 'Pendapatan Kerja & Profesi',
    icon: 'briefcase',
    color: '#10b981',
    subs: [
      { key: 'gaji', name: 'Gaji pokok', icon: 'banknote', color: '#059669' },
      { key: 'tunjangan', name: 'Tunjangan & insentif', icon: 'award', color: '#14b8a6' },
      { key: 'bonus', name: 'Lembur & bonus/THR', icon: 'gift', color: '#22c55e' },
      { key: 'freelance', name: 'Honor/proyek sampingan (freelance)', icon: 'laptop', color: '#06b6d4' },
    ],
  },
  {
    key: 'usaha',
    type: 'income',
    name: 'Usaha & Penjualan',
    icon: 'store',
    color: '#f59e0b',
    subs: [
      { key: 'bisnis', name: 'Hasil usaha/bisnis', icon: 'store', color: '#f59e0b' },
      { key: 'komisi', name: 'Komisi penjualan', icon: 'percent', color: '#f97316' },
      { key: 'jual', name: 'Penjualan barang/jasa pribadi', icon: 'package', color: '#eab308' },
    ],
  },
  {
    key: 'investasi',
    type: 'income',
    name: 'Investasi & Aset',
    icon: 'trending-up',
    color: '#3b82f6',
    subs: [
      { key: 'bunga', name: 'Bunga tabungan/deposito', icon: 'piggy-bank', color: '#0ea5e9' },
      { key: 'dividen', name: 'Dividen & imbal hasil investasi (capital gain, reksa dana, emas, dll.)', icon: 'coins', color: '#3b82f6' },
      { key: 'sewa', name: 'Sewa properti/kendaraan', icon: 'key', color: '#6366f1' },
      { key: 'royalti', name: 'Royalti', icon: 'crown', color: '#8b5cf6' },
    ],
  },
  {
    key: 'lain',
    type: 'income',
    name: 'Penerimaan Lain & Non-Rutin',
    icon: 'sparkles',
    color: '#a855f7',
    subs: [
      { key: 'hadiah', name: 'Hadiah/hibah/bantuan', icon: 'heart-handshake', color: '#ec4899' },
      { key: 'cashback', name: 'Cashback/refund/pengembalian dana', icon: 'undo-2', color: '#14b8a6' },
      { key: 'aset-bekas', name: 'Penjualan aset bekas', icon: 'recycle', color: '#84cc16' },
      { key: 'lainnya', name: 'Pemasukan lain-lain', icon: 'ellipsis', color: '#94a3b8' },
    ],
  },
  {
    key: 'makan',
    type: 'expense',
    name: 'Makan & Minum',
    icon: 'utensils',
    color: '#f97316',
    subs: [
      { key: 'groceries', name: 'Belanja bahan makanan (groceries)', icon: 'shopping-basket', color: '#84cc16' },
      { key: 'restoran', name: 'Makan di luar/restoran', icon: 'soup', color: '#f97316' },
      { key: 'kopi', name: 'Kopi/jajanan/minuman', icon: 'coffee', color: '#d97706' },
      { key: 'galon', name: 'Air minum/galon', icon: 'droplets', color: '#0ea5e9' },
      other(),
    ],
  },
  {
    key: 'hunian',
    type: 'expense',
    name: 'Hunian & Utilitas',
    icon: 'house',
    color: '#6366f1',
    subs: [
      { key: 'sewa', name: 'Sewa rumah/kos atau cicilan KPR', icon: 'key', color: '#6366f1' },
      { key: 'listrik', name: 'Listrik', icon: 'zap', color: '#eab308' },
      { key: 'air', name: 'Air/PDAM', icon: 'droplets', color: '#06b6d4' },
      { key: 'gas', name: 'Gas/bahan bakar masak', icon: 'flame', color: '#ef4444' },
      { key: 'internet', name: 'Internet/Wi-Fi & pulsa/paket data', icon: 'wifi', color: '#3b82f6' },
      { key: 'rawat', name: 'Perawatan & iuran rumah/lingkungan', icon: 'hammer', color: '#8b5cf6' },
      other(),
    ],
  },
  {
    key: 'transport',
    type: 'expense',
    name: 'Transportasi & Mobilitas',
    icon: 'car',
    color: '#0ea5e9',
    subs: [
      { key: 'bbm', name: 'Bahan bakar (BBM/pengisian daya)', icon: 'fuel', color: '#f59e0b' },
      { key: 'umum', name: 'Transportasi umum & ojek/taksi online', icon: 'bus', color: '#0ea5e9' },
      { key: 'parkir', name: 'Parkir & tol', icon: 'square-parking', color: '#64748b' },
      { key: 'servis', name: 'Servis/perawatan & pajak kendaraan', icon: 'wrench', color: '#ef4444' },
      other(),
    ],
  },
  {
    key: 'keluarga',
    type: 'expense',
    name: 'Keluarga & Sosial',
    icon: 'users',
    color: '#ec4899',
    subs: [
      { key: 'anak', name: 'Kebutuhan anak & pasangan', icon: 'baby', color: '#f472b6' },
      { key: 'pendidikan', name: 'Pendidikan/sekolah/kursus', icon: 'graduation-cap', color: '#6366f1' },
      { key: 'kado', name: 'Kado/acara/kondangan', icon: 'gift', color: '#f43f5e' },
      { key: 'donasi', name: 'Donasi/zakat/kontribusi sosial', icon: 'hand-heart', color: '#10b981' },
      other(),
    ],
  },
  {
    key: 'kesehatan',
    type: 'expense',
    name: 'Kesehatan & Perawatan Diri',
    icon: 'heart-pulse',
    color: '#ef4444',
    subs: [
      { key: 'dokter', name: 'Dokter/klinik/rumah sakit', icon: 'stethoscope', color: '#ef4444' },
      { key: 'obat', name: 'Obat/vitamin/suplemen', icon: 'pill', color: '#14b8a6' },
      { key: 'asuransi', name: 'Asuransi/BPJS', icon: 'shield-check', color: '#3b82f6' },
      { key: 'salon', name: 'Kebersihan & perawatan tubuh/salon', icon: 'scissors', color: '#d946ef' },
      other(),
    ],
  },
  {
    key: 'gaya',
    type: 'expense',
    name: 'Gaya Hidup & Belanja',
    icon: 'sparkles',
    color: '#8b5cf6',
    subs: [
      { key: 'hiburan', name: 'Hiburan/rekreasi/liburan', icon: 'ticket', color: '#8b5cf6' },
      { key: 'hobi', name: 'Hobi & olahraga', icon: 'dumbbell', color: '#22c55e' },
      { key: 'langganan', name: 'Langganan digital/aplikasi/media', icon: 'tv', color: '#ef4444' },
      { key: 'belanja', name: 'Pakaian/sepatu/gawai/barang non-rutin', icon: 'shirt', color: '#ec4899' },
      other(),
    ],
  },
  {
    key: 'tabungan',
    type: 'expense',
    name: 'Tabungan & Investasi',
    icon: 'piggy-bank',
    color: '#14b8a6',
    subs: [
      { key: 'dana', name: 'Tabungan & dana darurat', icon: 'piggy-bank', color: '#10b981' },
      { key: 'investasi', name: 'Investasi jangka menengah/panjang', icon: 'trending-up', color: '#3b82f6' },
      other(),
    ],
  },
  {
    key: 'kewajiban',
    type: 'expense',
    name: 'Kewajiban & Biaya Keuangan',
    icon: 'landmark',
    color: '#64748b',
    subs: [
      { key: 'cicilan', name: 'Cicilan utang/pinjaman/kartu kredit', icon: 'credit-card', color: '#ef4444' },
      { key: 'admin', name: 'Biaya admin/transfer', icon: 'receipt', color: '#64748b' },
      { key: 'pajak', name: 'Pajak pribadi', icon: 'landmark', color: '#f59e0b' },
      other(),
    ],
  },
]

export const groupId = (group: GroupSpec) => `cat-g-${group.type === 'income' ? 'inc' : 'exp'}-${group.key}`
export const subId = (group: GroupSpec, sub: SubSpec) => `cat-s-${group.type === 'income' ? 'inc' : 'exp'}-${group.key}-${sub.key}`

/** Kategori bawaan lama -> grup baru (dipindahkan sebagai subkategori, transaksinya ikut). */
export const LEGACY_PARENT: Record<string, string> = {
  'cat-inc-bagi-hasil': 'cat-g-inc-usaha',
  'cat-inc-ojol': 'cat-g-inc-usaha',
  'cat-inc-gaji': 'cat-g-inc-kerja',
  'cat-inc-lain': 'cat-g-inc-lain',
  'cat-exp-makan': 'cat-g-exp-makan',
  'cat-exp-keluarga': 'cat-g-exp-keluarga',
  'cat-exp-tagihan': 'cat-g-exp-hunian',
  'cat-exp-renovasi': 'cat-g-exp-hunian',
  'cat-exp-hiburan': 'cat-g-exp-gaya',
  'cat-exp-sedekah': 'cat-g-exp-keluarga',
}

/** Kategori pengeluaran "Lain-lain" bawaan lama tetap berdiri sendiri sebagai penampung umum, di urutan terakhir. */
const STANDALONE_LAST = 'cat-exp-lain'
const LEGACY_SORT_BASE = 50

export function buildStandardCategories(createdAt: string): Category[] {
  const result: Category[] = []
  STANDARD_TREE.forEach((group, groupIndex) => {
    const parent = groupId(group)
    result.push({
      id: parent,
      name: group.name,
      type: group.type,
      icon: group.icon,
      color: group.color,
      sortOrder: 100 + groupIndex,
      archived: false,
      createdAt,
    })
    group.subs.forEach((sub, subIndex) => {
      result.push({
        id: subId(group, sub),
        name: sub.name,
        type: group.type,
        icon: sub.icon,
        color: sub.color,
        parentId: parent,
        sortOrder: sub.name === 'Lainnya' ? 90 : subIndex + 1,
        archived: false,
        createdAt,
      })
    })
  })
  return result
}

export interface StandardCategoryPlan {
  add: Category[]
  update: { id: string; changes: Partial<Category> }[]
}

/** Rencana pemasangan: tambah yang belum ada (menurut id) dan pindahkan kategori bawaan lama ke grup barunya. */
export function planStandardCategories(existing: Category[], createdAt: string): StandardCategoryPlan {
  const have = new Map(existing.map((category) => [category.id, category]))
  const add = buildStandardCategories(createdAt).filter((category) => !have.has(category.id))
  const update: StandardCategoryPlan['update'] = []
  for (const category of existing) {
    const parent = LEGACY_PARENT[category.id]
    if (parent && !category.parentId) {
      update.push({ id: category.id, changes: { parentId: parent, sortOrder: LEGACY_SORT_BASE + category.sortOrder } })
    } else if (category.id === STANDALONE_LAST && category.sortOrder < 999) {
      update.push({ id: category.id, changes: { sortOrder: 999 } })
    }
  }
  return { add, update }
}
