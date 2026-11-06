import { describe, expect, it } from 'vitest'
import {
  preferenzeDa,
  dalCentro,
  dividiInFasce,
  generaLista,
  generatoreCasuale,
  mescola,
  type Preferenza,
  type Scelta,
} from './generateList'

/** Studenti s00, s01, … */
function studenti(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `s${String(i).padStart(2, '0')}`)
}

function pref(scelta: Scelta, quando = 0, dataDSA: string | null = null): Preferenza {
  return { scelta, dataDSA, quando }
}

function genera(n: number, prefs: Record<string, Preferenza>, dsa: string[] = [], seme = 42) {
  return generaLista({ studenti: studenti(n), preferenze: new Map(Object.entries(prefs)), dsa: new Set(dsa), seme })
}

/** Posizione (da 0) di ogni studente nella lista. */
function posizioni(ordine: string[]): Record<string, number> {
  return Object.fromEntries(ordine.map((u, i) => [u, i]))
}

describe('strumenti', () => {
  it('divide i posti in tre fasce: la metà prende l\'avanzo', () => {
    expect(dividiInFasce([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual({
      inizio: [0, 1, 2],
      meta: [3, 4, 5, 6],
      fine: [7, 8, 9],
    })
    expect(dividiInFasce([0, 1, 2, 3, 4, 5, 6, 7])).toEqual({ inizio: [0, 1, 2], meta: [3, 4], fine: [5, 6, 7] })
    expect(dividiInFasce([0, 1])).toEqual({ inizio: [0], meta: [], fine: [1] })
    expect(dividiInFasce([0])).toEqual({ inizio: [], meta: [0], fine: [] })
    expect(dividiInFasce([])).toEqual({ inizio: [], meta: [], fine: [] })
  })
  it('ordina dal centro verso l\'esterno', () => {
    expect(dalCentro([3, 4, 5, 6, 7])).toEqual([5, 4, 6, 3, 7])
    expect(dalCentro([3, 4, 5, 6])).toEqual([4, 5, 3, 6])
  })
  it('il generatore con lo stesso seme dà gli stessi numeri', () => {
    const a = generatoreCasuale(7)
    const b = generatoreCasuale(7)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(generatoreCasuale(8)()).not.toBe(generatoreCasuale(7)())
  })
  it('mescola è una permutazione e non modifica l\'originale', () => {
    const x = [1, 2, 3, 4, 5]
    const y = mescola(x, generatoreCasuale(1))
    expect([...y].sort()).toEqual(x)
    expect(x).toEqual([1, 2, 3, 4, 5])
  })
})

describe('fasce', () => {
  it('ognuno nella fascia scelta quando c\'è posto', () => {
    const p: Record<string, Preferenza> = {}
    studenti(9).forEach((u, i) => (p[u] = pref(i < 3 ? 'inizio' : i < 6 ? 'meta' : 'fine')))
    const { ordine, rapporto } = genera(9, p)
    const pos = posizioni(ordine)
    for (const u of ['s00', 's01', 's02']) expect(pos[u]).toBeLessThan(3)
    for (const u of ['s03', 's04', 's05']) expect(pos[u]).toBeGreaterThanOrEqual(3)
    for (const u of ['s03', 's04', 's05']) expect(pos[u]).toBeLessThan(6)
    for (const u of ['s06', 's07', 's08']) expect(pos[u]).toBeGreaterThanOrEqual(6)
    expect(rapporto.inizio).toEqual({ richieste: 3, ottenute: 3 })
    expect(rapporto.meta).toEqual({ richieste: 3, ottenute: 3 })
    expect(rapporto.fine).toEqual({ richieste: 3, ottenute: 3 })
  })

  it('chi sceglie metà parte dal centro', () => {
    // 10 posti → fascia centrale 3..6, centro 4-5
    const { ordine } = genera(10, { s00: pref('meta') })
    expect([4, 5]).toContain(posizioni(ordine).s00)
  })

  it('chi è in più va ai posti liberi più vicini alla sua fascia', () => {
    // 9 posti, fasce 3/3/3, 5 vogliono l'inizio: 3 nella fascia, 2 subito dopo (posti 3 e 4)
    const p: Record<string, Preferenza> = {}
    for (const u of studenti(5)) p[u] = pref('inizio')
    const { ordine, rapporto } = genera(9, p)
    const pos = posizioni(ordine)
    expect(studenti(5).map((u) => pos[u]).sort()).toEqual([0, 1, 2, 3, 4])
    expect(rapporto.inizio).toEqual({ richieste: 5, ottenute: 3 })
  })

  it('lo stesso vale per la fine', () => {
    const p: Record<string, Preferenza> = {}
    for (const u of studenti(5)) p[u] = pref('fine')
    const pos = posizioni(genera(9, p).ordine)
    expect(studenti(5).map((u) => pos[u]).sort()).toEqual([4, 5, 6, 7, 8])
  })

  it('con un DSA (data scelta) e due posti, inizio e fine ottengono ciò che chiedono (caso reale)', () => {
    const { ordine, fissi, rapporto } = genera(3, { s00: pref('data', 0, '2026-11-10'), s01: pref('inizio'), s02: pref('fine') }, ['s00'])
    expect(ordine).toEqual(['s01', 's02'])
    expect(fissi).toEqual({ s00: '2026-11-10' })
    expect(rapporto.inizio).toEqual({ richieste: 1, ottenute: 1 })
    expect(rapporto.fine).toEqual({ richieste: 1, ottenute: 1 })
  })

  it('se tutti vogliono la metà, si allargano dal centro', () => {
    const p: Record<string, Preferenza> = {}
    for (const u of studenti(9)) p[u] = pref('meta')
    const { ordine, rapporto } = genera(9, p)
    expect([...ordine].sort()).toEqual(studenti(9))
    expect(rapporto.meta).toEqual({ richieste: 9, ottenute: 3 })
  })

  it('"non mi interessa" e chi non risponde riempiono i posti rimasti', () => {
    const { ordine, rapporto } = genera(6, { s00: pref('inizio'), s01: pref('fine'), s02: pref('indifferente') })
    const pos = posizioni(ordine)
    expect(pos.s00).toBeLessThan(2)
    expect(pos.s01).toBeGreaterThanOrEqual(4)
    expect(rapporto).toMatchObject({ totale: 6, risposte: 3, senzaRisposta: 3, indifferenti: 1 })
  })
})

describe('DSA/BES', () => {
  it('chi sceglie una data esce dall\'ordine e tiene la sua data', () => {
    const { ordine, fissi, rapporto } = genera(
      10,
      { s05: pref('data', 0, '2026-11-10'), s06: pref('data', 0, '2026-11-12') },
      ['s05', 's06'],
    )
    expect(ordine).toHaveLength(8)
    expect(ordine).not.toContain('s05')
    expect(ordine).not.toContain('s06')
    expect(fissi).toEqual({ s05: '2026-11-10', s06: '2026-11-12' })
    expect(rapporto.dsa).toEqual({ richieste: 2, esatte: 2 })
    expect(rapporto.totale).toBe(10)
  })

  it('due DSA possono scegliere lo stesso giorno: lo tengono entrambi', () => {
    const { fissi } = genera(6, { s01: pref('data', 200, '2026-11-10'), s02: pref('data', 100, '2026-11-10') }, ['s01', 's02'])
    expect(fissi).toEqual({ s01: '2026-11-10', s02: '2026-11-10' })
  })

  it('una data scritta male vale come "non mi interessa"', () => {
    const { ordine, fissi, rapporto } = genera(5, { s00: pref('data', 0, '10/11/2026') }, ['s00'])
    expect(fissi).toEqual({})
    expect(ordine).toContain('s00')
    expect(rapporto.indifferenti).toBe(1)
  })

  it('le fasce si calcolano solo su chi è in ordine', () => {
    // 7 studenti, un DSA con la data: restano 6 posti → fasce 0-1 / 2-3 / 4-5
    const { ordine } = genera(7, { s00: pref('data', 0, '2026-11-10'), s01: pref('inizio'), s02: pref('inizio') }, ['s00'])
    const pos = posizioni(ordine)
    expect([pos.s01, pos.s02].sort()).toEqual([0, 1])
  })

  it('chi sceglie una data senza badge (tolto nel frattempo) è trattato come "non mi interessa"', () => {
    const { fissi, rapporto } = genera(5, { s00: pref('data', 0, '2026-11-10') }, [])
    expect(fissi).toEqual({})
    expect(rapporto.dsa.richieste).toBe(0)
    expect(rapporto.indifferenti).toBe(1)
  })

  it('un DSA può anche scegliere una fascia come tutti', () => {
    const { ordine } = genera(9, { s00: pref('fine') }, ['s00'])
    expect(posizioni(ordine).s00).toBeGreaterThanOrEqual(6)
  })
})

describe('casi limite e garanzie', () => {
  it('classi piccolissime', () => {
    expect(genera(0, {}).ordine).toEqual([])
    expect(genera(1, { s00: pref('fine') }).ordine).toEqual(['s00'])
    const due = genera(2, { s00: pref('fine'), s01: pref('inizio') })
    expect(due.ordine).toEqual(['s01', 's00'])
    expect(due.rapporto.inizio).toEqual({ richieste: 1, ottenute: 1 })
    expect(due.rapporto.fine).toEqual({ richieste: 1, ottenute: 1 })
  })

  it('ignora le preferenze di chi non è più nella classe', () => {
    const { ordine, rapporto } = genera(3, { ex: pref('inizio'), s00: pref('inizio') })
    expect(ordine).not.toContain('ex')
    expect(rapporto.risposte).toBe(1)
  })

  it('stesso seme → stessa lista; seme diverso → in genere diversa', () => {
    const p = { s00: pref('indifferente'), s01: pref('indifferente') }
    expect(genera(20, p, [], 1).ordine).toEqual(genera(20, p, [], 1).ordine)
    expect(genera(20, p, [], 1).ordine).not.toEqual(genera(20, p, [], 2).ordine)
  })

  it('non dipende dall\'ordine in cui arrivano gli studenti', () => {
    const p = new Map(Object.entries({ s00: pref('inizio'), s03: pref('fine') }))
    const a = generaLista({ studenti: studenti(8), preferenze: p, dsa: new Set(), seme: 3 })
    const b = generaLista({ studenti: [...studenti(8)].reverse(), preferenze: p, dsa: new Set(), seme: 3 })
    expect(a.ordine).toEqual(b.ordine)
  })

  it('su 2000 classi casuali ognuno compare esattamente una volta (in ordine o con la data fissa)', () => {
    const casuale = generatoreCasuale(2026)
    const scelte: Scelta[] = ['inizio', 'meta', 'fine', 'indifferente', 'data']
    for (let prova = 0; prova < 2000; prova++) {
      const n = Math.floor(casuale() * 35)
      const tutti = studenti(n)
      const prefs = new Map<string, Preferenza>()
      const dsa = new Set<string>()
      for (const u of tutti) {
        if (casuale() < 0.2) continue // non risponde
        const scelta = scelte[Math.floor(casuale() * scelte.length)]!
        if (scelta === 'data' && casuale() < 0.8) dsa.add(u)
        prefs.set(u, pref(scelta, Math.floor(casuale() * 1000), `2026-11-${String(10 + Math.floor(casuale() * 20)).padStart(2, '0')}`))
      }
      const { ordine, fissi, rapporto } = generaLista({ studenti: tutti, preferenze: prefs, dsa, seme: prova })
      const tuttiInLista = [...ordine, ...Object.keys(fissi)]
      expect(tuttiInLista).toHaveLength(n)
      expect([...tuttiInLista].sort()).toEqual(tutti)
      // le date fisse solo a chi ha il badge e l'ha chiesta
      for (const u of Object.keys(fissi)) expect(dsa.has(u) && prefs.get(u)?.scelta === 'data').toBe(true)
      expect(rapporto.totale).toBe(n)
      expect(rapporto.risposte + rapporto.senzaRisposta).toBe(n)
    }
  })
})

describe('preferenze lette dal database', () => {
  it('dati strani o vecchi non fanno saltare niente', () => {
    const p = preferenzeDa([
      { id: 'a', dati: { scelta: 'boh' as never } },
      { id: 'b', dati: { scelta: 'data', dataDSA: 3 as never, aggiornato: 'ieri' as never } },
      { id: 'c', dati: { scelta: 'fine', dataDSA: 'domani' } },
      { id: 'e', dati: { scelta: 'posizione' as never, dataDSA: '2026-11-10' } },
      { id: 'd', dati: { scelta: 'inizio', aggiornato: { toMillis: () => 42 } } },
    ])
    expect(p.get('a')).toEqual({ scelta: 'indifferente', dataDSA: null, quando: 0 })
    expect(p.get('b')).toEqual({ scelta: 'data', dataDSA: null, quando: 0 })
    expect(p.get('c')).toEqual({ scelta: 'fine', dataDSA: null, quando: 0 })
    expect(p.get('d')?.quando).toBe(42)
    // la vecchia "posizione esatta" non esiste più: vale come "non mi interessa"
    expect(p.get('e')?.scelta).toBe('indifferente')
    const { ordine, fissi } = generaLista({ studenti: ['a', 'b', 'c', 'd', 'e'], preferenze: p, dsa: new Set(['b', 'e']), seme: 1 })
    expect(fissi).toEqual({})
    expect([...ordine].sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})
