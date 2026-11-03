import { describe, expect, it } from 'vitest'
import {
  aggiungiGiorni,
  CALENDARIO_DEFAULT,
  calendarioDa,
  calendarioIniziale,
  conEccezione,
  dataValida,
  erroreCalendario,
  erroreEccezione,
  festaNazionale,
  festeTra,
  formattaGiorno,
  giornoDiScuola,
  giornoSettimana,
  haLezione,
  motivoNoScuola,
  oggiISO,
  pasqua,
  prossimeLezioni,
  senzaEccezione,
  vacanzeEmiliaRomagna,
  vacanzeRegionaliMancanti,
  type Calendario,
} from './calendar'

const MAR_GIO = [1, 3] // martedì e giovedì

function cal(extra: Partial<Calendario> = {}): Calendario {
  return { ...CALENDARIO_DEFAULT, ...extra }
}

describe('date', () => {
  it('riconosce il giorno della settimana (0 = lunedì)', () => {
    expect(giornoSettimana('2026-11-02')).toBe(0)
    expect(giornoSettimana('2026-11-03')).toBe(1)
    expect(giornoSettimana('2026-11-08')).toBe(6)
  })
  it('formatta come nel piano', () => {
    expect(formattaGiorno('2026-11-03')).toBe('Martedì 03/11')
  })
  it('somma i giorni attraversando mesi, anni e il cambio dell\'ora', () => {
    expect(aggiungiGiorni('2026-12-31', 1)).toBe('2027-01-01')
    expect(aggiungiGiorni('2027-03-27', 2)).toBe('2027-03-29')
    expect(aggiungiGiorni('2026-10-24', 2)).toBe('2026-10-26')
    expect(aggiungiGiorni('2027-02-28', 1)).toBe('2027-03-01')
  })
  it('valida le date', () => {
    expect(dataValida('2027-02-28')).toBe(true)
    expect(dataValida('2027-02-29')).toBe(false)
    expect(dataValida('2028-02-29')).toBe(true)
    expect(dataValida('2027-13-01')).toBe(false)
    expect(dataValida('3/11/2026')).toBe(false)
  })
  it('oggi è in ora locale', () => {
    expect(oggiISO(new Date(2026, 10, 3, 23, 59))).toBe('2026-11-03')
    expect(oggiISO(new Date(2026, 10, 4, 0, 1))).toBe('2026-11-04')
  })
})

describe('feste nazionali', () => {
  it('calcola la Pasqua', () => {
    expect(pasqua(2024)).toBe('2024-03-31')
    expect(pasqua(2025)).toBe('2025-04-20')
    expect(pasqua(2026)).toBe('2026-04-05')
    expect(pasqua(2027)).toBe('2027-03-28')
    expect(pasqua(2028)).toBe('2028-04-16')
  })
  it('contiene tutte le feste 2026-27 del piano', () => {
    const date = festeTra('2026-09-01', '2027-06-30').map((f) => f.data)
    for (const d of [
      '2026-11-01', '2026-12-08', '2026-12-25', '2026-12-26', '2027-01-01', '2027-01-06',
      '2027-03-28', '2027-03-29', '2027-04-25', '2027-05-01', '2027-06-02',
    ]) {
      expect(date).toContain(d)
    }
  })
  it('include San Francesco (4 ottobre) dal 2026', () => {
    expect(festaNazionale('2026-10-04')).toBe("San Francesco d'Assisi")
    expect(festaNazionale('2025-10-04')).toBeNull()
  })
  it('un giorno normale non è festa', () => {
    expect(festaNazionale('2026-11-03')).toBeNull()
  })
})

describe('giorni di scuola', () => {
  it('di default si va a scuola dal lunedì al venerdì', () => {
    expect(giornoDiScuola('2026-11-06', cal())).toBe(true) // venerdì
    expect(giornoDiScuola('2026-11-07', cal())).toBe(false) // sabato
    expect(giornoDiScuola('2026-11-08', cal())).toBe(false) // domenica
  })
  it('il sabato si può attivare', () => {
    expect(giornoDiScuola('2026-11-07', cal({ giorniScolastici: [true, true, true, true, true, true, false] }))).toBe(true)
  })
  it('le feste nazionali non sono di scuola', () => {
    expect(motivoNoScuola('2026-12-08', cal())).toBe('Immacolata Concezione')
  })
  it('le vacanze (estremi inclusi) non sono di scuola', () => {
    const c = cal({ eccezioni: [{ tipo: 'vacanza', da: '2026-12-23', a: '2027-01-06', descrizione: 'Vacanze di Natale' }] })
    expect(motivoNoScuola('2026-12-23', c)).toBe('Vacanze di Natale')
    expect(motivoNoScuola('2026-12-30', c)).toBe('Vacanze di Natale')
    expect(giornoDiScuola('2027-01-06', c)).toBe(false)
    expect(giornoDiScuola('2027-01-07', c)).toBe(true)
    expect(giornoDiScuola('2026-12-22', c)).toBe(true)
  })
})

