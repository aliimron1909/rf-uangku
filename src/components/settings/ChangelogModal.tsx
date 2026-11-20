import { useEffect, useState } from 'react'
import { fetchReleaseLogs, type ReleaseLog } from '../../lib/nativeUpdate'
import { formatDate } from '../../lib/dates'
import { errorMessage } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface ChangelogModalProps {
  open: boolean
  installedBuild: number
  onClose: () => void
}

/** Daftar perubahan beberapa versi terakhir, diambil dari catatan rilis GitHub. */
export function ChangelogModal({ open, installedBuild, onClose }: ChangelogModalProps) {
  const [logs, setLogs] = useState<ReleaseLog[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let active = true
    setLogs(null)
    setError('')
    fetchReleaseLogs(5)
      .then((result) => active && setLogs(result))
      .catch((caught) => active && setError(errorMessage(caught)))
    return () => {
      active = false
    }
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Changelog"
      size="sm"
      footer={
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
        {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        {!error && !logs && <p className="text-xs text-slate-500">Memuat…</p>}
        {logs?.length === 0 && <p className="text-xs text-slate-500">Belum ada catatan perubahan.</p>}
        {logs?.map((log) => (
          <div key={log.tag}>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
              v{log.version} · build {log.build}
              {log.build === installedBuild && ' (terpasang)'}
              {log.date && (
                <span className="font-normal text-slate-500 dark:text-slate-400">
                  {' · '}
                  {formatDate(new Date(log.date))}
                </span>
              )}
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
              {(log.changelog.length > 0 ? log.changelog : ['Pembaruan dan perbaikan.']).map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  )
}
