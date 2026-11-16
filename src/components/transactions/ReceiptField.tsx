import { useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { processReceiptPhoto } from '../../lib/receipts'
import { errorMessage } from '../../lib/utils'
import { Button } from '../ui/Button'

interface ReceiptFieldProps {
  /** Struk tersimpan yang sedang terpasang (tidak diubah sampai disimpan). */
  receiptId?: string
  /** Foto baru (belum disimpan). */
  newDataUrl?: string
  onChange: (next: { receiptId?: string; newDataUrl?: string }) => void
}

export function ReceiptField({ receiptId, newDataUrl, onChange }: ReceiptFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const stored = useLiveQuery(
    async () => (receiptId ? db.receipts.get(receiptId) : undefined),
    [receiptId],
  )
  const preview = newDataUrl ?? stored?.dataUrl

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setProcessing(true)
    setError('')
    try {
      const dataUrl = await processReceiptPhoto(file)
      onChange({ receiptId: undefined, newDataUrl: dataUrl })
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Foto struk (opsional)</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => void handleFile(event)}
      />
      {preview ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-2 dark:border-slate-700">
          <img src={preview} alt="Pratinjau struk" className="h-16 w-16 rounded-lg object-cover" />
          <div className="flex flex-1 flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={processing}
              onClick={() => inputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              Ganti
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange({ receiptId: undefined, newDataUrl: undefined })}
            >
              <Trash2 className="h-4 w-4" />
              Hapus
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          loading={processing}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="h-4 w-4" />
          Ambil / pilih foto struk
        </Button>
      )}
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Foto dikecilkan dan disimpan di perangkat ini, ikut dalam backup JSON.
      </p>
    </div>
  )
}
