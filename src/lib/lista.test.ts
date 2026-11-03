import { describe, expect, it } from 'vitest'
import { CALENDARIO_DEFAULT } from './calendar'
import { nonInterrogati, propostaLezione, sposta, stessiElementi, tuttiInterrogati, ultimaLezione } from './lista'

const ordine = ['a', 'b', 'c', 'd', 'e']

describe('lista', () => {
  it('trova chi non è ancora stato interrogato, in ordine', () => {
    expect(nonInterrogati(ordine, { b: '2026-11-03', d: '2026-11-05' })).toEqual(['a', 'c', 'e'])
  })

  it('propone i primi N non interrogati per la lezione', () => {
    expect(propostaLezione(ordine, {}, 2)).toEqual(['a', 'b'])
    expect(propostaLezione(ordine, { a: '2026-11-03' }, 2)).toEqual(['b', 'c'])
    expect(propostaLezione(ordine, {}, null)).toEqual(['a'])
    expect(propostaLezione(ordine, { a: 'x', b: 'x', c: 'x', d: 'x' }, 3)).toEqual(['e'])
  })

  it('chi era assente resta in testa ai non interrogati', () => {
    // proposti a e b; b assente → si segna solo a
    const interrogati = { a: '2026-11-03' }
    expect(propostaLezione(ordine, interrogati, 2)).toEqual(['b', 'c'])
  })

  it('sposta un elemento come trascinandolo', () => {
    expect(sposta(ordine, 0, 2)).toEqual(['b', 'c', 'a', 'd', 'e'])
    expect(sposta(ordine, 4, 0)).toEqual(['e', 'a', 'b', 'c', 'd'])
    expect(sposta(ordine, 1, 1)).toEqual(ordine)
    expect(sposta(ordine, -1, 2)).toEqual(ordine)
    expect(sposta(ordine, 0, 9)).toEqual(ordine)
    expect(ordine).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('controlla che un riordino non perda né aggiunga nessuno', () => {
    expect(stessiElementi(ordine, ['e', 'd', 'c', 'b', 'a'])).toBe(true)
    expect(stessiElementi(ordine, ['a', 'b', 'c', 'd'])).toBe(false)
    expect(stessiElementi(ordine, ['a', 'a', 'c', 'd', 'e'])).toBe(false)
    expect(stessiElementi(ordine, ['a', 'b', 'c', 'd', 'x'])).toBe(false)
  })

  it('trova l\'ultima lezione fino a oggi', () => {
    // martedì e giovedì; mercoledì 04/11 → martedì 03/11
    expect(ultimaLezione([1, 3], 'mat', CALENDARIO_DEFAULT, '2026-11-04')).toBe('2026-11-03')
    expect(ultimaLezione([1, 3], 'mat', CALENDARIO_DEFAULT, '2026-11-05')).toBe('2026-11-05')
    // solo martedì; mercoledì 09/12: martedì 08/12 è l'Immacolata → martedì 01/12
    expect(ultimaLezione([1], 'mat', CALENDARIO_DEFAULT, '2026-12-09')).toBe('2026-12-01')
    expect(ultimaLezione([], 'mat', CALENDARIO_DEFAULT, '2026-11-04')).toBeNull()
  })

  it('sa quando sono stati interrogati tutti', () => {
    expect(tuttiInterrogati(['a', 'b'], { a: 'x', b: 'x' })).toBe(true)
    expect(tuttiInterrogati(['a', 'b'], { a: 'x' })).toBe(false)
    expect(tuttiInterrogati([], {})).toBe(false)
  })
})
