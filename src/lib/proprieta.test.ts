/**
 * Test "a tappeto": migliaia di casi casuali (ma ripetibili, con un seme fisso)
 * per controllare proprietà che devono valere sempre, qualunque siano i dati.
 */
import { describe, expect, it } from 'vitest'
import {
  aggiungiGiorni,
  conEccezione,
  giornoSettimana,
  haLezione,
  prossimeLezioni,
  senzaEccezione,
  vacanzaIn,
  type Calendario,
  type DataISO,
  type Eccezione,
} from './calendar'
import { codiceDaTesto, formattaCodice, generaCodice, normalizzaCodice } from './codici'
import { stimaInterrogazione } from './estimate'
import { generatoreCasuale } from './generateList'
import { nonInterrogati, sposta, spostati, stessiElementi } from './lista'
import { scambiaPosizioni, validita } from './scambi'

const caso = generatoreCasuale(20261104)
const intero = (min: number, max: number) => min + Math.floor(caso() * (max - min + 1))
const scegli = <T,>(v: readonly T[]): T => v[intero(0, v.length - 1)]!

const INIZIO: DataISO = '2026-09-14'
const data = (da = INIZIO, giorni = 280) => aggiungiGiorni(da, intero(0, giorni))

/** Calendario casuale: sabato sì o no, qualche vacanza, lezioni extra e annullate per le materie s1/s2. */
function calendarioCasuale(): Calendario {
  let cal: Calendario = {
    giorniScolastici: [true, true, true, true, true, caso() < 0.3, false],
    eccezioni: [],
    fineAnno: aggiungiGiorni('2027-05-20', intero(0, 30)),
  }
  for (let i = intero(0, 4); i > 0; i--) {
    const da = data()
    cal = conEccezione(cal, { tipo: 'vacanza', da, a: aggiungiGiorni(da, intero(0, 10)), descrizione: 'Vacanza' })
  }
  for (let i = intero(0, 6); i > 0; i--) {
    cal = conEccezione(cal, { tipo: scegli(['lezione-extra', 'lezione-annullata'] as const), data: data(), subjectId: scegli(['s1', 's2']) })
  }
  return cal
}

function giorniCasuali(): number[] {
  return [0, 1, 2, 3, 4, 5].filter(() => caso() < 0.35)
}

function permutazione(n: number): string[] {
  const v = Array.from({ length: n }, (_, i) => `u${i}`)
  for (let i = n - 1; i > 0; i--) {
    const j = intero(0, i)
    ;[v[i], v[j]] = [v[j]!, v[i]!]
  }
  return v
}

describe('date', () => {
  it('avanti e indietro di n giorni si torna al punto di partenza; +7 è lo stesso giorno della settimana', () => {
    for (let t = 0; t < 2000; t++) {
      const d = data('2020-01-01', 4000)
      const n = intero(-800, 800)
      expect(aggiungiGiorni(aggiungiGiorni(d, n), -n)).toBe(d)
      expect(giornoSettimana(aggiungiGiorni(d, 7 * intero(-50, 50)))).toBe(giornoSettimana(d))
      expect(aggiungiGiorni(d, 1) > d).toBe(true)
    }
  })
})

describe('prossime lezioni', () => {
  it('in ordine, senza doppioni, solo giorni con lezione, mai dopo la fine dell\'anno', () => {
    for (let t = 0; t < 400; t++) {
      const cal = calendarioCasuale()
      const giorni = giorniCasuali()
      const subjectId = scegli(['s1', 's2', null])
      const da = data()
      const lezioni = prossimeLezioni({ giorni, subjectId, cal, da, quante: intero(1, 40) })
      for (let i = 0; i < lezioni.length; i++) {
        const d = lezioni[i]!
        expect(d >= da && d <= cal.fineAnno).toBe(true)
        expect(haLezione(d, giorni, subjectId, cal)).toBe(true)
        if (i > 0) expect(d > lezioni[i - 1]!).toBe(true)
        // in vacanza o di domenica solo se è una lezione extra decisa dal capoclasse
        const extra = cal.eccezioni.some((e) => e.tipo === 'lezione-extra' && e.data === d && e.subjectId === subjectId)
        if (!extra) {
          expect(vacanzaIn(d, cal)).toBeNull()
          expect(giornoSettimana(d)).not.toBe(6)
        }
        // una lezione annullata non compare mai
        expect(cal.eccezioni.some((e) => e.tipo === 'lezione-annullata' && e.data === d && e.subjectId === subjectId && !extra)).toBe(false)
      }
      // nessuna lezione saltata tra una e l'altra
      if (lezioni.length >= 2) {
        for (let d = aggiungiGiorni(lezioni[0]!, 1); d < lezioni[1]!; d = aggiungiGiorni(d, 1)) {
          expect(haLezione(d, giorni, subjectId, cal)).toBe(false)
        }
      }
    }
  })
})

