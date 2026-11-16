export async function showSystemNotification(
  title: string,
  body: string,
  tag: string,
): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) {
      await registration.showNotification(title, { body, tag, icon: '/icons/icon-192.png' })
      return
    }
    new Notification(title, { body, tag })
  } catch {
    // Notifikasi sistem opsional; toast di dalam aplikasi tetap tampil.
  }
}
