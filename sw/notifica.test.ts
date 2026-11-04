import { describe, expect, it } from 'vitest'
import { linkSicuro, notificaDa } from './notifica'

const O = 'https://whos-next.web.app'

describe('notifiche push nel service worker', () => {
  it('formato di Firebase: titolo, testo e pagina da aprire', () => {
    const n = notificaDa(JSON.stringify({ data: { titolo: 'Lista pubblicata', testo: 'Sei il n° 3.', link: `${O}/classe/c1?x=1` } }), O)
    expect(n).toEqual({ titolo: 'Lista pubblicata', testo: 'Sei il n° 3.', link: '/classe/c1?x=1' })
  })
  it('anche il formato standard e il testo semplice', () => {
    expect(notificaDa(JSON.stringify({ notification: { title: 'Ciao', body: 'Testo' } }), O)).toEqual({ titolo: 'Ciao', testo: 'Testo', link: '/' })
    expect(notificaDa('solo testo', O)).toEqual({ titolo: 'WhosNext', testo: 'solo testo', link: '/' })
    expect(notificaDa(undefined, O)).toEqual({ titolo: 'WhosNext', testo: '', link: '/' })
    expect(notificaDa('null', O)).toEqual({ titolo: 'WhosNext', testo: 'null', link: '/' })
    expect(notificaDa('42', O)).toEqual({ titolo: 'WhosNext', testo: '42', link: '/' })
  })
  it('dati strani: tipi sbagliati e testi lunghissimi non rompono niente', () => {
    const n = notificaDa(JSON.stringify({ data: { titolo: { a: 1 }, testo: 'x'.repeat(5000), link: 7 } }), O)
    expect(n.titolo).toBe('WhosNext')
    expect(n.testo).toHaveLength(400)
    expect(n.link).toBe('/')
  })
  it('i link portano solo dentro il sito', () => {
    expect(linkSicuro('https://cattivo.example/ruba', O)).toBe('/')
    expect(linkSicuro('//cattivo.example/ruba', O)).toBe('/')
    expect(linkSicuro('javascript:alert(1)', O)).toBe('/')
    expect(linkSicuro('http://whos-next.web.app/x', O)).toBe('/') // niente http
    expect(linkSicuro('/impostazioni', O)).toBe('/impostazioni')
    expect(linkSicuro(`${O}/classe/a/materia/b`, O)).toBe('/classe/a/materia/b')
  })
})
