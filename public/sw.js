const CACHE_NAME = 'apicehotel-manutenzione-v14'
const APP_CACHE_PREFIX = 'apicehotel-manutenzione-'
const APP_SHELL = [
  '/',
  '/manifest.webmanifest?v=9',
  '/icons/icon-192.png?v=9',
  '/icons/icon-512.png?v=9',
  '/icons/icon-maskable-512.png?v=9',
  '/icons/apple-touch-icon.png?v=9',
  '/icons/icon-urgent-192.png?v=9',
  '/logos/card-hotelgio.png',
  '/logos/card-chocohotel.png',
  '/logos/card-brigantino.png',
]

const isValidDynamicAsset = (request, response) => {
  if (!response?.ok) return false
  const type = (response.headers.get('content-type') || '').toLowerCase()
  if (request.destination === 'script' || request.destination === 'worker') {
    return type.includes('javascript') || type.includes('ecmascript')
  }
  if (request.destination === 'style') return type.includes('text/css')
  return true
}

const getValidCachedDynamicAsset = async (request) => {
  const cached = await caches.match(request)
  return isValidDynamicAsset(request, cached) ? cached : null
}

const missingDynamicAssetResponse = () => new Response('Deployment asset no longer available', {
  status: 503,
  statusText: 'Deployment Asset Stale',
  headers: {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
  },
})

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(APP_SHELL)

    const shellResponse = await fetch('/', { cache: 'no-store' })
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
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME && key.startsWith(APP_CACHE_PREFIX)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }
  if (event.data?.type === 'PURGE_RUNTIME_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(APP_CACHE_PREFIX)).map((key) => caches.delete(key)))),
    )
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response.ok && (response.headers.get('content-type') || '').includes('text/html')) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/'))),
    )
    return
  }

  const dynamicAsset = ['script', 'style', 'worker'].includes(request.destination)
  if (dynamicAsset) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' })
        if (isValidDynamicAsset(request, response)) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return response
        }
        return (await getValidCachedDynamicAsset(request)) || missingDynamicAssetResponse()
      } catch {
        return (await getValidCachedDynamicAsset(request)) || missingDynamicAssetResponse()
      }
    })())
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
  const icon = urgent ? '/icons/icon-urgent-192.png?v=9' : '/icons/icon-192.png?v=9'
  const targetUrl = payload.url || '/'
  event.waitUntil((async () => {
    await self.registration.showNotification(payload.title, {
      body: payload.body,
      icon,
      badge: icon,
      tag: payload.tag || 'apicehotel-notifica',
      renotify: Boolean(payload.tag),
      data: {
        url: targetUrl,
        eventType: payload.eventType || null,
        issueId: payload.issueId || null,
        hotelId: payload.hotelId || null,
      },
      requireInteraction: urgent,
      vibrate: urgent ? [400, 80, 400, 80, 400, 80, 400] : [120, 60, 120],
      timestamp: Date.now(),
    })

    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (urgent) {
      clientsList.forEach((client) => client.postMessage({
        type: 'urgenza-push',
        title: payload.title,
        body: payload.body,
        hotelId: payload.hotelId || null,
      }))
    } else {
      clientsList.forEach((client) => client.postMessage({
        type: 'notifica-push',
        eventType: payload.eventType || null,
        issueId: payload.issueId || null,
        hotelId: payload.hotelId || null,
        url: targetUrl,
      }))
    }
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = clientsList.find((item) => item.url.startsWith(self.location.origin))
    if (existing) {
      try {
        if (existing.url !== targetUrl && 'navigate' in existing) await existing.navigate(targetUrl)
      } catch { /* alcuni browser possono negare navigate; il focus resta valido */ }
      await existing.focus()
      existing.postMessage({ type: 'notification-click', url: targetUrl, data: event.notification.data || {} })
      return
    }
    await self.clients.openWindow(targetUrl)
  })())
})