describe('lezioni di una materia', () => {
  it('prossime lezioni il martedì e il giovedì, oggi compreso', () => {
    expect(prossimeLezioni({ giorni: MAR_GIO, subjectId: 'mat', cal: cal(), da: '2026-11-03', quante: 4 })).toEqual([
      '2026-11-03', '2026-11-05', '2026-11-10', '2026-11-12',
    ])
  })
  it('salta le feste (8 dicembre è martedì)', () => {
    expect(prossimeLezioni({ giorni: MAR_GIO, subjectId: 'mat', cal: cal(), da: '2026-12-07', quante: 2 })).toEqual([
      '2026-12-10', '2026-12-15',
    ])
  })
  it('salta le vacanze', () => {
    const c = cal({ eccezioni: [{ tipo: 'vacanza', da: '2026-12-23', a: '2027-01-06', descrizione: 'Natale' }] })
    expect(prossimeLezioni({ giorni: MAR_GIO, subjectId: 'mat', cal: c, da: '2026-12-21', quante: 2 })).toEqual([
      '2026-12-22', '2027-01-07',
    ])
  })
  it('una materia di sabato non ha lezione se il sabato non c\'è scuola', () => {
    expect(haLezione('2026-11-07', [5], 'mat', cal())).toBe(false)
  })
  it('lezioni extra e annullate valgono solo per la loro materia', () => {
    const c = cal({
      eccezioni: [
        { tipo: 'lezione-extra', data: '2026-11-04', subjectId: 'mat' }, // mercoledì
        { tipo: 'lezione-annullata', data: '2026-11-05', subjectId: 'mat' }, // giovedì
        { tipo: 'lezione-extra', data: '2026-11-06', subjectId: 'ita' },
      ],
    })
    expect(prossimeLezioni({ giorni: MAR_GIO, subjectId: 'mat', cal: c, da: '2026-11-03', quante: 3 })).toEqual([
      '2026-11-03', '2026-11-04', '2026-11-10',
    ])
    expect(haLezione('2026-11-05', [3], 'ita', c)).toBe(true) // l'annullamento di mat non tocca ita
  })
  it('una lezione extra vale anche in un giorno senza scuola (la decide il capoclasse)', () => {
    const c = cal({ eccezioni: [{ tipo: 'lezione-extra', data: '2026-11-07', subjectId: 'mat' }] })
    expect(haLezione('2026-11-07', MAR_GIO, 'mat', c)).toBe(true)
  })
  it('una materia senza giorni ha solo le lezioni extra', () => {
    const c = cal({ eccezioni: [{ tipo: 'lezione-extra', data: '2026-11-20', subjectId: 'mat' }] })
    expect(prossimeLezioni({ giorni: [], subjectId: 'mat', cal: c, da: '2026-11-03', quante: 3 })).toEqual(['2026-11-20'])
    expect(prossimeLezioni({ giorni: [], subjectId: 'mat', cal: cal(), da: '2026-11-03', quante: 3 })).toEqual([])
  })
  it('si ferma alla fine dell\'anno (06/06/2027)', () => {
    expect(prossimeLezioni({ giorni: MAR_GIO, subjectId: 'mat', cal: cal(), da: '2027-06-01', quante: 5 })).toEqual([
      '2027-06-01', '2027-06-03',
    ])
    expect(haLezione('2027-06-08', MAR_GIO, 'mat', cal())).toBe(false)
  })
})

describe('calendarioDa', () => {
  it('se il documento non c\'è propone il calendario iniziale (con le vacanze regionali)', () => {
    expect(calendarioDa(null)).toEqual(calendarioIniziale())
    expect(calendarioDa(null).eccezioni).toHaveLength(3)
  })
  it('corregge i campi non validi', () => {
    expect(calendarioDa({ giorniScolastici: [true], fineAnno: 'boh' })).toEqual(CALENDARIO_DEFAULT)
  })
  it('mantiene i campi validi', () => {
    const c = calendarioDa({ giorniScolastici: [true, true, true, true, true, true, false], fineAnno: '2027-06-10' })
    expect(c.giorniScolastici[5]).toBe(true)
    expect(c.fineAnno).toBe('2027-06-10')
  })
})


