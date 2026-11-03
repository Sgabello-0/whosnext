import { describe, expect, it } from 'vitest'
import { aInputDataOra, daInputDataOra, formattaScadenza, scadenzaPredefinita, tempoMancante } from './formatoDate'

describe('formatoDate', () => {
  it('converte avanti e indietro per datetime-local', () => {
    const d = new Date(2026, 10, 10, 20, 5)
    expect(aInputDataOra(d)).toBe('2026-11-10T20:05')
    expect(daInputDataOra('2026-11-10T20:05')?.getTime()).toBe(d.getTime())
    expect(daInputDataOra('')).toBeNull()
  })
  it('propone domani alle 20:00', () => {
    expect(aInputDataOra(scadenzaPredefinita(new Date(2026, 10, 30, 9, 0)))).toBe('2026-12-01T20:00')
  })
  it('formatta la scadenza', () => {
    expect(formattaScadenza(new Date(2026, 10, 10, 20, 0))).toBe('mar 10/11 alle 20:00')
  })
  it('dice quanto manca', () => {
    const ora = new Date(2026, 10, 3, 12, 0)
    expect(tempoMancante(new Date(2026, 10, 3, 11, 0), ora)).toBe('scaduta')
    expect(tempoMancante(new Date(2026, 10, 3, 12, 30), ora)).toBe('tra 30 minuti')
    expect(tempoMancante(new Date(2026, 10, 3, 13, 0), ora)).toBe('tra 1 ora')
    expect(tempoMancante(new Date(2026, 10, 4, 12, 0), ora)).toBe('tra 24 ore')
    expect(tempoMancante(new Date(2026, 10, 8, 12, 0), ora)).toBe('tra 5 giorni')
  })
})
