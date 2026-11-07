import { describe, expect, it } from 'vitest'
import { CALENDARIO_DEFAULT } from './calendar'
import {
  aggiungiInFondo,
  conDataFissa,
  nonInterrogati,
  propostaLezione,
  senzaEsclusi,
  sposta,
  spostati,
  statoInLista,
  stessiElementi,
  togliDallaLista,
  tuttiInterrogati,
  ultimaLezione,
} from './lista'

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

describe('spostati', () => {
  it('trascinando un nome registra solo quello', () => {
    expect(spostati(ordine, sposta(ordine, 0, 3))).toEqual([{ uid: 'a', da: 1, a: 4 }])
    expect(spostati(ordine, sposta(ordine, 4, 0))).toEqual([{ uid: 'e', da: 5, a: 1 }])
  })
  it('nessuno se l\'ordine non cambia', () => {
    expect(spostati(ordine, [...ordine])).toEqual([])
  })
  it('più spostamenti', () => {
    // a ↔ e: restano fermi b, c, d
    const r = spostati(ordine, ['e', 'b', 'c', 'd', 'a'])
    expect(r).toEqual([
      { uid: 'e', da: 5, a: 1 },
      { uid: 'a', da: 1, a: 5 },
    ])
  })
  it('lista invertita: si spostano tutti tranne uno', () => {
    expect(spostati(ordine, [...ordine].reverse())).toHaveLength(4)
  })
})

describe('imprevisti', () => {
  const c = { ordine: ['a', 'b', 'c'], fissi: { d: '2026-11-10' }, interrogati: { a: '2026-11-03' } }
  it('aggiungi in fondo: da fuori, o togliendo la data fissa; chi è già in ordine resta dov\'è', () => {
    expect(aggiungiInFondo(c, 'e')).toEqual({ ...c, ordine: ['a', 'b', 'c', 'e'] })
    expect(aggiungiInFondo(c, 'd')).toEqual({ ...c, ordine: ['a', 'b', 'c', 'd'], fissi: {} })
    expect(aggiungiInFondo(c, 'b')).toBe(c)
  })
  it('data fissa: esce dall\'ordine; cambiarla la sostituisce', () => {
    expect(conDataFissa(c, 'b', '2026-11-12')).toEqual({ ...c, ordine: ['a', 'c'], fissi: { d: '2026-11-10', b: '2026-11-12' } })
    expect(conDataFissa(c, 'd', '2026-11-17').fissi).toEqual({ d: '2026-11-17' })
    expect(conDataFissa(c, 'e', '2026-11-17').ordine).toEqual(['a', 'b', 'c'])
  })
  it('togli: niente posto, niente data, niente segno di interrogato', () => {
    expect(togliDallaLista(c, 'a')).toEqual({ ordine: ['b', 'c'], fissi: { d: '2026-11-10' }, interrogati: {} })
    expect(togliDallaLista(c, 'd')).toEqual({ ...c, fissi: {} })
    expect(togliDallaLista(c, 'zz')).toEqual(c)
  })
  it('dove si trova ognuno', () => {
    expect(['a', 'd', 'e'].map((u) => statoInLista(c, u))).toEqual(['ordine', 'fissa', 'fuori'])
  })
  it('qualunque sequenza di imprevisti: mai doppioni, mai in ordine e con data insieme', () => {
    let x = { ordine: ['u0', 'u1', 'u2'], fissi: {} as Record<string, string>, interrogati: {} as Record<string, string> }
    let seme = 7
    const caso = () => (seme = (seme * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
    for (let t = 0; t < 3000; t++) {
      const u = `u${Math.floor(caso() * 6)}`
      const k = caso()
      x = k < 0.33 ? aggiungiInFondo(x, u) : k < 0.66 ? conDataFissa(x, u, '2026-11-10') : togliDallaLista(x, u)
      expect(new Set(x.ordine).size).toBe(x.ordine.length)
      for (const f of Object.keys(x.fissi)) expect(x.ordine).not.toContain(f)
    }
  })
  it('esclusi: tolti, il resto nell\'ordine dato', () => {
    expect(senzaEsclusi(['a', 'b', 'c'], ['b', 'x'])).toEqual(['a', 'c'])
    expect(senzaEsclusi(['a'], undefined)).toEqual(['a'])
  })
})
