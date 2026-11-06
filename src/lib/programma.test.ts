import { describe, expect, it } from 'vitest'
import { aggiungiGiorni, CALENDARIO_DEFAULT, conEccezione, haLezione, type Calendario, type Momento } from './calendar'
import { stimaInterrogazione } from './estimate'
import { generatoreCasuale } from './generateList'
import { propostaLezione, tuttiInterrogati } from './lista'
import { dateDisponibili, programmaLista, type DatiProgramma } from './programma'

// Martedì e giovedì; martedì 03/11/2026
const MAR_GIO = [1, 3]
const cal: Calendario = { ...CALENDARIO_DEFAULT, uscite: Array(7).fill('14:00') }
const MATTINA: Momento = { oggi: '2026-11-03', ora: '09:00' }
const POMERIGGIO: Momento = { oggi: '2026-11-03', ora: '14:00' }

function prog(o: Partial<DatiProgramma>) {
  return programmaLista({
    ordine: [],
    interrogati: {},
    perLezione: 1,
    giorni: MAR_GIO,
    subjectId: 's',
    cal,
    adesso: MATTINA,
    ...o,
  })
}
const data = (p: ReturnType<typeof prog>, uid: string) => {
  const s = p.stime.get(uid)
  return s?.tipo === 'data' ? s.data : s?.tipo
}

describe('ora di uscita', () => {
  it('prima dell\'uscita oggi conta, dopo si parte dalla lezione successiva', () => {
    expect(data(prog({ ordine: ['a', 'b'] }), 'a')).toBe('2026-11-03')
    const dopo = prog({ ordine: ['a', 'b'], adesso: POMERIGGIO })
    expect(data(dopo, 'a')).toBe('2026-11-05')
    expect(data(dopo, 'b')).toBe('2026-11-10')
  })

  it('l\'ora di uscita è quella del giorno (martedì alle 12:00)', () => {
    const presto = { ...cal, uscite: ['14:00', '12:00', '14:00', '14:00', '14:00', '14:00', '14:00'] }
    expect(data(prog({ ordine: ['a'], cal: presto, adesso: { oggi: '2026-11-03', ora: '12:30' } }), 'a')).toBe('2026-11-05')
    expect(data(prog({ ordine: ['a'], cal: presto, adesso: { oggi: '2026-11-03', ora: '11:59' } }), 'a')).toBe('2026-11-03')
  })
})

describe('giorno di creazione', () => {
  it('non conta: un\'interrogazione creata oggi parte dalla lezione dopo', () => {
    expect(data(prog({ ordine: ['a'], creata: '2026-11-03' }), 'a')).toBe('2026-11-05')
    expect(data(prog({ ordine: ['a'], creata: '2026-11-02' }), 'a')).toBe('2026-11-03')
  })
})

