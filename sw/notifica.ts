/** Dalla push ricevuta alla notifica da mostrare (logica pura, provata in notifica.test.ts). */

export type Notifica = { titolo: string; testo: string; link: string }

type Dati = { titolo?: unknown; testo?: unknown; link?: unknown; title?: unknown; body?: unknown }

/** Solo pagine di questo sito: un link esterno (anche se arrivasse) apre la home. */
export function linkSicuro(link: unknown, origine: string): string {
  try {
    const u = new URL(typeof link === 'string' ? link : '/', origine)
    return u.origin === origine ? u.pathname + u.search : '/'
  } catch {
    return '/'
  }
}

const testo = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined)

/** Accetta il formato di Firebase ({ data: {…} }), quello standard ({ notification }) o testo semplice. */
export function notificaDa(contenuto: string | undefined, origine: string): Notifica {
  let d: Dati = {}
  if (contenuto) {
    try {
      const json = JSON.parse(contenuto) as { data?: Dati; notification?: Dati } & Dati
      d = (json && typeof json === 'object' ? (json.data ?? json.notification ?? json) : { testo: contenuto }) ?? {}
    } catch {
      d = { testo: contenuto }
    }
  }
  return {
    titolo: testo(d.titolo, 120) ?? testo(d.title, 120) ?? 'WhosNext',
    testo: testo(d.testo, 400) ?? testo(d.body, 400) ?? '',
    link: linkSicuro(d.link, origine),
  }
}
