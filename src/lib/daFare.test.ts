import { describe, expect, it } from 'vitest'
import { CALENDARIO_DEFAULT } from './calendar'
import { confrontaDaFare, confrontaMie, voceMia, vociDaFare, type InterrogazioneOsservata } from './daFare'

// martedì 03/11/2026 alle 10:00
const ADESSO = new Date(2026, 10, 3, 10, 0)
const DOMANI = new Date(2026, 10, 4, 20, 0).getTime()
const IERI = new Date(2026, 10, 2, 20, 0).getTime()

function interr(extra: Partial<InterrogazioneOsservata> = {}): InterrogazioneOsservata {
  return {
    chiave: 'c/s/i',
    classId: 'c',
    nomeClasse: '4ªB',
    subjectId: 's',
    nomeMateria: 'Storia',
    interrogazioneId: 'i',
    nome: 'Orale',
    stato: 'raccolta',
    giorni: [1, 3], // martedì e giovedì
    perLezione: 1,
    scadenza: DOMANI,
    cal: CALENDARIO_DEFAULT,
    mioUid: 'io',
    ruolo: 'studente',
    staff: false,
    puoModificare: false,
    ...extra,
  }
}

const lista = (ordine: string[], interrogati: Record<string, string> = {}, generata = '2026-11-02') => ({
  ordine,
  interrogati,
  generata,
})

describe('voceMia', () => {
  it('da scegliere finché non ho scelto e la scadenza non è passata', () => {
    expect(voceMia(interr({ miaScelta: null }), ADESSO)).toEqual({ tipo: 'da-scegliere', scadenza: DOMANI })
    expect(voceMia(interr({ miaScelta: { scelta: 'fine', dataDSA: null } }), ADESSO)).toMatchObject({
      tipo: 'scelta',
      scelta: 'fine',
    })
    expect(voceMia(interr({ miaScelta: null, scadenza: IERI }), ADESSO)).toEqual({ tipo: 'attesa-lista' })
  })

  it('niente finché la mia preferenza non è stata letta, e niente per i docenti in raccolta', () => {
    expect(voceMia(interr(), ADESSO)).toBeNull()
    expect(voceMia(interr({ ruolo: 'docente', miaScelta: null }), ADESSO)).toBeNull()
  })

  it('in lista: posizione e data stimata', () => {
    const v = voceMia(interr({ stato: 'lista', lista: lista(['a', 'io', 'b']) }), ADESSO)
    expect(v).toMatchObject({ tipo: 'in-lista', posizione: 2, totale: 3, testo: 'Stimata: Giovedì 05/11' })
  })

  it('la stima conta chi è già stato interrogato oggi', () => {
    const v = voceMia(interr({ stato: 'lista', lista: lista(['a', 'io', 'b'], { a: '2026-11-03' }) }), ADESSO)
    expect(v).toMatchObject({ tipo: 'in-lista', testo: 'Stimata: Giovedì 05/11' })
  })

  it('nascosta se sono già stato interrogato o non sono in lista', () => {
    expect(voceMia(interr({ stato: 'lista', lista: lista(['io'], { io: '2026-11-03' }) }), ADESSO)).toBeNull()
    expect(voceMia(interr({ stato: 'lista', lista: lista(['a']) }), ADESSO)).toBeNull()
  })

  it('i docenti vedono quanti sono stati interrogati', () => {
    const v = voceMia(interr({ ruolo: 'docente', stato: 'lista', lista: lista(['a', 'b', 'c'], { a: 'x' }) }), ADESSO)
    expect(v).toEqual({ tipo: 'docente-lista', interrogati: 1, totale: 3 })
  })
})

