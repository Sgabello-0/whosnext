import { describe, expect, it } from 'vitest'
import { postoPerNuovaRichiesta, richiestaInAttesa, scambiaPosizioni, validita, type Scambio } from './scambi'

const lista = { ordine: ['a', 'b', 'c', 'd'], interrogati: {} as Record<string, string> }
const richiesta = (extra: Partial<Scambio> = {}): Scambio => ({
  id: 'b_0',
  da: 'b',
  daPos: 1,
  aPos: 3,
  stato: 'attesa',
  a: null,
  ...extra,
})

describe('validita', () => {
  it('valida se chi chiede è ancora al suo posto e nessuno dei due è stato interrogato', () => {
    expect(validita(richiesta(), lista)).toBe('valida')
  })
  it('superata se chi chiede ha cambiato posto (o la posizione non esiste più)', () => {
    expect(validita(richiesta(), { ...lista, ordine: ['b', 'a', 'c', 'd'] })).toBe('superata')
    expect(validita(richiesta({ aPos: 9 }), lista)).toBe('superata')
  })
  it('la richiesta segue la posizione: conta chi la occupa adesso', () => {
    expect(validita(richiesta(), { ...lista, ordine: ['a', 'b', 'd', 'c'] })).toBe('valida')
  })
  it('interrogato se uno dei due lo è già', () => {
    expect(validita(richiesta(), { ...lista, interrogati: { d: '2026-11-03' } })).toBe('interrogato')
    expect(validita(richiesta(), { ...lista, interrogati: { b: '2026-11-03' } })).toBe('interrogato')
  })
})

describe('posti per le richieste', () => {
  it('usa il primo posto libero o chiuso', () => {
    expect(postoPerNuovaRichiesta([], 'b', lista)).toEqual({ posto: 0, daAnnullare: null })
    const mie = [richiesta({ id: 'b_0' }), richiesta({ id: 'b_1', stato: 'rifiutato' })]
    expect(postoPerNuovaRichiesta(mie, 'b', lista)).toEqual({ posto: 1, daAnnullare: null })
  })
  it('se sono tutti in attesa riusa una richiesta non più valida, altrimenti niente', () => {
    const tre = [0, 1, 2].map((n) => richiesta({ id: `b_${n}`, aPos: n === 1 ? 2 : n === 2 ? 0 : 3 }))
    expect(postoPerNuovaRichiesta(tre, 'b', lista)).toBeNull()
    const conVecchia = tre.map((s, i) => (i === 2 ? { ...s, daPos: 0 } : s))
    expect(postoPerNuovaRichiesta(conVecchia, 'b', lista)).toEqual({ posto: 2, daAnnullare: 'b_2' })
  })
  it('richiesta già fatta per quella posizione', () => {
    expect(richiestaInAttesa([richiesta()], 3, lista)?.id).toBe('b_0')
    expect(richiestaInAttesa([richiesta({ stato: 'annullato' })], 3, lista)).toBeUndefined()
  })
})

it('scambiaPosizioni scambia solo i due', () => {
  expect(scambiaPosizioni(['a', 'b', 'c', 'd'], 1, 3)).toEqual(['a', 'd', 'c', 'b'])
})
