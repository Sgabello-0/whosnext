import { describe, expect, it } from 'vitest'
import { CALENDARIO_DEFAULT } from './calendar'
import { caselleMese, nomiBrevi, spostaMese, vociPerGiorno } from './calendarioMese'
import type { InterrogazioneOsservata } from './daFare'

// martedì 03/11/2026 alle 10:00; lezioni martedì e giovedì, 1 per lezione
const ADESSO = { oggi: '2026-11-03', ora: '10:00' }
function interr(extra: Partial<InterrogazioneOsservata> = {}): InterrogazioneOsservata {
  return {
    chiave: 'c/s/i', classId: 'c', nomeClasse: '4ªB', subjectId: 's', nomeMateria: 'Storia', interrogazioneId: 'i', nome: 'Orale',
    stato: 'lista', giorni: [1, 3], perLezione: 1, scadenza: 0, cal: CALENDARIO_DEFAULT, mioUid: 'io', ruolo: 'studente',
    staff: false, puoModificare: false,
    nomi: { a: 'Anna Verdi', io: 'Ivo Rossi', d: 'Dario Blu' },
    lista: { ordine: ['a', 'io'], interrogati: {}, generata: '2026-11-01' },
    ...extra,
  }
}

describe('calendario del mese', () => {
  it('ogni giorno: l\'interrogazione e di chi, con segnato se c\'è chi guarda', () => {
    const g = vociPerGiorno([interr()], ADESSO)
    expect(g.get('2026-11-03')![0]).toMatchObject({ materia: 'Storia', mia: false, persone: [{ nome: 'Anna Verdi', io: false }] })
    expect(g.get('2026-11-05')![0]).toMatchObject({ mia: true, persone: [{ nome: 'Ivo Rossi', io: true }] })
  })
  it('chi ha la data fissa sta nel suo giorno; chi è già stato interrogato nel giorno in cui lo è stato', () => {
    const g = vociPerGiorno(
      [interr({ lista: { ordine: ['a', 'io'], fissi: { d: '2026-11-12' }, interrogati: { a: '2026-10-29' }, generata: null } })],
      ADESSO,
    )
    expect(g.get('2026-10-29')![0]!.persone[0]).toMatchObject({ uid: 'a', fatto: true })
    expect(g.get('2026-11-12')![0]!.persone[0]).toMatchObject({ uid: 'd', fatto: false })
    expect(g.get('2026-11-03')![0]!.persone[0]!.uid).toBe('io')
  })
  it('più persone lo stesso giorno, le mie interrogazioni per prime; niente senza lista o senza date', () => {
    const altra = interr({ chiave: 'c/s/x', nomeMateria: 'Arte', interrogazioneId: 'x', lista: { ordine: ['a'], interrogati: {}, generata: null } })
    const mia = interr({ nomeMateria: 'Storia', lista: { ordine: ['io', 'a'], interrogati: {}, generata: null }, perLezione: 2 })
    const voci = vociPerGiorno([altra, mia], ADESSO).get('2026-11-03')!
    expect(voci.map((v) => v.materia)).toEqual(['Storia', 'Arte'])
    expect(voci[0]!.persone.map((p) => p.uid)).toEqual(['io', 'a'])
    expect(vociPerGiorno([interr({ stato: 'raccolta' })], ADESSO).size).toBe(0)
    expect(vociPerGiorno([interr({ lista: undefined })], ADESSO).size).toBe(0)
    expect(vociPerGiorno([interr({ perLezione: null })], ADESSO).size).toBe(0)
  })
  it('nomi brevi: l\'iniziale del cognome solo se serve', () => {
    expect(nomiBrevi(['Anna Verdi', 'Bruno Neri'])).toEqual(['Anna', 'Bruno'])
    expect(nomiBrevi(['Anna Verdi', 'Anna Blu', 'Bruno'])).toEqual(['Anna V.', 'Anna B.', 'Bruno'])
  })
  it('caselle da lunedì e cambio mese, anche a cavallo dell\'anno', () => {
    const nov = caselleMese(2026, 10) // 1 novembre 2026 è domenica
    expect(nov.slice(0, 7)).toEqual([null, null, null, null, null, null, '2026-11-01'])
    expect(nov.filter(Boolean)).toHaveLength(30)
    expect(caselleMese(2028, 1).filter(Boolean)).toHaveLength(29)
    expect(spostaMese({ anno: 2026, mese: 11 }, 1)).toEqual({ anno: 2027, mese: 0 })
    expect(spostaMese({ anno: 2027, mese: 0 }, -1)).toEqual({ anno: 2026, mese: 11 })
  })
})