describe('vociDaFare', () => {
  const capo = { ruolo: 'capo' as const, staff: true, puoModificare: true }

  it('genera la lista quando le preferenze sono chiuse', () => {
    expect(vociDaFare(interr({ ...capo, scadenza: IERI }), ADESSO)).toEqual([{ tipo: 'genera' }])
  })

  it('prima della scadenza: quanti hanno scelto, se ne manca qualcuno', () => {
    expect(vociDaFare(interr({ ...capo, risposte: 3, numeroStudenti: 5 }), ADESSO)).toEqual([
      { tipo: 'risposte', risposte: 3, totale: 5, scadenza: DOMANI },
    ])
    expect(vociDaFare(interr({ ...capo, risposte: 5, numeroStudenti: 5 }), ADESSO)).toEqual([])
  })

  it('dopo una lezione propone di segnare gli interrogati (una volta sola)', () => {
    const d = interr({ ...capo, stato: 'lista', lista: lista(['a', 'b'], {}, '2026-11-01') })
    expect(vociDaFare(d, ADESSO)).toEqual([{ tipo: 'segna', data: '2026-11-03' }])
    // mercoledì: la lezione da segnare è quella di martedì
    expect(vociDaFare(d, new Date(2026, 10, 4, 9, 0))).toEqual([{ tipo: 'segna', data: '2026-11-03' }])
    // già segnato qualcuno quel giorno: niente
    const fatto = interr({ ...capo, stato: 'lista', lista: lista(['a', 'b'], { a: '2026-11-03' }, '2026-11-01') })
    expect(vociDaFare(fatto, ADESSO)).toEqual([])
  })

  it('non propone lezioni precedenti alla generazione della lista', () => {
    // lista generata mercoledì 04/11: la lezione di martedì 03/11 non conta
    const d = interr({ ...capo, stato: 'lista', lista: lista(['a'], {}, '2026-11-04') })
    expect(vociDaFare(d, new Date(2026, 10, 4, 9, 0))).toEqual([])
  })

  it('segnalazioni da confermare, anche per i docenti con permesso', () => {
    const d = interr({ ruolo: 'docente', staff: false, puoModificare: true, stato: 'lista', segnalazioni: 2, lista: lista(['a'], {}, '2026-11-04') })
    expect(vociDaFare(d, new Date(2026, 10, 4, 9, 0))).toEqual([{ tipo: 'segnalazioni', quante: 2 }])
  })

  it('richieste di scambio in arrivo, per tutti', () => {
    expect(vociDaFare(interr({ stato: 'lista', scambiInArrivo: 2, lista: lista(['a', 'io']) }), ADESSO)).toEqual([
      { tipo: 'scambio', quante: 2 },
    ])
    expect(vociDaFare(interr({ stato: 'lista', scambiInArrivo: 0, lista: lista(['a', 'io']) }), ADESSO)).toEqual([])
  })

  it('niente per gli studenti', () => {
    expect(vociDaFare(interr({ scadenza: IERI }), ADESSO)).toEqual([])
    expect(vociDaFare(interr({ stato: 'lista', segnalazioni: 1, lista: lista(['a']) }), ADESSO)).toEqual([])
  })
})

describe('ordinamenti', () => {
  it('"da fare": prima generare, poi segnalazioni, segnare, risposte', () => {
    const d = interr()
    const voci = [
      { voce: { tipo: 'risposte', risposte: 1, totale: 2, scadenza: 0 } as const, d },
      { voce: { tipo: 'segna', data: '2026-11-03' } as const, d },
      { voce: { tipo: 'genera' } as const, d },
      { voce: { tipo: 'segnalazioni', quante: 1 } as const, d },
    ]
    expect(voci.sort(confrontaDaFare).map((v) => v.voce.tipo)).toEqual(['genera', 'segnalazioni', 'segna', 'risposte'])
  })

  it('"le mie": prima da scegliere, poi per data stimata', () => {
    const a = { voce: { tipo: 'da-scegliere', scadenza: DOMANI } as const, d: interr({ chiave: 'a' }) }
    const b = {
      voce: { tipo: 'in-lista', posizione: 3, totale: 9, stima: { tipo: 'data', data: '2026-11-10' }, testo: '' } as const,
      d: interr({ chiave: 'b' }),
    }
    const c = {
      voce: { tipo: 'in-lista', posizione: 1, totale: 9, stima: { tipo: 'data', data: '2026-11-05' }, testo: '' } as const,
      d: interr({ chiave: 'c' }),
    }
    expect([b, c, a].sort(confrontaMie).map((x) => x.d.chiave)).toEqual(['a', 'c', 'b'])
  })
})

describe('esclusi', () => {
  it('chi è escluso non ha niente da scegliere', () => {
    expect(voceMia(interr({ miaScelta: null, esclusi: ['io'] }), ADESSO)).toBeNull()
    expect(voceMia(interr({ miaScelta: null, esclusi: ['altro'] }), ADESSO)).toMatchObject({ tipo: 'da-scegliere' })
  })
})
