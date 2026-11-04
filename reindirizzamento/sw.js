// Sostituisce il vecchio service worker di whosnext-4b067.web.app / .firebaseapp.com:
// si cancella da solo e ricarica le pagine aperte, che così arrivano al rinvio verso whos-next.web.app.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const chiavi = await caches.keys()
      await Promise.all(chiavi.map((k) => caches.delete(k)))
      await self.registration.unregister()
      const finestre = await self.clients.matchAll({ type: 'window' })
      for (const f of finestre) f.navigate(f.url)
    })(),
  )
})
