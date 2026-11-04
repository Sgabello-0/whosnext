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
  it('una sola richiesta aperta: il posto è libero se non c\'è o è chiusa', () => {
    expect(postoPerNuovaRichiesta([], 'b', lista)).toEqual({ posto: 0, daAnnullare: null })
    expect(postoPerNuovaRichiesta([richiesta({ stato: 'rifiutato' })], 'b', lista)).toEqual({ posto: 0, daAnnullare: null })
    expect(postoPerNuovaRichiesta([richiesta()], 'b', lista)).toBeNull()
  })
  it('una richiesta in attesa non più valida si sostituisce', () => {
    expect(postoPerNuovaRichiesta([richiesta({ daPos: 0 })], 'b', lista)).toEqual({ posto: 0, daAnnullare: 'b_0' })
  })
  it('richiesta già fatta per quella posizione', () => {
    expect(richiestaInAttesa([richiesta()], 3, lista)?.id).toBe('b_0')
    expect(richiestaInAttesa([richiesta({ stato: 'annullato' })], 3, lista)).toBeUndefined()
  })
})

it('scambiaPosizioni scambia solo i due', () => {
  expect(scambiaPosizioni(['a', 'b', 'c', 'd'], 1, 3)).toEqual(['a', 'd', 'c', 'b'])
})
