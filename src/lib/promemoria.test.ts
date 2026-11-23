import { describe, expect, it } from 'vitest'
import { giorniPromemoria, testoPromemoria } from './promemoria'

describe('promemoria "sei interrogato"', () => {
  it('di base la sera prima; si tengono solo 1, 2 e 3, in ordine e senza doppioni', () => {
    expect(giorniPromemoria(undefined)).toEqual([1])
    expect(giorniPromemoria('3')).toEqual([1])
    expect(giorniPromemoria([3, 1, 3])).toEqual([1, 3])
    expect(giorniPromemoria([0, 4, 2.5, '2', 2])).toEqual([2])
    expect(giorniPromemoria([])).toEqual([])
  })
  it('testi', () => {
    expect(testoPromemoria(1)).toBe('1 giorno prima')
    expect(testoPromemoria(3)).toBe('3 giorni prima')
  })
})
