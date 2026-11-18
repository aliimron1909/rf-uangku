import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../contexts/ToastContext'
import { getPendingNotifs, syncBankNotifications } from '../../lib/nativeBankNotif'

/** Aplikasi native: menarik notifikasi bank/e-wallet saat aplikasi dibuka dan memberi tahu bila ada transaksi terdeteksi. */
export function NativeBankSync() {
  const { toast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    let running = false
    async function run() {
      if (running) return
      running = true
      try {
        const added = await syncBankNotifications()
        if (added > 0) {
          const first = (await getPendingNotifs())[0]
          toast(`${added} transaksi terdeteksi dari notifikasi bank/e-wallet.`, 'info', {
            action: first ? { label: 'Tinjau', onClick: () => navigate(`/transactions?notif=${encodeURIComponent(first.id)}`) } : undefined,
          })
        }
      } catch {
        // Pembacaan notifikasi bersifat tambahan; kegagalan tidak mengganggu aplikasi.
      } finally {
        running = false
      }
    }
    void run()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [toast, navigate])

  return null
}
