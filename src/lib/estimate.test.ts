import { describe, expect, it } from 'vitest'
import { CALENDARIO_DEFAULT, type Calendario } from './calendar'
import { stimaInterrogazione, testoStima } from './estimate'

const MAR_GIO = [1, 3]
const base = { subjectId: 'mat', cal: CALENDARIO_DEFAULT as Calendario, da: '2026-11-03' }

describe('stimaInterrogazione', () => {
  it('con giorni e numero per lezione dà la data', () => {
    expect(stimaInterrogazione({ ...base, k: 0, perLezione: 2, giorni: MAR_GIO })).toEqual({ tipo: 'data', data: '2026-11-03' })
    expect(stimaInterrogazione({ ...base, k: 1, perLezione: 2, giorni: MAR_GIO })).toEqual({ tipo: 'data', data: '2026-11-03' })
    expect(stimaInterrogazione({ ...base, k: 2, perLezione: 2, giorni: MAR_GIO })).toEqual({ tipo: 'data', data: '2026-11-05' })
    expect(stimaInterrogazione({ ...base, k: 5, perLezione: 2, giorni: MAR_GIO })).toEqual({ tipo: 'data', data: '2026-11-10' })
  })
  it('conta solo le lezioni valide (salta l\'8 dicembre)', () => {
    const s = stimaInterrogazione({ ...base, da: '2026-12-07', k: 1, perLezione: 1, giorni: MAR_GIO })
    expect(s).toEqual({ tipo: 'data', data: '2026-12-15' })
  })
  it('senza giorni dice tra quante lezioni', () => {
    expect(stimaInterrogazione({ ...base, k: 0, perLezione: 3, giorni: [] })).toEqual({ tipo: 'lezioni', tra: 1 })
    expect(stimaInterrogazione({ ...base, k: 3, perLezione: 3, giorni: [] })).toEqual({ tipo: 'lezioni', tra: 2 })
  })
  it('senza numero per lezione: stima non disponibile, con la prossima lezione se ci sono i giorni', () => {
    expect(stimaInterrogazione({ ...base, k: 4, perLezione: null, giorni: MAR_GIO })).toEqual({
      tipo: 'non-disponibile',
      prossimaLezione: '2026-11-03',
    })
    expect(stimaInterrogazione({ ...base, k: 4, perLezione: null, giorni: [] })).toEqual({
      tipo: 'non-disponibile',
      prossimaLezione: null,
    })
  })
  it('oltre il 06/06/2027', () => {
    expect(stimaInterrogazione({ ...base, da: '2027-06-01', k: 10, perLezione: 2, giorni: MAR_GIO })).toEqual({
      tipo: 'oltre-fine-anno',
    })
  })
})

describe('testoStima', () => {
  it('usa le frasi del piano', () => {
    expect(testoStima({ tipo: 'data', data: '2026-11-03' })).toBe('Stimata: Martedì 03/11')
    expect(testoStima({ tipo: 'lezioni', tra: 1 })).toBe('Tra 1 lezione')
    expect(testoStima({ tipo: 'lezioni', tra: 2 })).toBe('Tra 2 lezioni')
    expect(testoStima({ tipo: 'non-disponibile', prossimaLezione: null })).toBe('Stima non disponibile')
    expect(testoStima({ tipo: 'non-disponibile', prossimaLezione: '2026-11-03' })).toBe(
      'Stima non disponibile · Prossima lezione: Martedì 03/11',
    )
    expect(testoStima({ tipo: 'oltre-fine-anno' })).toBe("Oltre la fine dell'anno")
  })
})
