// Service worker: makes the app installable and lets the shell open without a connection (the chat itself needs the relay).
// - pages: network first, falling back to the cached shell
// - /assets/* (content-hashed, never change): cache first
// - everything else same-origin: network first, cache as fallback
// A new version waits (it does not take over by itself) until the page asks for it, so the app can tell the user to reload
// instead of silently running half old, half new code.
// The build stamps the cache name below so every deploy gets its own cache; activation deletes the old ones.
// Chat messages never touch this cache: they travel over the relay's WebSocket, which service workers do not see.
const CACHE = 'chat-__BUILD__'
const SHELL = ['/', '/icon.svg', '/manifest.webmanifest', '/icons/icon-192.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

async function networkFirst(req, fallbackUrl) {
  try {
    const res = await fetch(req)
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone())
    return res
  } catch (err) {
    return (await caches.match(req)) || (fallbackUrl && (await caches.match(fallbackUrl))) || Response.error()
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin) return
  if (req.mode === 'navigate') return void e.respondWith(networkFirst(req, '/'))
  if (url.pathname.startsWith('/assets/')) {
    return void e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then(async (res) => {
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone())
      return res
    })))
  }
  e.respondWith(networkFirst(req))
})

self.addEventListener('message', (e) => { if (e.data === 'skip-waiting') self.skipWaiting() })

// Tapping a notification brings the chat to the front.
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow('/'))))
})
