/// <reference lib="webworker" />
/**
 * Service worker del sito: file salvati sul telefono (funziona anche senza rete)
 * e notifiche push (mandate dal server, vedi netlify/lib/postinoVero.ts).
 */
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { linkSicuro, notificaDa } from './notifica'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (import('workbox-precaching').PrecacheEntry | string)[] }

// Aggiornamento automatico: la versione nuova prende subito il posto di quella vecchia
self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
// Pagine dell'app dalla cache; le pagine interne di Firebase (login) no
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/__\//] }))

self.addEventListener('push', (evento) => {
  let contenuto: string | undefined
  try {
    contenuto = evento.data?.text()
  } catch {
    contenuto = undefined
  }
  const n = notificaDa(contenuto, self.location.origin)
  evento.waitUntil(
    self.registration.showNotification(n.titolo, {
      body: n.testo,
      icon: '/pwa-192.png',
      // Android usa solo la forma dell'iconcina: bianca su trasparente
      badge: '/badge-96.png',
      // stessa pagina = stessa notifica: la nuova sostituisce la vecchia
      tag: n.link,
      data: { link: n.link },
    }),
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const link = linkSicuro((evento.notification.data as { link?: string } | undefined)?.link, self.location.origin)
  evento.waitUntil(
    (async () => {
      const finestre = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const f of finestre) {
        if ('focus' in f) {
          await f.navigate(link).catch(() => undefined)
          return f.focus()
        }
      }
      return self.clients.openWindow(link)
    })(),
  )
})
