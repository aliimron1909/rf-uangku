import { useEffect, useRef } from 'react'
import { pushBackEntry } from '../lib/backStack'

/** Selama `active`, tombol kembali HP menutup overlay (lewat `onClose`) alih-alih meninggalkan halaman. */
export function useBackClose(active: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!active) return
    return pushBackEntry(() => closeRef.current())
  }, [active])
}
