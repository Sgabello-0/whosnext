import { describe, expect, it } from 'vitest'
import { calendarioDa, type Calendario } from './calendar'
import { programmaLista, type DatiProgramma } from './programma'
import { assenzaInRitardo, chiSiSposta, dateAssenza, giorniAssenza, primaDataLibera } from './spostamenti'

const cal: Calendario = { ...calendarioDa({ giorniScolastici: [true, true, true, true, true, true, false], eccezioni: [], fineAnno: '2027-06-06' }) }
// lunedì 09/11/2026 di mattina; lezioni il martedì (10, 17, 24) e il giovedì (12, 19, 26)
const base: DatiProgramma = {
  ordine: ['a', 'b', 'c', 'd'],
  fissi: {},
  interrogati: {},
  perLezione: 1,
  giorni: [1, 3],
  subjectId: 's',
  cal,
  adesso: { oggi: '2026-11-09', ora: '08:00' },
}

describe('termine per dire "non ci sarò"', () => {
  it('di base 2 giorni; valori strani tornano al default', () => {
    expect(giorniAssenza(undefined)).toBe(2)
    expect(giorniAssenza(-1)).toBe(2)
    expect(giorniAssenza(1.5)).toBe(2)
    expect(giorniAssenza(99)).toBe(2)
    expect(giorniAssenza(0)).toBe(0)
    expect(giorniAssenza(5)).toBe(5)
  })
  it('con 2 giorni il giorno prima è già in ritardo', () => {
    expect(assenzaInRitardo('2026-11-10', '2026-11-12', 2)).toBe(false)
    expect(assenzaInRitardo('2026-11-11', '2026-11-12', 2)).toBe(true)
    expect(assenzaInRitardo('2026-11-12', '2026-11-12', 0)).toBe(false)
  })
})

describe('dateAssenza', () => {
  it('con le date calcolate, solo la propria', () => expect(dateAssenza(base, 'b')).toEqual(['2026-11-12']))
  it('senza numero per lezione, le prossime lezioni', () => {
    expect(dateAssenza({ ...base, perLezione: null }, 'b', 2)).toEqual(['2026-11-10', '2026-11-12'])
  })
  it('oltre la fine dell\'anno niente', () => {
    expect(dateAssenza({ ...base, cal: { ...cal, fineAnno: '2026-11-10' } }, 'c')).toEqual([])
  })
})

describe('primaDataLibera', () => {
  it('la lezione dopo', () => expect(primaDataLibera(base, 'b', '2026-11-12')).toBe('2026-11-17'))
  it('salta le lezioni già piene di date fisse', () => {
    expect(primaDataLibera({ ...base, fissi: { x: '2026-11-17' } }, 'b', '2026-11-12')).toBe('2026-11-19')
  })
  it('la propria data fissa non occupa il posto', () => {
    expect(primaDataLibera({ ...base, fissi: { b: '2026-11-17' } }, 'b', '2026-11-12')).toBe('2026-11-17')
  })
  it('nessuna lezione rimasta', () => {
    expect(primaDataLibera({ ...base, cal: { ...cal, fineAnno: '2026-11-12' } }, 'b', '2026-11-12')).toBeNull()
  })
})

describe('chiSiSposta', () => {
  const con = (o: Partial<DatiProgramma>) => programmaLista({ ...base, ...o })

  it('"non ci sarò": solo chi finisce sopra di lui', () => {
    const prima = con({ perLezione: 2 })
    // a, b il 10; c, d il 12. Il primo assente passa al 12: b resta, c sale al 10, d resta dopo di lui
    const dopo = con({ perLezione: 2, ordine: ['b', 'c', 'd'], fissi: { a: '2026-11-12' } })
    expect(chiSiSposta({ tipo: 'assenza', uid: 'a', chi: 'a', prima, dopo })).toEqual(['b', 'c'])
  })
  it('"ha saltato": come sopra, e lo sa anche lui (se non l\'ha segnato da solo)', () => {
    const prima = con({ perLezione: 2 })
    const dopo = con({ perLezione: 2, ordine: ['b', 'c', 'd'], fissi: { a: '2026-11-12' } })
    expect(chiSiSposta({ tipo: 'saltato', uid: 'a', chi: 'z', prima, dopo })).toEqual(['b', 'c', 'a'])
    expect(chiSiSposta({ tipo: 'saltato', uid: 'a', chi: 'a', prima, dopo })).toEqual(['b', 'c'])
  })
  it('modifica della lista: tutti quelli che cambiano posto, tranne chi la fa', () => {
    const prima = con({})
    const dopo = con({ ordine: ['c', 'a', 'b', 'd'] })
    expect(chiSiSposta({ tipo: 'riordino', chi: 'z', prima, dopo }).sort()).toEqual(['a', 'b', 'c'])
    expect(chiSiSposta({ tipo: 'riordino', chi: 'a', prima, dopo }).sort()).toEqual(['b', 'c'])
  })
  it('chi esce dalla lista e chi è già stato interrogato', () => {
    const interrogati = { a: '2026-11-03' }
    const prima = con({ interrogati })
    const dopo = con({ interrogati, ordine: ['a', 'c', 'd'] })
    expect(chiSiSposta({ tipo: 'tolto', uid: 'b', chi: 'z', prima, dopo }).sort()).toEqual(['b', 'c', 'd'])
  })
  it('nessun cambiamento, nessun avviso', () => {
    expect(chiSiSposta({ tipo: 'riordino', chi: 'z', prima: con({}), dopo: con({}) })).toEqual([])
  })
})