describe('validazione e modifica delle eccezioni', () => {
  it('controlla le vacanze', () => {
    expect(erroreEccezione({ tipo: 'vacanza', da: '2026-12-23', a: '2027-01-06', descrizione: 'Natale' })).toBeNull()
    expect(erroreEccezione({ tipo: 'vacanza', da: '2027-01-06', a: '2026-12-23', descrizione: '' })).toMatch(/prima/)
    expect(erroreEccezione({ tipo: 'vacanza', da: '2026-02-30', a: '2026-03-01', descrizione: '' })).toMatch(/non valide/)
    expect(erroreEccezione({ tipo: 'vacanza', da: '2026-12-23', a: '2026-12-24', descrizione: 'x'.repeat(61) })).toMatch(/lunga/)
  })
  it('controlla le lezioni extra e annullate', () => {
    expect(erroreEccezione({ tipo: 'lezione-extra', data: '2026-11-04', subjectId: 'mat' })).toBeNull()
    expect(erroreEccezione({ tipo: 'lezione-extra', data: '2026-11-04', subjectId: '' })).toMatch(/materia/)
  })
  it('controlla il calendario intero', () => {
    expect(erroreCalendario(CALENDARIO_DEFAULT)).toBeNull()
    expect(erroreCalendario({ ...CALENDARIO_DEFAULT, fineAnno: '2027-06-31' })).toMatch(/fine anno/)
    expect(
      erroreCalendario({ ...CALENDARIO_DEFAULT, eccezioni: [{ tipo: 'lezione-extra', data: 'x', subjectId: 'a' }] }),
    ).toMatch(/non valida/)
  })
  it('aggiunge in ordine di data e senza doppioni', () => {
    let c = conEccezione(CALENDARIO_DEFAULT, { tipo: 'vacanza', da: '2027-03-25', a: '2027-03-30', descrizione: ' Pasqua ' })
    c = conEccezione(c, { tipo: 'lezione-extra', data: '2026-11-04', subjectId: 'mat' })
    c = conEccezione(c, { tipo: 'lezione-extra', data: '2026-11-04', subjectId: 'mat' })
    expect(c.eccezioni).toEqual([
      { tipo: 'lezione-extra', data: '2026-11-04', subjectId: 'mat' },
      { tipo: 'vacanza', da: '2027-03-25', a: '2027-03-30', descrizione: 'Pasqua' },
    ])
  })
  it('extra e annullata nello stesso giorno per la stessa materia si escludono', () => {
    let c = conEccezione(CALENDARIO_DEFAULT, { tipo: 'lezione-extra', data: '2026-11-04', subjectId: 'mat' })
    c = conEccezione(c, { tipo: 'lezione-annullata', data: '2026-11-04', subjectId: 'mat' })
    c = conEccezione(c, { tipo: 'lezione-extra', data: '2026-11-04', subjectId: 'ita' })
    expect(c.eccezioni).toEqual([
      { tipo: 'lezione-annullata', data: '2026-11-04', subjectId: 'mat' },
      { tipo: 'lezione-extra', data: '2026-11-04', subjectId: 'ita' },
    ])
  })
  it('toglie un\'eccezione', () => {
    const v = { tipo: 'vacanza', da: '2027-03-25', a: '2027-03-30', descrizione: 'Pasqua' } as const
    const c = conEccezione(CALENDARIO_DEFAULT, v)
    expect(senzaEccezione(c, v).eccezioni).toEqual([])
  })
})

describe('vacanze dell\'Emilia-Romagna', () => {
  it('2026-27 come nella delibera regionale', () => {
    expect(vacanzeEmiliaRomagna(2026)).toEqual([
      { tipo: 'vacanza', da: '2026-11-02', a: '2026-11-02', descrizione: 'Commemorazione dei defunti' },
      { tipo: 'vacanza', da: '2026-12-24', a: '2027-01-06', descrizione: 'Vacanze di Natale' },
      { tipo: 'vacanza', da: '2027-03-25', a: '2027-03-30', descrizione: 'Vacanze di Pasqua' },
    ])
  })
  it('Pasqua: dal giovedì prima al martedì dopo, anche negli anni seguenti', () => {
    const pasqua2028 = vacanzeEmiliaRomagna(2027).find((v) => v.descrizione === 'Vacanze di Pasqua')
    expect(pasqua2028).toMatchObject({ da: '2028-04-13', a: '2028-04-18' }) // Pasqua 16/04/2028
    expect(giornoSettimana(pasqua2028!.da)).toBe(3) // giovedì
    expect(giornoSettimana(pasqua2028!.a)).toBe(1) // martedì
  })
  it('il calendario iniziale salta Natale e Pasqua', () => {
    const c = calendarioIniziale()
    expect(prossimeLezioni({ giorni: MAR_GIO, subjectId: 'mat', cal: c, da: '2026-12-22', quante: 2 })).toEqual([
      '2026-12-22', '2027-01-07',
    ])
    expect(prossimeLezioni({ giorni: MAR_GIO, subjectId: 'mat', cal: c, da: '2027-03-23', quante: 2 })).toEqual([
      '2027-03-23', '2027-04-01',
    ])
  })
  it('trova le vacanze regionali che mancano', () => {
    expect(vacanzeRegionaliMancanti(CALENDARIO_DEFAULT)).toHaveLength(3)
    expect(vacanzeRegionaliMancanti(calendarioIniziale())).toHaveLength(0)
  })
})
