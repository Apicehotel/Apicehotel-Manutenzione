const CACHE_NAME = 'apicehotel-manutenzione-v8'
const APP_SHELL = [
  '/',
  '/manifest.webmanifest?v=8',
  '/icons/icon-192.png?v=8',
  '/icons/icon-512.png?v=8',
  '/icons/icon-maskable-512.png?v=8',
  '/icons/apple-touch-icon.png?v=8',
  '/icons/icon-urgent-192.png?v=8',
  '/logos/card-hotelgio.png',
  '/logos/card-chocohotel.png',
  '/logos/card-brigantino.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(APP_SHELL)

    const shellResponse = await fetch('/')
    const shellHtml = await shellResponse.clone().text()
    const assetPaths = [...shellHtml.matchAll(/(?:src|href)="([^"#]+)"/g)]
      .map((match) => new URL(match[1], self.location.origin))
      .filter((url) => url.origin === self.location.origin && !url.pathname.startsWith('/api/'))
      .map((url) => `${url.pathname}${url.search}`)
    await cache.addAll([...new Set(assetPaths)])
    await cache.put('/', shellResponse)
  })())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          // Chiave di cache = percorso reale (non più fisso '/'), cosi'
          // pagine diverse (Home, /tecnico/<token>, ecc.) non si sovrascrivono
          // a vicenda nella cache offline.
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/'))),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
      }
      return response
    })),
  )
})

self.addEventListener('push', (event) => {
  let payload = { title: 'RandApp - Manutenzioni', body: 'Hai una nuova notifica.' }
  if (event.data) {
    try { payload = { ...payload, ...event.data.json() } } catch { payload.body = event.data.text() || payload.body }
  }
  const urgent = Boolean(payload.urgent)
  // Icona rossa cerchiata solo per gli avvisi urgenti: deve distinguersi a
  // colpo d'occhio nella tendina notifiche da una notifica normale.
  const icon = urgent ? '/icons/icon-urgent-192.png?v=8' : '/icons/icon-192.png?v=8'
  event.waitUntil((async () => {
    await self.registration.showNotification(payload.title, {
      body: payload.body,
      icon,
      badge: icon,
      tag: payload.tag || 'apicehotel-notifica',
      renotify: Boolean(payload.tag),
      data: { url: payload.url || '/' },
      requireInteraction: urgent,
      vibrate: urgent ? [400, 80, 400, 80, 400, 80, 400] : [120, 60, 120],
    })
    if (urgent) {
      // Il suono di sistema della notifica non basta: se una scheda dell'app
      // e' gia' aperta (anche in background), fai partire la sirena vera via
      // Web Audio. Il client fa da guardia contro il doppio suono con la
      // sottoscrizione realtime (vedi dedupe in App.jsx).
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      clientsList.forEach((client) => client.postMessage({ type: 'urgenza-push', title: payload.title, body: payload.body }))
    }
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = clientsList.find((item) => item.url.includes(self.location.origin))
    if (existing) { existing.focus(); return }
    await self.clients.openWindow(targetUrl)
  })())
})
