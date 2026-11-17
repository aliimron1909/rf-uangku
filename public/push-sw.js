// Penangan notifikasi push; dimuat service worker utama lewat importScripts.
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'RF Uangku', {
      body: payload.body || '',
      tag: payload.tag || 'rf-uangku',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: payload.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(url).catch(() => undefined)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
