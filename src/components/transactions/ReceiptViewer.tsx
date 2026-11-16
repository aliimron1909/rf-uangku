import { useState } from 'react'
import { Paperclip } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { Modal } from '../ui/Modal'

/** Ikon klip kertas yang membuka foto struk dalam jendela. */
export function ReceiptButton({ receiptId }: { receiptId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        aria-label="Lihat foto struk"
      >
        <Paperclip className="h-3 w-3" />
        Struk
      </button>
      {open && <ReceiptModal receiptId={receiptId} onClose={() => setOpen(false)} />}
    </>
  )
}

function ReceiptModal({ receiptId, onClose }: { receiptId: string; onClose: () => void }) {
  const receipt = useLiveQuery(() => db.receipts.get(receiptId), [receiptId])
  return (
    <Modal open onClose={onClose} title="Foto struk" size="md">
      {receipt === undefined ? (
        <p className="py-6 text-center text-sm text-slate-500">Memuat...</p>
      ) : (
        <img
          src={receipt.dataUrl}
          alt="Foto struk"
          className="max-h-[70vh] w-full rounded-xl object-contain"
        />
      )}
    </Modal>
  )
}
