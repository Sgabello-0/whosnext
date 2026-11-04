/// <reference lib="webworker" />
/**
 * Service worker del sito: file salvati sul telefono (funziona anche senza rete)
 * e notifiche push (mandate dal server, vedi netlify/lib/postinoVero.ts).
 */
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (import('workbox-precaching').PrecacheEntry | string)[] }

// Aggiornamento automatico: la versione nuova prende subito il posto di quella vecchia
self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
// Pagine dell'app dalla cache; le pagine interne di Firebase (login) no
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/__\//] }))

type Dati = { titolo?: string; testo?: string; link?: string; title?: string; body?: string }

self.addEventListener('push', (evento) => {
  let d: Dati = {}
  try {
    const json = evento.data?.json() as { data?: Dati; notification?: Dati } & Dati
    d = json?.data ?? json?.notification ?? json ?? {}
  } catch {
    d = { testo: evento.data?.text() }
  }
  const link = d.link ?? '/'
  evento.waitUntil(
    self.registration.showNotification(d.titolo ?? d.title ?? 'WhosNext', {
      body: d.testo ?? d.body ?? '',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      // stessa pagina = stessa notifica: la nuova sostituisce la vecchia
      tag: link,
      data: { link },
    }),
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const link = (evento.notification.data as { link?: string } | undefined)?.link ?? '/'
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
