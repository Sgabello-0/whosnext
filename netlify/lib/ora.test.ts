import { describe, expect, it } from 'vitest'
import { dataItalia, domaniItalia, oraItalia, oraMinutiItalia, scadenzaItalia } from './ora'

describe('ora italiana (il server gira in UTC)', () => {
  it('a mezzanotte italiana è già il giorno dopo, anche se in UTC no', () => {
    expect(dataItalia(new Date('2026-11-09T23:30:00Z'))).toBe('2026-11-10') // CET: 00:30
    expect(dataItalia(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02') // CEST: 00:30
    expect(domaniItalia(new Date('2026-11-09T18:00:00Z'))).toBe('2026-11-10')
  })
  it('ore e scadenze con l\'ora legale e solare', () => {
    expect(oraItalia(new Date('2026-11-09T18:00:00Z'))).toBe(19)
    expect(oraItalia(new Date('2026-07-01T18:00:00Z'))).toBe(20)
    expect(oraMinutiItalia(new Date('2026-11-04T19:00:00Z'))).toBe('20:00')
    expect(scadenzaItalia(new Date('2026-11-04T19:00:00Z'))).toBe('mer 04/11 alle 20:00')
  })
})