describe('stima della data', () => {
  it('chi è più avanti non è mai stimato dopo chi lo segue, e mai più di N per lezione', () => {
    for (let t = 0; t < 250; t++) {
      const cal = calendarioCasuale()
      const giorni = giorniCasuali()
      if (giorni.length === 0) continue
      const perLezione = intero(1, 4)
      const subjectId = scegli(['s1', 's2'])
      const da = data()
      const giaInterrogatiDa = intero(0, 3)
      const stime = Array.from({ length: 30 }, (_, k) =>
        stimaInterrogazione({ k, perLezione, giorni, subjectId, cal, da, giaInterrogatiDa }),
      )
      const perData = new Map<string, number>()
      let finito = false
      for (const s of stime) {
        if (finito) expect(s.tipo).toBe('oltre-fine-anno') // dopo la fine dell'anno non si torna indietro
        if (s.tipo === 'oltre-fine-anno') finito = true
        if (s.tipo !== 'data') continue
        expect(s.data >= da && s.data <= cal.fineAnno).toBe(true)
        expect(haLezione(s.data, giorni, subjectId, cal)).toBe(true)
        perData.set(s.data, (perData.get(s.data) ?? 0) + 1)
      }
      const date = stime.flatMap((s) => (s.tipo === 'data' ? [s.data] : []))
      for (let i = 1; i < date.length; i++) expect(date[i]! >= date[i - 1]!).toBe(true)
      for (const [d, n] of perData) {
        // oggi i posti già occupati da chi è stato interrogato contano
        const posti = d === da ? Math.max(0, perLezione - giaInterrogatiDa) : perLezione
        expect(n).toBeLessThanOrEqual(Math.max(posti, 0))
      }
    }
  })
})

describe('lista', () => {
  it('trascinare un nome ne registra uno solo (o nessuno se resta al suo posto)', () => {
    for (let t = 0; t < 1000; t++) {
      const v = permutazione(intero(1, 30))
      const da = intero(0, v.length - 1)
      const a = intero(0, v.length - 1)
      const nuovo = sposta(v, da, a)
      expect(stessiElementi(v, nuovo)).toBe(true)
      const s = spostati(v, nuovo)
      if (Math.abs(da - a) <= 1) expect(s.length).toBeLessThanOrEqual(1) // vicini: uno qualunque dei due
      else expect(s).toEqual([{ uid: v[da]!, da: da + 1, a: a + 1 }])
    }
  })

  it('per qualunque riordino, gli "spostati" hanno posizioni giuste e gli altri restano in ordine', () => {
    for (let t = 0; t < 500; t++) {
      const v = permutazione(intero(0, 25))
      const nuovo = [...v].sort(() => caso() - 0.5)
      const s = spostati(v, nuovo)
      for (const m of s) {
        expect(v.indexOf(m.uid) + 1).toBe(m.da)
        expect(nuovo.indexOf(m.uid) + 1).toBe(m.a)
      }
      const mossi = new Set(s.map((m) => m.uid))
      const fermi = nuovo.filter((u) => !mossi.has(u)).map((u) => v.indexOf(u))
      for (let i = 1; i < fermi.length; i++) expect(fermi[i]! > fermi[i - 1]!).toBe(true)
    }
  })

  it('i non interrogati restano nell\'ordine della lista', () => {
    for (let t = 0; t < 500; t++) {
      const v = permutazione(intero(0, 30))
      const interrogati = Object.fromEntries(v.filter(() => caso() < 0.4).map((u) => [u, '2026-11-02']))
      const resto = nonInterrogati(v, interrogati)
      expect(resto).toEqual(v.filter((u) => !interrogati[u]))
    }
  })

  it('uno scambio cambia esattamente due posizioni e nessuno sparisce', () => {
    for (let t = 0; t < 1000; t++) {
      const v = permutazione(intero(2, 30))
      const i = intero(0, v.length - 1)
      let j = intero(0, v.length - 1)
      if (j === i) j = (i + 1) % v.length
      const nuovo = scambiaPosizioni(v, i, j)
      expect(stessiElementi(v, nuovo)).toBe(true)
      expect(nuovo.filter((u, k) => u !== v[k])).toHaveLength(2)
      expect(nuovo[i]).toBe(v[j])
      // dopo lo scambio la stessa richiesta non è più valida (chi chiedeva non è più al suo posto)
      expect(validita({ da: v[i]!, daPos: i, aPos: j, stato: 'attesa', a: null } as never, { ordine: nuovo, interrogati: {} })).toBe('superata')
    }
  })
})

describe('calendario: eccezioni', () => {
  it('aggiungere e togliere un\'eccezione riporta al calendario di prima; mai doppioni', () => {
    for (let t = 0; t < 500; t++) {
      const cal = calendarioCasuale()
      const nuova: Eccezione =
        caso() < 0.5
          ? { tipo: 'vacanza', da: data(), a: data(), descrizione: 'Ponte' }
          : { tipo: scegli(['lezione-extra', 'lezione-annullata'] as const), data: data(), subjectId: 's3' }
      const con = conEccezione(cal, nuova)
      expect(conEccezione(con, nuova)).toEqual(con) // due volte = una
      expect(senzaEccezione(con, nuova)).toEqual(cal)
      const date = con.eccezioni.map((e) => (e.tipo === 'vacanza' ? e.da : e.data))
      expect([...date].sort()).toEqual(date)
    }
  })
})

describe('codici d\'invito', () => {
  it('generati, scritti in qualsiasi modo o incollati come link, si riconoscono sempre', () => {
    for (let t = 0; t < 2000; t++) {
      const c = generaCodice()
      expect(normalizzaCodice(c)).toBe(c)
      expect(normalizzaCodice(formattaCodice(c).toLowerCase())).toBe(c)
      expect(normalizzaCodice(` ${c.slice(0, 3)} ${c.slice(3)} `)).toBe(c)
      expect(codiceDaTesto(`Entra: https://whos-next.web.app/unisciti/${c} grazie`)).toBe(c)
      expect(codiceDaTesto(`https://whos-next.web.app/unisciti/${formattaCodice(c)}`)).toBe(c)
    }
    for (const sbagliato of ['', 'ABCDE', 'ABCDEFG', 'ABC-DE0', 'ABCDEI', 'ÀBCDEF', 'ABC DEF GH']) {
      expect(normalizzaCodice(sbagliato)).toBeNull()
    }
  })
})