describe('date fisse (DSA/BES)', () => {
  it('chi ha la data fissa occupa un posto quel giorno e gli altri si adattano', () => {
    // 1 per lezione: giovedì 05/11 è di Dario, quindi b slitta a martedì 10/11
    const p = prog({ ordine: ['a', 'b', 'c'], fissi: { dario: '2026-11-05' } })
    expect(data(p, 'a')).toBe('2026-11-03')
    expect(data(p, 'dario')).toBe('2026-11-05')
    expect(data(p, 'b')).toBe('2026-11-10')
    expect(data(p, 'c')).toBe('2026-11-12')
  })

  it('con 2 per lezione resta un posto per gli altri', () => {
    const p = prog({ ordine: ['a', 'b', 'c'], perLezione: 2, fissi: { dario: '2026-11-03' } })
    expect(data(p, 'a')).toBe('2026-11-03')
    expect(data(p, 'b')).toBe('2026-11-05')
    expect(data(p, 'c')).toBe('2026-11-05')
  })

  it('se non è interrogato nel suo giorno, dall\'ora di uscita passa alla lezione dopo', () => {
    const fissi = { dario: '2026-11-03' }
    expect(data(prog({ ordine: ['a'], fissi, adesso: { oggi: '2026-11-03', ora: '13:59' } }), 'dario')).toBe('2026-11-03')
    const dopo = prog({ ordine: ['a'], fissi, adesso: { oggi: '2026-11-03', ora: '14:00' } })
    expect(data(dopo, 'dario')).toBe('2026-11-05')
    // e chi era giovedì lascia il posto
    expect(data(dopo, 'a')).toBe('2026-11-10')
    // una settimana dopo, ancora non interrogato: la prima lezione utile
    expect(data(prog({ ordine: [], fissi, adesso: { oggi: '2026-11-09', ora: '10:00' } }), 'dario')).toBe('2026-11-10')
  })

  it('una data che non è più di lezione (vacanza aggiunta) slitta alla lezione dopo', () => {
    const conVacanza = conEccezione(cal, { tipo: 'vacanza', da: '2026-11-05', a: '2026-11-05', descrizione: 'Ponte' })
    expect(data(prog({ fissi: { dario: '2026-11-05' }, cal: conVacanza }), 'dario')).toBe('2026-11-10')
  })

  it('interrogato: niente stima, e il suo posto non conta più', () => {
    const p = prog({ ordine: ['a'], fissi: { dario: '2026-11-05' }, interrogati: { dario: '2026-11-03' } })
    expect(p.stime.has('dario')).toBe(false)
    expect(data(p, 'a')).toBe('2026-11-05') // 03/11 già occupato da Dario, interrogato oggi
  })

  it('anche senza numero per lezione la data fissa si vede', () => {
    const p = prog({ ordine: ['a'], perLezione: null, fissi: { dario: '2026-11-05' } })
    expect(data(p, 'dario')).toBe('2026-11-05')
    expect(p.stime.get('a')?.tipo).toBe('non-disponibile')
  })

  it('le righe: chi ha la data fissa sta nel suo giorno, senza numero; gli altri hanno il numero della lista', () => {
    const p = prog({ ordine: ['a', 'b', 'c'], fissi: { dario: '2026-11-05', ella: '2027-01-12' } })
    expect(p.righe.map((r) => [r.uid, r.numero])).toEqual([
      ['a', 1],
      ['dario', null],
      ['b', 2],
      ['c', 3],
      ['ella', null],
    ])
    expect(p.righe.find((r) => r.uid === 'dario')?.fissa).toBe('2026-11-05')
  })

  it('interrogati in lista mantengono il loro posto nelle righe', () => {
    const p = prog({ ordine: ['a', 'b'], fissi: { dario: '2026-11-05' }, interrogati: { a: '2026-10-29' } })
    expect(p.righe.map((r) => r.uid)).toEqual(['a', 'b', 'dario'])
    expect(p.righe[0]).toMatchObject({ interrogato: '2026-10-29', stima: null })
  })
})

describe('date tra cui scegliere (DSA/BES)', () => {
  const base = { giorni: MAR_GIO, subjectId: 's', cal, adesso: MATTINA, perLezione: 2, numeroStudenti: 12 }
  it('le lezioni che servono per interrogare tutti, dal primo giorno utile', () => {
    const d = dateDisponibili(base)
    expect(d).toHaveLength(6) // 12 studenti, 2 per lezione
    expect(d[0]).toBe('2026-11-03')
    for (const x of d) expect(haLezione(x, MAR_GIO, 's', cal)).toBe(true)
  })
  it('non il giorno di creazione, non prima della scadenza (dopo l\'uscita conta il giorno dopo)', () => {
    expect(dateDisponibili({ ...base, creata: '2026-11-03' })[0]).toBe('2026-11-05')
    expect(dateDisponibili({ ...base, scadenza: { oggi: '2026-11-05', ora: '20:00' } })[0]).toBe('2026-11-10')
    expect(dateDisponibili({ ...base, scadenza: { oggi: '2026-11-05', ora: '08:00' } })[0]).toBe('2026-11-05')
  })
  it('almeno 5 date, al massimo 60; senza giorni nessuna', () => {
    expect(dateDisponibili({ ...base, numeroStudenti: 1 })).toHaveLength(5)
    expect(dateDisponibili({ ...base, perLezione: 1, numeroStudenti: 200 })).toHaveLength(60)
    expect(dateDisponibili({ ...base, giorni: [] })).toEqual([])
  })
})

