import type { Account, Category, Transaction } from '../types'
import { formatDate, formatDateTime } from './dates'
import { formatRupiahForPdf } from './format'
import { computeTotals } from './analytics'

/** jsPDF's built-in Helvetica only renders basic Latin characters. */
function pdfSafe(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, '?')
}

interface ReportPdfOptions {
  transactions: Transaction[]
  accounts: Account[]
  categories: Category[]
  start: string
  end: string
  periodLabel: string
  typeLabel: string
  accountLabel: string
  userName?: string
}

export async function downloadReportPdf(options: ReportPdfOptions): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const margin = 14
  const contentWidth = pageWidth - margin * 2
  const totals = computeTotals(options.transactions)

  const accountMap = new Map(
    options.accounts.map((account) => [account.id, pdfSafe(account.name)]),
  )
  const categoryMap = new Map(
    options.categories.map((category) => [category.id, pdfSafe(category.name)]),
  )

  // Header
  doc.setFillColor(6, 95, 70)
  doc.rect(0, 0, pageWidth, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('RF UANGKU', margin, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Laporan Keuangan Pribadi', margin, 20)
  doc.setFontSize(8)
  doc.text(`Dicetak: ${formatDateTime()}`, pageWidth - margin, 20, { align: 'right' })

  // Meta
  doc.setTextColor(51, 65, 85)
  doc.setFontSize(9)
  doc.text(`Periode: ${pdfSafe(options.periodLabel)}`, margin, 40)
  doc.text(`Jenis: ${pdfSafe(options.typeLabel)}`, margin, 45)
  doc.text(`Rekening: ${pdfSafe(options.accountLabel)}`, margin, 50)
  if (options.userName) {
    doc.text(`Pemilik: ${pdfSafe(options.userName)}`, pageWidth - margin, 40, { align: 'right' })
  }
  doc.text(`Rentang: ${formatDate(options.start)} s/d ${formatDate(options.end)}`, pageWidth - margin, 45, {
    align: 'right',
  })

  // Summary boxes
  const boxY = 57
  const gap = 3
  const boxWidth = (contentWidth - gap * 3) / 4
  const boxes = [
    { label: 'Pemasukan', value: totals.income, color: [16, 185, 129] as const },
    { label: 'Pengeluaran', value: totals.expense, color: [244, 63, 94] as const },
    { label: 'Selisih', value: totals.net, color: [14, 165, 233] as const },
    { label: 'Transaksi', value: totals.count, color: [100, 116, 139] as const, count: true },
  ]

  boxes.forEach((box, index) => {
    const x = margin + index * (boxWidth + gap)
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(x, boxY, boxWidth, 18, 2, 2, 'FD')
    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(box.label, x + 3, boxY + 5.5)
    doc.setTextColor(box.color[0], box.color[1], box.color[2])
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    const value = box.count ? `${box.value}` : formatRupiahForPdf(box.value)
    doc.text(value, x + 3, boxY + 13.5)
  })

  const tableStartY = boxY + 26

  autoTable(doc, {
    startY: tableStartY,
    head: [['No', 'Tanggal', 'Jenis', 'Kategori', 'Rekening', 'Catatan', 'Nominal']],
    body: options.transactions.map((transaction, index) => [
      String(index + 1),
      formatDate(transaction.occurredAt, 'dd/MM/yyyy'),
      transaction.type === 'income' ? 'Masuk' : 'Keluar',
      categoryMap.get(transaction.categoryId) ?? '-',
      accountMap.get(transaction.accountId) ?? '-',
      pdfSafe(transaction.note || '-'),
      `${transaction.type === 'income' ? '+' : '-'} ${formatRupiahForPdf(transaction.amount)}`,
    ]),
    foot: [
      [
        { content: 'TOTAL', colSpan: 6, styles: { halign: 'right' as const } },
        {
          content: `${totals.net >= 0 ? '+' : '-'} ${formatRupiahForPdf(Math.abs(totals.net))}`,
          styles: { halign: 'right' as const },
        },
      ],
    ],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [51, 65, 85],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [6, 95, 70],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    footStyles: {
      fillColor: [236, 253, 245],
      textColor: [6, 95, 70],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 22 },
      2: { cellWidth: 16 },
      3: { cellWidth: 38 },
      4: { cellWidth: 27 },
      5: { cellWidth: 45 },
      6: { cellWidth: 26, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        const row = options.transactions[data.row.index]
        if (row) {
          data.cell.styles.textColor =
            row.type === 'income' ? [5, 150, 105] : [225, 29, 72]
        }
      }
    },
  })

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text('Dibuat dengan RF Uangku', margin, 290)
    doc.text(`Halaman ${page} dari ${pageCount}`, pageWidth - margin, 290, {
      align: 'right',
    })
  }

  const safeStart = options.start.replace(/-/g, '')
  const safeEnd = options.end.replace(/-/g, '')
  doc.save(`Laporan-RF-Uangku-${safeStart}-sd-${safeEnd}.pdf`)
}