describe('segnare gli interrogati con le date fisse', () => {
  it('propone prima chi aveva la data fissa fino a quel giorno, poi i primi nei posti rimasti', () => {
    const fissi = { dario: '2026-11-03', ella: '2026-11-12' }
    expect(propostaLezione(['a', 'b', 'c'], {}, 2, fissi, '2026-11-03')).toEqual(['dario', 'a'])
    expect(propostaLezione(['a', 'b', 'c'], {}, 1, fissi, '2026-11-03')).toEqual(['dario'])
    // Dario era assente martedì: giovedì è ancora proposto
    expect(propostaLezione(['a', 'b', 'c'], { a: '2026-11-03' }, 1, fissi, '2026-11-05')).toEqual(['dario'])
    expect(propostaLezione(['a', 'b'], {}, 1, {}, '2026-11-03')).toEqual(['a'])
  })
  it('conclusa solo quando sono interrogati anche quelli con la data fissa', () => {
    expect(tuttiInterrogati(['a'], { a: 'x' }, { dario: '2026-11-03' })).toBe(false)
    expect(tuttiInterrogati(['a'], { a: 'x', dario: 'y' }, { dario: '2026-11-03' })).toBe(true)
    expect(tuttiInterrogati([], {}, { dario: '2026-11-03' })).toBe(false)
  })
})

describe('a tappeto', () => {
  const caso = generatoreCasuale(1106)
  const intero = (min: number, max: number) => min + Math.floor(caso() * (max - min + 1))

  it('senza date fisse, prima dell\'uscita dà le stesse date della stima di sempre', () => {
    for (let t = 0; t < 400; t++) {
      const oggi = aggiungiGiorni('2026-09-14', intero(0, 250))
      const perLezione = intero(1, 4)
      const n = intero(0, 25)
      const ordine = Array.from({ length: n }, (_, i) => `u${i}`)
      // al massimo perLezione interrogati oggi (come succede davvero)
      const interrogati = Object.fromEntries(ordine.slice(0, intero(0, Math.min(n, perLezione))).map((u) => [u, oggi]))
      const p = prog({ ordine, interrogati, perLezione, adesso: { oggi, ora: '08:00' } })
      const mancanti = ordine.filter((u) => !interrogati[u])
      const giaOggi = Object.keys(interrogati).length
      mancanti.forEach((u, k) => {
        expect(p.stime.get(u)).toEqual(
          stimaInterrogazione({ k, perLezione, giorni: MAR_GIO, subjectId: 's', cal, da: oggi, giaInterrogatiDa: giaOggi }),
        )
      })
    }
  })

  it('ogni giorno non più di N (date fisse comprese, salvo più date fisse nello stesso giorno); chi è dopo non va prima', () => {
    for (let t = 0; t < 300; t++) {
      const perLezione = intero(1, 3)
      const ordine = Array.from({ length: intero(0, 20) }, (_, i) => `u${i}`)
      const fissi: Record<string, string> = {}
      for (let i = intero(0, 4); i > 0; i--) fissi[`d${i}`] = aggiungiGiorni('2026-11-02', intero(0, 40))
      const adesso = { oggi: aggiungiGiorni('2026-11-02', intero(0, 20)), ora: caso() < 0.5 ? '10:00' : '15:00' }
      const p = prog({ ordine, fissi, perLezione, adesso })
      const perGiorno = new Map<string, { fissi: number; altri: number }>()
      let prima = ''
      for (const u of ordine) {
        const s = p.stime.get(u)!
        if (s.tipo !== 'data') continue
        expect(s.data >= p.da).toBe(true)
        expect(s.data >= prima).toBe(true)
        prima = s.data
        const g = perGiorno.get(s.data) ?? { fissi: 0, altri: 0 }
        g.altri++
        perGiorno.set(s.data, g)
      }
      for (const u of Object.keys(fissi)) {
        const s = p.stime.get(u)!
        expect(s.tipo).toBe('data')
        if (s.tipo !== 'data') continue
        expect(s.data >= p.da && s.data >= fissi[u]!).toBe(true)
        expect(haLezione(s.data, MAR_GIO, 's', cal)).toBe(true)
        const g = perGiorno.get(s.data) ?? { fissi: 0, altri: 0 }
        g.fissi++
        perGiorno.set(s.data, g)
      }
      for (const g of perGiorno.values()) {
        if (g.altri > 0) expect(g.altri + g.fissi).toBeLessThanOrEqual(perLezione)
      }
      // tutti compaiono una volta nelle righe
      expect(p.righe.map((r) => r.uid).sort()).toEqual([...ordine, ...Object.keys(fissi)].sort())
    }
  })
})
